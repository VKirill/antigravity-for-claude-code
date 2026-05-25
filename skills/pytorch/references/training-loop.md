# Training loop boilerplate

The canonical structure. Adapt to your project — but keep the order.

## Minimum viable loop

```python
import torch
from torch.utils.data import DataLoader

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

model = MyModel().to(device)
optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4, weight_decay=0.01)
loss_fn = torch.nn.CrossEntropyLoss()

train_loader = DataLoader(train_ds, batch_size=64, shuffle=True, num_workers=4, pin_memory=True)

for epoch in range(num_epochs):
    model.train()
    for x, y in train_loader:
        x = x.to(device, non_blocking=True)
        y = y.to(device, non_blocking=True)

        optimizer.zero_grad(set_to_none=True)
        logits = model(x)
        loss = loss_fn(logits, y)
        loss.backward()
        optimizer.step()
```

Critical details:

- `optimizer.zero_grad(set_to_none=True)` — slightly faster than zeroing, treats None grads as zero
- `non_blocking=True` only meaningful when the source tensor is pinned (DataLoader does this with `pin_memory=True`)
- `.to(device)` before `loss_fn` and `optimizer` — already moved when constructed on device
- Move model once to device, never per batch

## Full loop with validation, AMP, gradient accumulation, clipping, scheduler, checkpoints

```python
import torch
from torch.amp import autocast, GradScaler

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
use_amp = device.type == "cuda"
amp_dtype = torch.bfloat16  # use float16 on V100/T4

model = MyModel().to(device)
optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4, weight_decay=0.01)
scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=num_epochs)

# GradScaler only needed for float16; bfloat16 doesn't need it
scaler = GradScaler(enabled=(use_amp and amp_dtype == torch.float16))

accum_steps = 4         # effective batch = batch_size * accum_steps
max_grad_norm = 1.0
log_every = 50
best_val = float("inf")

global_step = 0
for epoch in range(num_epochs):
    model.train()
    optimizer.zero_grad(set_to_none=True)

    for step, (x, y) in enumerate(train_loader):
        x = x.to(device, non_blocking=True)
        y = y.to(device, non_blocking=True)

        with autocast(device_type=device.type, dtype=amp_dtype, enabled=use_amp):
            logits = model(x)
            loss = loss_fn(logits, y) / accum_steps     # NORMALIZE BY ACCUM

        scaler.scale(loss).backward()

        if (step + 1) % accum_steps == 0:
            # Unscale before clipping (no-op when scaler disabled)
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_grad_norm)
            scaler.step(optimizer)
            scaler.update()
            optimizer.zero_grad(set_to_none=True)
            global_step += 1

        if step % log_every == 0:
            print(f"epoch={epoch} step={step} loss={loss.item() * accum_steps:.4f}")

    scheduler.step()
    val_loss = evaluate(model, val_loader, loss_fn, device)
    if val_loss < best_val:
        best_val = val_loss
        save_checkpoint("best.pt", model, optimizer, scaler, scheduler, epoch, global_step)
```

## Evaluation

```python
@torch.inference_mode()
def evaluate(model, loader, loss_fn, device):
    model.eval()
    total_loss, total_n = 0.0, 0
    for x, y in loader:
        x = x.to(device, non_blocking=True)
        y = y.to(device, non_blocking=True)
        logits = model(x)
        loss = loss_fn(logits, y)
        total_loss += loss.item() * x.size(0)
        total_n += x.size(0)
    return total_loss / total_n
```

Notes:

- `@torch.inference_mode()` as a decorator beats `with torch.no_grad():` for speed
- `model.eval()` MUST come before — otherwise dropout/BN still in train mode
- Convert to scalar via `.item()` once per batch is OK in eval (not in a hot training loop with hundreds of batches per second)

## Gradient accumulation — why divide loss

With accumulation, you call `backward()` N times before stepping. Gradients sum, so the effective gradient is `N * mean(loss)`. To match the gradient of a single forward with effective batch size `N*B`, divide loss by `N`:

```python
loss = loss_fn(logits, y) / accum_steps
loss.backward()                    # accumulates 1/N of the "real" gradient
# After N iterations, sum of grads = mean gradient over N*B samples
```

## Gradient clipping

```python
# Before optimizer.step()
torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
```

Common values: 1.0 for transformers, 5.0 for CNNs, 0.5 for RL.

If using `GradScaler`, call `scaler.unscale_(optimizer)` first — otherwise you're clipping the scaled gradients (much larger than actual).

## LR schedulers

```python
# Common choices
torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs)
torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=1e-3, total_steps=total)
torch.optim.lr_scheduler.LinearLR(opt, start_factor=1.0, end_factor=0.0, total_iters=epochs)
torch.optim.lr_scheduler.ReduceLROnPlateau(opt, mode="min", factor=0.5, patience=3)

# Step-per-epoch (most schedulers)
scheduler.step()

# Step-per-batch (OneCycleLR, warmup schedulers)
scheduler.step()                   # inside batch loop, after optimizer.step

# Plateau scheduler — needs metric
scheduler.step(val_loss)
```

Warmup + cosine is the standard combo for transformers — combine schedulers with `SequentialLR`:

```python
warmup = torch.optim.lr_scheduler.LinearLR(opt, start_factor=0.01, total_iters=warmup_steps)
cosine = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=total_steps - warmup_steps)
scheduler = torch.optim.lr_scheduler.SequentialLR(opt, [warmup, cosine], milestones=[warmup_steps])
```

## Checkpoint save/load

```python
def save_checkpoint(path, model, optimizer, scaler, scheduler, epoch, step):
    state = {
        "model": model.state_dict(),
        "optimizer": optimizer.state_dict(),
        "scaler": scaler.state_dict(),
        "scheduler": scheduler.state_dict(),
        "epoch": epoch,
        "step": step,
        "rng": torch.get_rng_state(),
        "cuda_rng": torch.cuda.get_rng_state_all() if torch.cuda.is_available() else None,
    }
    torch.save(state, path)

def load_checkpoint(path, model, optimizer=None, scaler=None, scheduler=None, map_location=None):
    state = torch.load(path, map_location=map_location, weights_only=False)
    model.load_state_dict(state["model"])
    if optimizer:
        optimizer.load_state_dict(state["optimizer"])
    if scaler:
        scaler.load_state_dict(state["scaler"])
    if scheduler:
        scheduler.load_state_dict(state["scheduler"])
    return state["epoch"], state["step"]
```

Notes:

- `torch.save` uses pickle — only load checkpoints from trusted sources. `weights_only=True` (default in recent versions) is safer when loading only weights.
- Save full state (optimizer momentum, scaler state, scheduler position, RNG) — partial saves break resumability
- `map_location="cpu"` to load on a machine without a GPU; then `.to(device)` after

## Reproducibility

```python
import random, numpy as np

def seed_all(seed: int):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    # Optional: deterministic ops (slower)
    torch.use_deterministic_algorithms(True)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False
```

True bit-exact reproducibility is hard with CUDA — some ops have nondeterministic kernels. For production training, seed everything and accept tiny variation rather than slow down with `deterministic_algorithms`.
