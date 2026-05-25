# Devices, CUDA, MPS

## Picking a device, once

```python
import torch

def get_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")

device = get_device()
```

Resolve once at startup. Don't recheck `is_available()` in the loop.

## Device-agnostic patterns

```python
# Create directly on device, not "create on CPU then move"
x = torch.zeros(N, dtype=torch.float32, device=device)

# Move model once
model = MyModel().to(device)

# Inside the loop, move per-batch data (DataLoader workers prep on CPU)
for x, y in loader:
    x = x.to(device, non_blocking=True)
    y = y.to(device, non_blocking=True)
```

`non_blocking=True` only asynchronous if source is pinned. The `DataLoader` with `pin_memory=True` makes its tensors pinned automatically.

## CUDA inspection

```python
torch.cuda.is_available()              # bool
torch.cuda.device_count()              # int
torch.cuda.current_device()            # int
torch.cuda.get_device_name(0)          # str
torch.cuda.get_device_capability(0)    # (major, minor) e.g. (8, 6) for A100

# Per-process memory in bytes
torch.cuda.memory_allocated()          # active
torch.cuda.memory_reserved()           # reserved by caching allocator
torch.cuda.max_memory_allocated()      # peak so far
torch.cuda.reset_peak_memory_stats()   # zero the peak counter

# Free, total
free, total = torch.cuda.mem_get_info()
```

## Multi-GPU on one host

For typical "data parallel" training, use `DistributedDataParallel` (see [distributed.md](distributed.md)) — even on one host. `DataParallel` exists but is deprecated for performance reasons (GIL-bound, slow).

Selecting one of several GPUs for single-process work:

```python
torch.cuda.set_device(1)               # process-wide default
device = torch.device("cuda:1")
```

Or via env var (cleaner for launching scripts):

```bash
CUDA_VISIBLE_DEVICES=1 python train.py
```

`CUDA_VISIBLE_DEVICES` hides the others — `cuda:0` in the script refers to physical GPU 1.

## CUDA memory management

PyTorch uses a caching allocator. Released tensors return memory to the cache, not the OS. `nvidia-smi` will show high usage even after a tensor is freed — this is normal.

To force-release cached memory to the OS (rarely useful, slow):

```python
torch.cuda.empty_cache()
```

Common reasons memory creeps up:

- Tensor still referenced (held in a list, attribute, lambda closure)
- `loss.detach()` not called when accumulating metric tensors
- Validation creates tensors that aren't freed because graph is retained
- DataLoader worker memory grows (kill+respawn workers; `persistent_workers=True` keeps them alive — usually good but can mask leaks)

Track per-step usage:

```python
print(f"alloc={torch.cuda.memory_allocated()/1e9:.2f}GB "
      f"peak={torch.cuda.max_memory_allocated()/1e9:.2f}GB")
```

## Expandable memory segments (CUDA)

To reduce fragmentation in long-running jobs:

```bash
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
```

Reduces OOM-from-fragmentation in dynamic-shape workloads. Set before launching Python.

## Apple Silicon — MPS

```python
device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
x = torch.randn(2, 3, device=device)
```

Limitations:

- Some ops fall back to CPU; set `PYTORCH_ENABLE_MPS_FALLBACK=1` during development
- `torch.float64` not supported — model and tensors must be float32 or bf16
- AMP works via `torch.amp.autocast(device_type="mps", dtype=torch.float16)` but coverage is narrower than CUDA
- Distributed training (DDP/FSDP) generally not supported on MPS
- Memory accounting: `torch.mps.current_allocated_memory()`, `torch.mps.driver_allocated_memory()`

For dev on Mac, prod on Linux GPU — the device-agnostic pattern above just works.

## Tensor cores and matmul precision

On A100/H100, you control matmul precision globally:

```python
# "highest" - tf32 disabled, full fp32; "high" - tf32 enabled for matmul; "medium" - bf16 reduce
torch.set_float32_matmul_precision("high")
```

`"high"` is the typical training default — significant speedup with negligible accuracy loss.

## Multi-process + CUDA pitfall

Linux's default `fork` start method does **not** play well with CUDA. If your `DataLoader` has `num_workers > 0` and CUDA is already initialized in the parent, workers will see an unusable CUDA context.

Fix: set `spawn` start method, or initialize CUDA only after fork.

```python
import torch.multiprocessing as mp
mp.set_start_method("spawn", force=True)   # at process start
```

For most training scripts, the canonical pattern works: only the main process touches CUDA; workers do CPU prep and return tensors which the main process then `.to(device)`s. Don't pre-`.cuda()` in `__getitem__`.

## Cleaning up

```python
# End-of-training shutdown
del model, optimizer, scaler
torch.cuda.empty_cache()
```

Useful when iterating in a notebook to free between experiments. Not normally needed in a one-shot training script.
