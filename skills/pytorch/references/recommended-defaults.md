# Recommended defaults

Sensible starting points. Tune from here based on actual measurements.

## Batch size

- Pick the largest batch that fits in GPU memory **with** AMP enabled
- If you can't fit even batch=1 of a target arch, switch to FSDP or a smaller model
- For DDP, "effective batch" = `batch_size * world_size`. Adjust learning rate via the linear-scaling rule (`lr *= world_size`) up to ~1024 effective batch, then sublinear (sqrt)
- Use gradient accumulation when you need a larger effective batch than memory allows: `effective_batch = batch_size * accum_steps`

| Model family | Per-GPU batch (A100 40GB, bf16) |
|---|---|
| ResNet-50 (224x224) | 256–512 |
| ViT-B/16 (224x224) | 64–128 |
| LLM small (~1B params) | 4–16 sequences (depending on seq_len) |
| LLM medium (~7B params) | 1–2 sequences with grad accum |

These are starting points — actual values depend on optimizer state, activations, and intermediate buffers.

## Learning rate

| Optimizer | Starting LR (small/medium model) |
|---|---|
| `AdamW` | `3e-4` |
| `Adam` | `1e-3` |
| `SGD` with momentum | `0.1` (CV) / `0.01` (smaller models) |
| `Lion` | `1e-4` (5–10x lower than AdamW) |

For LLMs, decay weight more aggressively and use warmup:

```python
optimizer = torch.optim.AdamW(
    model.parameters(),
    lr=3e-4,
    betas=(0.9, 0.95),       # 0.95 (not default 0.999) for stability on long runs
    eps=1e-8,
    weight_decay=0.1,
)
```

## Learning rate scheduler

- **Default for most CV/NLP fine-tuning**: cosine with warmup
- **Default for from-scratch training**: linear warmup → cosine annealing
- **Default for fine-tuning a single epoch**: `OneCycleLR` (`max_lr=lr`, `total_steps=len(loader)`)

```python
warmup_steps = min(500, total_steps // 10)
warmup = torch.optim.lr_scheduler.LinearLR(opt, start_factor=0.01, total_iters=warmup_steps)
cosine = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=total_steps - warmup_steps)
scheduler = torch.optim.lr_scheduler.SequentialLR(opt, [warmup, cosine], milestones=[warmup_steps])
```

Step the scheduler **per batch** for this combo, not per epoch.

## Gradient clipping

- **Default**: `1.0` for transformers, `5.0` for CNNs
- **RL / unstable training**: `0.5`
- **Never disable** for transformer training — one bad batch can NaN the run

```python
torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
```

If using `GradScaler`, call `scaler.unscale_(optimizer)` first.

## Mixed precision dtype

- **A100 / H100 / RTX 30+ / TPU**: `torch.bfloat16` — no scaler needed
- **V100 / T4 / RTX 20xx**: `torch.float16` + `GradScaler`
- **CPU (Intel Xeon Sapphire / Apple Silicon)**: `torch.bfloat16` (CPU AMP)

## DataLoader

```python
DataLoader(
    ds,
    batch_size=64,
    shuffle=True,                  # for training; False for val
    num_workers=min(8, os.cpu_count()),
    pin_memory=True,               # CUDA only
    persistent_workers=True,       # always when num_workers > 0
    prefetch_factor=2,             # bump to 4-6 if loader is bottleneck
    drop_last=True,                # stable batch size, helps DDP/BN
)
```

`num_workers` heuristic: `min(8, cpu_count())` for typical training. More workers help only if CPU is the bottleneck (heavy image augmentation, slow decode).

## Weight decay

Common defaults:

- ViT/Transformer: `0.1` (high — these models tolerate it)
- ResNet: `1e-4`
- LLM pretrain: `0.1`

Exclude bias and LayerNorm from weight decay:

```python
decay_params, no_decay_params = [], []
for n, p in model.named_parameters():
    if not p.requires_grad:
        continue
    if p.ndim < 2 or n.endswith(".bias"):
        no_decay_params.append(p)
    else:
        decay_params.append(p)

optimizer = torch.optim.AdamW(
    [{"params": decay_params, "weight_decay": 0.1},
     {"params": no_decay_params, "weight_decay": 0.0}],
    lr=3e-4,
)
```

## Reproducibility

```python
torch.manual_seed(42)
torch.cuda.manual_seed_all(42)
import numpy as np, random
np.random.seed(42)
random.seed(42)
```

`torch.use_deterministic_algorithms(True)` is a hard requirement only if you need bit-exact reproducibility — it's slow and breaks some ops. For most ML work, seeding the four sources above gives "close enough" reproducibility.

## Validation cadence

- Tiny datasets (< 1M samples): validate every epoch
- Medium (1M–100M): every N steps where N corresponds to ~30 minutes of training
- Huge (LLM-scale): every M steps where M = a few hours of compute; never per-epoch

Validation should not block training — for large datasets, sample a fixed validation subset rather than running over the full val set.

## Checkpoint cadence

Save every epoch for short runs (< 24h), every N steps for long runs. Keep:

- `last.pt` — most recent (for resume)
- `best.pt` — lowest val loss / highest val metric
- 1–3 numbered checkpoints (`step_10000.pt`) for debugging

Don't keep every checkpoint — disk fills up.

## Choosing optimizer

- **AdamW** — default for almost everything; faster convergence than SGD on most modern models
- **SGD + momentum** — beats AdamW final accuracy on CNNs (ResNet, EfficientNet) given enough epochs and proper LR schedule
- **Lion** — newer; sometimes better than AdamW; needs lower LR (~3-10x)
- **8-bit Adam** (`bitsandbytes`) — when optimizer state is the memory bottleneck

## torch.compile mode

| Workload | Mode |
|---|---|
| Standard training | `mode="default"` |
| Small model, stable shapes, latency matters | `mode="reduce-overhead"` |
| Long training run, want maximum throughput | `mode="max-autotune"` |
| Debugging | `disable=True` or skip compile |
