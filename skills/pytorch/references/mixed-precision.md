# Mixed precision (AMP)

Mixed precision runs the forward and backward in a low-precision dtype (`float16` or `bfloat16`) while keeping weights and the optimizer state in `float32`. Throughput typically doubles on Ampere+ GPUs.

## Modern API: `torch.amp`

The legacy `torch.cuda.amp.autocast` / `torch.cpu.amp.autocast` are deprecated. Use device-agnostic `torch.amp.autocast`:

```python
from torch.amp import autocast, GradScaler

with autocast(device_type="cuda", dtype=torch.bfloat16):
    logits = model(x)
    loss = loss_fn(logits, y)
```

Signature: `torch.amp.autocast(device_type, *, dtype=None, enabled=True, cache_enabled=True)`. Pass `device_type="cuda" | "cpu" | "mps" | "xpu"` etc.

## bfloat16 vs float16 — pick the right dtype

| Dtype | Range | Precision | When |
|---|---|---|---|
| `float16` | narrow (~6.5e4 max) | 11 mantissa bits | V100, T4, RTX 20xx (no native bf16) |
| `bfloat16` | float32 range (~3.4e38) | 8 mantissa bits | A100, H100, RTX 30/40/50xx, TPU |

Heuristics:

- bf16 has the same exponent range as fp32 — no overflow during training, no `GradScaler` needed
- fp16 has more precision but limited range — gradients can underflow to zero, hence `GradScaler`
- On A100+ choose bf16. On older hardware, use fp16 + scaler.
- For inference, fp16 is often fine on any modern card.

Check support:

```python
torch.cuda.is_bf16_supported()       # True on A100 / H100 / RTX 30+
```

## bf16: no scaler needed

```python
from torch.amp import autocast

with autocast(device_type="cuda", dtype=torch.bfloat16):
    logits = model(x)
    loss = loss_fn(logits, y)

loss.backward()
optimizer.step()
optimizer.zero_grad(set_to_none=True)
```

That's it. No `GradScaler`, no `scaler.scale(loss)`.

## fp16: use GradScaler

```python
from torch.amp import autocast, GradScaler

scaler = GradScaler()    # device='cuda' default; pass device='cuda' explicitly for clarity

for x, y in loader:
    optimizer.zero_grad(set_to_none=True)
    with autocast(device_type="cuda", dtype=torch.float16):
        logits = model(x)
        loss = loss_fn(logits, y)

    scaler.scale(loss).backward()
    scaler.step(optimizer)        # auto-skips if inf/nan detected
    scaler.update()
```

`GradScaler` multiplies loss by a dynamic scale factor before backward, then unscales gradients before the optimizer step. If grads contain NaN/Inf, the step is skipped and the scale is halved next iteration.

## Combined with clipping

Clip after unscaling:

```python
scaler.scale(loss).backward()
scaler.unscale_(optimizer)
torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
scaler.step(optimizer)
scaler.update()
```

Forgetting `unscale_` means you clip the scaled grads (e.g., 65536x normal) — does nothing useful.

## What `autocast` does and doesn't

- Casts inputs to ops registered for fp16/bf16 (matmul, conv, softmax forward, etc.)
- Keeps outputs in low precision for downstream ops
- Some ops (reductions, normalizations) **stay** in fp32 for numerics
- Does NOT cast model parameters — they stay fp32
- Does NOT wrap backward — backward runs in dtype autocast chose for forward (no explicit `autocast` needed inside the backward call)

## What you should never do

```python
# WRONG — never .half() the model when using autocast
model = MyModel().half().to("cuda")          # ❌
with autocast(...):
    out = model(x)
```

`.half()` puts weights in fp16. Autocast can't see what should be fp32 anymore; mixed precision becomes pure fp16; numerics break for layer norm, softmax, etc.

The correct pattern is `model.to(device)` (keeps fp32) + `autocast(...)` which handles per-op casting.

## CPU autocast

```python
with autocast(device_type="cpu", dtype=torch.bfloat16):
    logits = model(x)
```

Useful on Intel Xeon (AMX) and Apple Silicon. `GradScaler` is not used on CPU bf16.

## MPS autocast

```python
with autocast(device_type="mps", dtype=torch.float16):
    logits = model(x)
```

Coverage is narrower than CUDA. Validate first.

## Common pitfalls

- NaN loss appears immediately with fp16 → check if you forgot `GradScaler`
- Optimizer step skipped repeatedly → grads are infinitely large; lower lr or clip more aggressively
- Loss flat / not decreasing with bf16 → check that lr isn't too low for bf16's reduced precision; bf16 sometimes needs slight lr bump
- `.cpu()` inside autocast region returns fp16 tensor — cast to float32 before passing to NumPy/pandas
- AMP region inside `inference_mode()` is fine for inference; skip the scaler

## Inference with AMP

```python
model.eval()
with torch.inference_mode(), autocast(device_type="cuda", dtype=torch.bfloat16):
    logits = model(x)
    probs = torch.softmax(logits, dim=-1)
```

Cast probs to fp32 if your downstream code (NumPy / pandas) doesn't handle bf16:

```python
probs_np = probs.float().cpu().numpy()
```
