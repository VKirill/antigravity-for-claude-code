# Datasets and DataLoader

## Two Dataset flavors

- `torch.utils.data.Dataset` — random-access by index. You implement `__len__` and `__getitem__`. Best for files-on-disk, in-memory arrays.
- `torch.utils.data.IterableDataset` — yields samples sequentially. Best for streaming, infinite data, sharded reads.

## Map-style Dataset

```python
from torch.utils.data import Dataset
from pathlib import Path
import torch
from PIL import Image
import torchvision.transforms.v2 as T

class ImageFolderDS(Dataset):
    def __init__(self, root: str, transform=None):
        self.paths = sorted(Path(root).glob("**/*.jpg"))
        self.labels = [int(p.parent.name) for p in self.paths]
        self.transform = transform or T.Compose([
            T.PILToTensor(),
            T.Resize(256),
            T.CenterCrop(224),
            T.ToDtype(torch.float32, scale=True),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, idx):
        img = Image.open(self.paths[idx]).convert("RGB")
        return self.transform(img), self.labels[idx]
```

Rules:

- Keep `__getitem__` CPU-only — don't `.to("cuda")` here. The main process owns CUDA; workers prep on CPU.
- Return tensors (or anything pickleable). Custom dataclasses work but slow if heavy.
- `__getitem__` runs in workers; keep it fast and stateless across calls

## IterableDataset

```python
from torch.utils.data import IterableDataset, get_worker_info
import json

class JsonlStreamDS(IterableDataset):
    def __init__(self, path: str):
        self.path = path

    def __iter__(self):
        info = get_worker_info()
        worker_id = info.id if info else 0
        num_workers = info.num_workers if info else 1
        with open(self.path) as f:
            for i, line in enumerate(f):
                if i % num_workers != worker_id:        # SHARD across workers
                    continue
                row = json.loads(line)
                yield row["x"], row["y"]
```

Critical: shard explicitly via `get_worker_info()`. Without sharding, every worker reads every sample and you train on duplicates.

## DataLoader

```python
from torch.utils.data import DataLoader

loader = DataLoader(
    dataset,
    batch_size=64,
    shuffle=True,
    num_workers=4,
    pin_memory=True,
    persistent_workers=True,
    prefetch_factor=2,
    drop_last=False,
    collate_fn=None,
)
```

Knobs:

| Knob | What |
|---|---|
| `num_workers` | Subprocess count for loading. 0 = main process (debug only). Heuristic: 2x num CPU cores, capped at 8. |
| `pin_memory` | Copies batches to pinned (page-locked) memory. Required for `non_blocking=True` host→device. CUDA only. |
| `persistent_workers` | Keep workers alive between epochs. Avoids re-spawn overhead (~seconds). Default False; set True for short epochs. |
| `prefetch_factor` | Batches each worker prefetches. Default 2. Bump to 4–6 if loader is bottleneck. |
| `drop_last` | Drop the last incomplete batch. Set True for stable batch size (helps DDP, BatchNorm). |
| `shuffle` | Random order each epoch. NEVER use with `IterableDataset` or `DistributedSampler` — let the sampler handle it. |
| `collate_fn` | How to assemble a list of samples into a batch. Default: stack tensors. Override for variable-length data. |

## Custom collate_fn

For variable-length sequences (NLP):

```python
import torch
from torch.nn.utils.rnn import pad_sequence

def collate_padded(batch):
    xs, ys = zip(*batch)
    xs_padded = pad_sequence(xs, batch_first=True, padding_value=0)
    ys_padded = pad_sequence(ys, batch_first=True, padding_value=-100)  # ignore_index for CE loss
    lengths = torch.tensor([len(x) for x in xs])
    return xs_padded, ys_padded, lengths

loader = DataLoader(ds, batch_size=32, collate_fn=collate_padded)
```

## Samplers

```python
from torch.utils.data import RandomSampler, WeightedRandomSampler, SequentialSampler

# Default — DataLoader builds one for you based on `shuffle=`
loader = DataLoader(ds, batch_size=64, shuffle=True)

# Class imbalance — weight inverse to class frequency
class_counts = torch.bincount(torch.tensor(ds.labels))
weights = 1.0 / class_counts[ds.labels].float()
sampler = WeightedRandomSampler(weights, num_samples=len(ds), replacement=True)
loader = DataLoader(ds, batch_size=64, sampler=sampler)
```

`DistributedSampler` for DDP (see [distributed.md](distributed.md)).

## Multi-worker + CUDA gotcha

If the parent process initializes CUDA before forking workers, workers inherit a broken CUDA context. Options:

1. Keep `__getitem__` CPU-only (recommended)
2. Set the multiprocessing start method to `spawn` (slower fork, safer)

```python
import torch.multiprocessing as mp
mp.set_start_method("spawn", force=True)
```

On Windows and macOS the default is already `spawn`. On Linux it's `fork` — that's why this comes up there.

## DataLoader benchmarking

```python
import time

loader = DataLoader(ds, batch_size=64, num_workers=4, pin_memory=True)
t = time.time()
for i, batch in enumerate(loader):
    pass
print(f"{i+1} batches in {time.time()-t:.2f}s")
```

If your loader is slower than your GPU step, the GPU starves. Symptoms: GPU utilization < 80%. Fixes:

- Bump `num_workers` until throughput stops improving
- Set `persistent_workers=True`
- Bump `prefetch_factor`
- Move expensive transforms to `__init__` if they can be precomputed
- Use a faster image decoder (`torchvision` v2 + PIL-SIMD, or `decord` for video)
- Cache decoded tensors to disk (NumPy memmap, Webdataset, Parquet)

## torchvision transforms v2

The v2 API is faster and supports both `PIL.Image` and `torch.Tensor`. Prefer over the legacy v1:

```python
import torchvision.transforms.v2 as T

train_tf = T.Compose([
    T.PILToTensor(),
    T.RandomResizedCrop(224),
    T.RandomHorizontalFlip(),
    T.ToDtype(torch.float32, scale=True),
    T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])
```

## Building a training-ready loader — minimal checklist

- [ ] `Dataset` returns CPU tensors
- [ ] `DataLoader(num_workers > 0, pin_memory=True, persistent_workers=True)`
- [ ] `drop_last=True` if you care about stable batch size
- [ ] `shuffle=True` for training only — separate loaders for train/val
- [ ] For DDP: `DistributedSampler` with `set_epoch(epoch)`
- [ ] For variable-length: custom `collate_fn`
- [ ] For class imbalance: `WeightedRandomSampler` or loss weighting
