# Troubleshooting

## CUDA out of memory

Symptom: `torch.cuda.OutOfMemoryError: CUDA out of memory. Tried to allocate X.XX GiB`.

Diagnose:

```python
print(torch.cuda.memory_summary(abbreviated=True))
print(f"alloc={torch.cuda.memory_allocated()/1e9:.2f}GB "
      f"peak={torch.cuda.max_memory_allocated()/1e9:.2f}GB")
```

Fixes in order of cheapness:

1. Reduce `batch_size` and add gradient accumulation to compensate
2. Enable mixed precision (`autocast(dtype=torch.bfloat16)`) — halves activation memory
3. Enable activation checkpointing (`torch.utils.checkpoint.checkpoint`) — trade compute for memory
4. Move optimizer to CPU offload (FSDP `CPUOffloadPolicy`)
5. Switch to FSDP2 (`fully_shard`) — shard params across GPUs
6. `export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True` — reduces fragmentation in dynamic-shape workloads

Common leak causes:

- Holding `loss` (with autograd graph) in a list: store `loss.detach().item()` instead
- Accumulating predictions on GPU across batches: move to CPU each batch or store the metric, not raw tensors
- Validation called without `torch.inference_mode()`: graph retention leaks across val
- `find_unused_parameters=True` in DDP for no reason: keeps extra state

Check what's actually allocated:

```python
import gc
for obj in gc.get_objects():
    try:
        if torch.is_tensor(obj) or (hasattr(obj, "data") and torch.is_tensor(obj.data)):
            print(type(obj).__name__, obj.size(), obj.device)
    except Exception:
        pass
```

## NaN / Inf loss

Symptom: loss becomes `nan` or `inf` after some steps; `model.parameters()` contain `nan`.

Common causes:

| Cause | Fix |
|---|---|
| Learning rate too high | Lower lr; add warmup |
| Bad init in custom layer | Use `nn.init.xavier_uniform_` / `kaiming_*` explicitly |
| `log(0)` / `1/0` in loss | Clamp inputs: `torch.clamp(p, 1e-7, 1-1e-7)` |
| Mixed precision overflow (fp16) | Use bf16 instead, or rely on `GradScaler` (don't disable it) |
| Exploding gradients | Add `clip_grad_norm_(model.parameters(), 1.0)` |
| `nn.CrossEntropyLoss` with non-logit input | Feed logits, not softmax — `CE` applies log_softmax internally |
| Empty batch from sampler | Check Dataset `__len__`; check filter logic |

Detect first NaN occurrence:

```python
torch.autograd.set_detect_anomaly(True)    # SLOW; only for debugging
```

This raises at the op where NaN first appears, with a stack trace into the forward.

In the loop:

```python
if not torch.isfinite(loss):
    print(f"non-finite loss at step {step}: {loss}")
    break
```

## DataLoader is slow

Symptom: GPU utilization (in `nvidia-smi`) sits below ~80% while training.

Check:

```python
import time
t = time.time()
for i, _ in enumerate(loader):
    if i >= 50:
        break
print(f"50 batches in {time.time()-t:.2f}s")
```

Fixes:

1. `num_workers` is too low. Try `num_workers=8`, then go higher / lower
2. `pin_memory=False`. Set it to True for CUDA training
3. Workers spinning up each epoch. Set `persistent_workers=True`
4. Heavy CPU transforms. Move costly ops to a precompute step or `__init__`
5. JPEG decode is the bottleneck. Use Pillow-SIMD or pre-decode to NumPy/tensor
6. Disk is slow. Move dataset to local NVMe; pre-shard to a few large files (Webdataset) rather than millions of small files
7. The model is fast and starvation is inevitable. Use `torch.compile` to slow the model (joke) — or use bigger batches

## torch.compile graph breaks

Symptom: compile is slow or you get warnings about graph breaks. Speed is below expectation.

```bash
TORCH_LOGS=graph_breaks python train.py
```

Lists each break with the Python line. Fixes per cause:

- `.item()`, `.tolist()`, `.cpu()` inside forward — move outside or use `torch.cond`
- Tensor-dependent Python control flow — restructure to vectorized ops
- Custom `torch.autograd.Function` — register with `@torch.library.custom_op` if supported

Force-detect during dev:

```python
model = torch.compile(model, fullgraph=True)    # raises on first break
```

## DDP hangs at startup

Symptom: `init_process_group` blocks indefinitely.

Check:

1. `MASTER_ADDR` reachable from all nodes — `ping`, `nc -zv <addr> <port>`
2. `MASTER_PORT` not in use — `lsof -i :29500`
3. Firewall on master allows the port
4. All ranks called `init_process_group` (one stuck rank hangs all)

Diagnose NCCL:

```bash
export NCCL_DEBUG=INFO
export TORCH_NCCL_BLOCKING_WAIT=1
export TORCH_NCCL_ASYNC_ERROR_HANDLING=1
```

## Multiprocessing + CUDA crash

Symptom on Linux: `RuntimeError: Cannot re-initialize CUDA in forked subprocess. To use CUDA with multiprocessing, you must use the 'spawn' start method.`

Cause: parent initialized CUDA (any `torch.cuda.*` or tensor on cuda) before `DataLoader` forked workers. Workers can't use the inherited CUDA context.

Fix:

```python
import torch.multiprocessing as mp
mp.set_start_method("spawn", force=True)
```

Better fix: keep `__getitem__` CPU-only. Workers should never touch CUDA.

## Wrong device error

```
RuntimeError: Expected all tensors to be on the same device, but found at least two devices, cuda:0 and cpu!
```

Likely causes:

- Constants created without explicit device: `torch.tensor([0.0])` defaults to CPU
- A buffer not registered via `register_buffer` (regular attribute doesn't move with `.to(device)`)
- Loss using a tensor on CPU (label tensor not moved)

Audit:

```python
for name, p in model.named_parameters():
    print(name, p.device)
for name, b in model.named_buffers():
    print(name, b.device)
```

## "Trying to backward through the graph a second time"

```
RuntimeError: Trying to backward through the graph a second time, but the saved intermediate results have already been freed.
```

You called `.backward()` twice on the same graph. Common cause: returning the loss tensor up the call stack and then re-backwarding it. Or the same loss tensor referenced from two places.

Fix: `loss.backward(retain_graph=True)` if you genuinely need a second backward (rare), otherwise rebuild the graph (re-run forward).

## In-place op breaks autograd

```
RuntimeError: one of the variables needed for gradient computation has been modified by an inplace operation
```

You wrote `x.add_(1)` (or any `_`-suffixed op) on a tensor that's used downstream in the graph. Remove the in-place op:

```python
# ❌
x.relu_()
# ✅
x = x.relu()    # or x = F.relu(x)
```

## "expected scalar type Float but found Half"

You're using AMP and a custom op didn't get autocasted. The fix is usually to cast explicitly in the op:

```python
def my_custom(x):
    return some_op(x.float()).to(x.dtype)
```

Or wrap the offending region with `with torch.autocast(enabled=False):`.

## Model not learning

If loss is constant or barely moves:

1. `model.train()` actually called? (Print `model.training` to verify)
2. Optimizer parameters match the model? (Did you call `optimizer = AdamW(model.parameters(), ...)` AFTER moving the model to device?)
3. `loss.backward()` called? `optimizer.step()` called?
4. `optimizer.zero_grad()` accidentally between `backward()` and `step()`?
5. LR too low? Try 10x higher and confirm loss moves
6. Layer outputs collapsed? Print one batch's logits — if they're all the same, the model is dead (likely bad init or saturated activation)

## Slow .item() in loop

Symptom: GPU util drops, training feels sluggish, profiler shows many `cudaStreamSynchronize`.

Cause: each `.item()`, `.cpu()`, `.numpy()` blocks until the GPU is done.

Fix: accumulate on device:

```python
# ❌ One sync per batch
running_loss = 0.0
for x, y in loader:
    loss = ...
    running_loss += loss.item()           # SYNCS HERE

# ✅ One sync per epoch
running_loss = torch.zeros(1, device=device)
for x, y in loader:
    loss = ...
    running_loss += loss.detach()
print(running_loss.item() / len(loader))  # sync at end
```

## checkpointing — model loads but accuracy is bad

- Did you call `model.load_state_dict(...)` before or after wrapping in DDP/`torch.compile`?
- Use `model.module.load_state_dict(...)` for DDP-wrapped models
- For compiled models, save the `_orig_mod` state_dict: `model._orig_mod.state_dict()`
- Mismatched keys? `model.load_state_dict(state, strict=False)` reveals missing/unexpected
