# Wrong vs right — common PyTorch anti-patterns

Each entry: the buggy pattern, why it's broken, the fix.

## 1. Forgetting `model.eval()` before validation

```python
# ❌ Wrong
for epoch in range(N):
    model.train()
    train_one_epoch(...)
    # No model.eval() — dropout/BN still in train mode
    val_loss = validate(model, val_loader)
```

Result: val loss artificially worse than train loss, validation BatchNorm uses batch stats from the val batch instead of running stats. Model selection picks the wrong checkpoint.

```python
# ✅ Right
for epoch in range(N):
    model.train()
    train_one_epoch(...)

    model.eval()
    with torch.inference_mode():
        val_loss = validate(model, val_loader)
    model.train()
```

## 2. `.to(device)` inside the training loop on the model

```python
# ❌ Wrong — moves model every batch
for x, y in loader:
    model.to(device)               # wasted op every batch
    x, y = x.to(device), y.to(device)
    ...
```

```python
# ✅ Right — move model once at startup
model = MyModel().to(device)
for x, y in loader:
    x = x.to(device, non_blocking=True)
    y = y.to(device, non_blocking=True)
    ...
```

## 3. `.item()` in a hot loop

```python
# ❌ Wrong — syncs CUDA every batch, kills throughput
running_loss = 0.0
for x, y in loader:
    loss = train_step(x, y)
    running_loss += loss.item()        # forces GPU→CPU sync
```

```python
# ✅ Right — accumulate on device, sync once at end
running_loss = torch.zeros(1, device=device)
n_batches = 0
for x, y in loader:
    loss = train_step(x, y)
    running_loss += loss.detach()
    n_batches += 1
avg = (running_loss / n_batches).item()    # one sync
```

## 4. Missing `torch.no_grad()` / `inference_mode()` in eval

```python
# ❌ Wrong — builds the autograd graph for every val batch, leaks memory
def evaluate(model, loader):
    model.eval()
    total = 0
    for x, y in loader:
        total += loss_fn(model(x), y).item()
    return total
```

```python
# ✅ Right
@torch.inference_mode()
def evaluate(model, loader):
    model.eval()
    total = 0.0
    for x, y in loader:
        total += loss_fn(model(x), y).item()
    return total
```

## 5. Mutating a tensor needed for backward

```python
# ❌ Wrong — in-place op corrupts backward
x = torch.randn(10, requires_grad=True)
y = x * 2
y.add_(1)                         # mutates y in place
loss = y.sum()
loss.backward()                   # RuntimeError: a leaf Variable...
```

```python
# ✅ Right — produce a new tensor
x = torch.randn(10, requires_grad=True)
y = x * 2
y = y + 1                         # new tensor
loss = y.sum()
loss.backward()
```

## 6. Forgetting `optimizer.zero_grad()`

```python
# ❌ Wrong — grads accumulate forever, gradient explodes
for x, y in loader:
    loss = loss_fn(model(x), y)
    loss.backward()
    optimizer.step()              # uses sum of all previous grads
```

```python
# ✅ Right
for x, y in loader:
    optimizer.zero_grad(set_to_none=True)
    loss = loss_fn(model(x), y)
    loss.backward()
    optimizer.step()
```

## 7. `.half()` the model with autocast

```python
# ❌ Wrong — breaks numerics for LN, softmax, etc.
model = MyModel().half().to("cuda")
with torch.amp.autocast(device_type="cuda", dtype=torch.float16):
    out = model(x)
```

```python
# ✅ Right — keep model in fp32, let autocast handle per-op casting
model = MyModel().to("cuda")
with torch.amp.autocast(device_type="cuda", dtype=torch.bfloat16):
    out = model(x)
```

## 8. Plain list of submodules

```python
# ❌ Wrong — submodules not tracked, no params, won't move with .to(device)
class MultiHead(nn.Module):
    def __init__(self, n, d):
        super().__init__()
        self.heads = [nn.Linear(d, d) for _ in range(n)]    # plain list!
```

```python
# ✅ Right
class MultiHead(nn.Module):
    def __init__(self, n, d):
        super().__init__()
        self.heads = nn.ModuleList([nn.Linear(d, d) for _ in range(n)])
```

## 9. Confusing buffer vs attribute

```python
# ❌ Wrong — running_mean is a plain attribute; doesn't move with .to(device)
class MyNorm(nn.Module):
    def __init__(self, dim):
        super().__init__()
        self.running_mean = torch.zeros(dim)     # plain attribute, stays on CPU
```

```python
# ✅ Right
class MyNorm(nn.Module):
    def __init__(self, dim):
        super().__init__()
        self.register_buffer("running_mean", torch.zeros(dim))
```

## 10. Computing softmax then feeding to `CrossEntropyLoss`

```python
# ❌ Wrong — CE applies log_softmax internally; double-softmax kills training
logits = model(x)
probs = torch.softmax(logits, dim=-1)
loss = nn.CrossEntropyLoss()(probs, y)         # WRONG INPUT
```

```python
# ✅ Right — feed logits directly
logits = model(x)
loss = nn.CrossEntropyLoss()(logits, y)
```

Same applies to `BCEWithLogitsLoss` — feed raw logits, not `sigmoid(logits)`.

## 11. Clipping scaled gradients

```python
# ❌ Wrong — clipping the scaled grads (e.g., 65536x normal), does nothing
scaler.scale(loss).backward()
torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)     # SCALED grads!
scaler.step(optimizer)
```

```python
# ✅ Right — unscale first, then clip
scaler.scale(loss).backward()
scaler.unscale_(optimizer)
torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
scaler.step(optimizer)
scaler.update()
```

## 12. Forgetting `DistributedSampler.set_epoch()`

```python
# ❌ Wrong — same shuffle order every epoch; model overfits to ordering
sampler = DistributedSampler(ds, num_replicas=world_size, rank=rank, shuffle=True)
for epoch in range(N):
    for x, y in loader:
        ...
```

```python
# ✅ Right
for epoch in range(N):
    sampler.set_epoch(epoch)
    for x, y in loader:
        ...
```

## 13. Forgetting `if __name__ == "__main__":` guard

```python
# ❌ Wrong — fails on Windows/macOS spawn or with num_workers > 0
import torch
loader = DataLoader(ds, num_workers=4)
for x, y in loader:
    ...
```

```python
# ✅ Right
import torch

def main():
    loader = DataLoader(ds, num_workers=4)
    for x, y in loader:
        ...

if __name__ == "__main__":
    main()
```

## 14. Iterating dict to optimizer instead of `.parameters()`

```python
# ❌ Wrong — passes state_dict (tensors w/o requires_grad info)
optimizer = torch.optim.AdamW(model.state_dict().values(), lr=3e-4)
```

```python
# ✅ Right
optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4)
```

## 15. Saving only the model weights

```python
# ❌ Wrong — can't resume training; lose optimizer momentum, scheduler position, scaler state
torch.save(model.state_dict(), "ckpt.pt")
```

```python
# ✅ Right — save full state
torch.save({
    "model": model.state_dict(),
    "optimizer": optimizer.state_dict(),
    "scheduler": scheduler.state_dict(),
    "scaler": scaler.state_dict(),
    "epoch": epoch,
    "step": global_step,
}, "ckpt.pt")
```

## 16. Loading checkpoint after wrapping in DDP

```python
# ❌ Wrong — keys have "module." prefix; load fails or silently keeps init weights
model = MyModel().to(device)
model = DDP(model, device_ids=[local_rank])
model.load_state_dict(torch.load("ckpt.pt"))   # mismatched keys
```

```python
# ✅ Right — load BEFORE DDP, or load into model.module
model = MyModel().to(device)
model.load_state_dict(torch.load("ckpt.pt", map_location=device))
model = DDP(model, device_ids=[local_rank])
```
