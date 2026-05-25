# Tensors and autograd

## Creating tensors

```python
import torch

# From data
torch.tensor([1, 2, 3])                    # dtype inferred (int64)
torch.tensor([1.0, 2.0, 3.0])              # float32
torch.tensor([1, 2, 3], dtype=torch.float32)

# Shapes
torch.zeros(2, 3)
torch.ones(2, 3)
torch.empty(2, 3)                          # uninitialized — fast, garbage values
torch.full((2, 3), fill_value=7.5)
torch.arange(0, 10, 2)                     # [0, 2, 4, 6, 8]
torch.linspace(0, 1, steps=5)              # [0, 0.25, 0.5, 0.75, 1.0]

# Random
torch.randn(2, 3)                          # standard normal
torch.rand(2, 3)                           # uniform [0, 1)
torch.randint(0, 10, (2, 3))

# Like another tensor (matches shape, dtype, device)
torch.zeros_like(x)
torch.empty_like(x)
torch.randn_like(x)
```

Avoid `torch.Tensor(...)` (capital T) — it's a legacy constructor with surprising semantics. Use `torch.tensor(...)` or factory functions.

## Dtypes

| Dtype | Use case |
|---|---|
| `torch.float32` / `torch.float` | default for activations and weights |
| `torch.float64` / `torch.double` | scientific compute, rarely in DL |
| `torch.float16` / `torch.half` | mixed precision on V100 / T4 |
| `torch.bfloat16` | mixed precision on A100, H100, TPU — preferred over fp16 |
| `torch.int64` / `torch.long` | indexing, integer labels |
| `torch.int32` / `torch.int` | image labels, ids, etc. |
| `torch.bool` | masks |
| `torch.uint8` | image bytes, masks |

Cast with `.to(dtype)` or `.float()`, `.long()`, `.bool()`. Never silently mix dtypes in an op — cast explicitly.

## Device placement

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

x = torch.randn(2, 3, device=device)         # create on device
y = torch.randn(2, 3).to(device)             # create then move
z = torch.randn(2, 3, device="cuda:0")       # specific GPU
```

`.to(device, non_blocking=True)` overlaps host→device copy with compute when source is pinned memory (set `pin_memory=True` on `DataLoader`).

## Shape ops — view vs reshape vs permute

```python
x = torch.arange(12).view(3, 4)              # same storage, no copy
x = torch.arange(12).reshape(3, 4)           # copies if needed, view if possible
x = x.permute(1, 0)                          # swap dims — NOT contiguous after
x = x.contiguous()                           # force memory reorder if needed
x = x.unsqueeze(0)                           # add a dim of size 1
x = x.squeeze()                              # remove all size-1 dims
x = x.transpose(0, 1)                        # like permute for 2D
```

`.view` requires the tensor to be contiguous. After `permute`/`transpose` you may need `.contiguous()` before `.view`. `reshape` does this for you transparently.

## Broadcasting

Operations broadcast like NumPy: dims of size 1 are stretched to match.

```python
a = torch.randn(3, 4)
b = torch.randn(4)                            # broadcasts to (1, 4) → (3, 4)
c = a + b                                     # (3, 4)

# Common pattern: per-channel scale
img = torch.randn(N, C, H, W)
mean = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)
img_normalized = (img - mean)                 # broadcasts (1, C, 1, 1) → (N, C, H, W)
```

## Autograd basics

```python
x = torch.tensor([1.0, 2.0, 3.0], requires_grad=True)
y = (x ** 2).sum()
y.backward()                                  # populates x.grad
print(x.grad)                                 # tensor([2., 4., 6.])
```

Rules:

- Only float tensors can have `requires_grad=True`
- `.backward()` is called on a **scalar** (or pass `gradient=` argument)
- `.grad` accumulates across backward calls — zero it via `optimizer.zero_grad()` or `x.grad = None`
- The graph is built dynamically per forward pass; freed after backward unless `retain_graph=True`

## detach, clone, copy

```python
x = torch.randn(3, requires_grad=True)
y = x * 2

z = y.detach()             # same storage, NO graph link — no grad flows back
z2 = y.clone()             # NEW storage, graph preserved — grad flows back
z3 = y.detach().clone()    # NEW storage AND no graph — safe to mutate
```

When you mutate a tensor that participates in a graph in-place, you risk corrupting the backward pass:

```python
# DANGEROUS — y is used downstream, in-place add changes the value backward needs
y.add_(1)

# SAFE — produces new tensor
y = y + 1
```

PyTorch will often raise `RuntimeError: a leaf Variable that requires grad is being used in an in-place operation` to catch this.

## inference_mode vs no_grad

```python
# Old way, still works
with torch.no_grad():
    out = model(x)

# Modern way, faster — disables version counter as well
with torch.inference_mode():
    out = model(x)
```

`inference_mode` is stricter: tensors created inside cannot later be used in autograd. For pure inference paths, prefer it. For mixed (some grads later), use `no_grad`.

## Common pitfalls

- `x.grad` accumulates — always zero before next backward
- Detaching breaks the graph; clone keeps it
- `.item()` triggers a sync — never in hot loops; accumulate on-device
- Tensor on wrong device raises `RuntimeError`; check `.device`
- Integer tensors cannot have grads — cast to float first
