# Interop — moving data between libraries without copies

CuPy, PyTorch, Numba, JAX, TensorFlow, RAPIDS — all live on the same GPU memory. Two standards govern zero-copy exchange. Use the right one and you'll never copy. Use the wrong one and you'll silently double memory usage.

## The two standards

| Standard | Origin | Protocol | Coverage |
|---|---|---|---|
| `__cuda_array_interface__` | Numba | dict-of-pointers attribute | CuPy, Numba, PyTorch, RAPIDS |
| **DLPack** | Apache TVM, now Array API standard | `__dlpack__()` method + capsule | CuPy, PyTorch, JAX, TensorFlow, NumPy (host), pandas (host) |

**Prefer DLPack** when both sides support it. DLPack carries stream-safety info (`__dlpack__(stream=...)`), so the receiver can correctly synchronize. `__cuda_array_interface__` leaves stream coordination to the user.

## CuPy ↔ PyTorch — zero-copy

```python
import cupy as cp
import torch


# CuPy → Torch
x_cp = cp.arange(1024, dtype=cp.float32)
x_pt = torch.from_dlpack(x_cp)              # zero copy, shares memory
x_pt += 1.0
assert (x_cp == x_pt.detach().cpu().numpy()).all() is False  # x_cp also mutated

# Torch → CuPy
y_pt = torch.randn(1024, device="cuda")
y_cp = cp.from_dlpack(y_pt)                 # zero copy
```

Critical invariants:

1. Both libraries must be built against the **same CUDA major** — mixing `cupy-cuda12x` with PyTorch-cu130 silently corrupts.
2. After `from_dlpack`, the producer must not free the underlying memory until the consumer is done. Lifetime extends through the DLPack capsule.
3. The PyTorch tensor and CuPy array do not share strides metadata — re-stride only the side you operate on.

## CuPy ↔ Numba — `__cuda_array_interface__`

```python
import cupy as cp
from numba import cuda


@cuda.jit
def scale(arr, k):
    i = cuda.grid(1)
    if i < arr.size:
        arr[i] *= k


x = cp.arange(1024, dtype=cp.float32)
# CuPy array exposes __cuda_array_interface__, so Numba accepts it directly
scale[4, 256](x, 2.0)
# x is mutated in place
```

The protocol is invisible at the call site — Numba reads `x.__cuda_array_interface__` to get the pointer/shape/dtype/strides. No copy.

## CuPy ↔ NumPy — host-device transfer (not zero-copy)

```python
import numpy as np
import cupy as cp


x_np = np.arange(1024, dtype=np.float32)
x_cp = cp.asarray(x_np)                     # H2D copy

# Back to host
x_back = cp.asnumpy(x_cp)                   # D2H copy
# or
x_back = x_cp.get()                         # equivalent
```

For repeated round-trips, use **pinned** host memory (see [memory-management.md](memory-management.md)) — async transfers become 2-3x faster.

## CuPy ↔ Polars / pandas via Arrow

Polars and pandas use Apache Arrow as their memory format. Arrow is **CPU-only** — no zero-copy path to GPU. Two options:

**Option A**: D2H → Arrow → DataFrame

```python
import cupy as cp
import polars as pl

arr_gpu = cp.random.standard_normal((10000, 5))
arr_cpu = cp.asnumpy(arr_gpu)
df = pl.DataFrame(arr_cpu, schema=[f"col_{i}" for i in range(5)])
```

**Option B**: DataFrame → NumPy → CuPy

```python
arr_np = df.to_numpy()
arr_gpu = cp.asarray(arr_np)
```

Both involve a D2H or H2D transfer; neither is zero-copy. For true GPU DataFrames, use the RAPIDS `cudf` library (out of scope here).

## DLPack with explicit stream

```python
import cupy as cp
import torch

stream = cp.cuda.Stream()
with stream:
    x_cp = cp.zeros(1024, dtype=cp.float32)
    # Hand off to torch, telling it which stream we used
    x_pt = torch.from_dlpack(x_cp.__dlpack__(stream=stream.ptr))
```

The `stream=` kwarg on `__dlpack__` tells the consumer "this data is ordered on this stream; sync your work on it before reading." Required for correctness in multi-stream pipelines.

## Stream interop — wrap a PyTorch stream in CuPy

```python
import cupy as cp
import torch

torch_stream = torch.cuda.Stream()
ext = cp.cuda.ExternalStream(torch_stream.cuda_stream)

with ext:
    a = cp.arange(1024)                     # runs on the torch stream
    a += 1
```

Now CuPy ops sequence behind any torch ops on that stream. Inverse direction (CuPy stream wrapped for torch) is not directly supported — use a fresh `torch.cuda.Stream(stream_id=cp_stream.ptr)`.

## TensorFlow

TensorFlow supports DLPack via `tf.experimental.dlpack`:

```python
import tensorflow as tf
import cupy as cp

x_cp = cp.arange(1024, dtype=cp.float32)
x_tf = tf.experimental.dlpack.from_dlpack(x_cp.__dlpack__())
```

Same CUDA major caveat applies.

## RMM — RAPIDS Memory Manager

RAPIDS ships `rmm` for pool-managed allocation. CuPy can route allocations through it:

```python
import rmm
import cupy as cp

rmm.reinitialize(pool_allocator=True)
cp.cuda.set_allocator(rmm.RMMNumbaManager())
# Now CuPy allocates from the rmm pool; shared with cuDF, cuML, etc.
```

Use this when you mix CuPy with the RAPIDS stack — single pool, no double-allocation.

## NumPy → DLPack (CPU side)

```python
import numpy as np
x = np.arange(1024)
caps = x.__dlpack__()      # host-side DLPack capsule

import cupy as cp
x_gpu = cp.from_dlpack(caps)   # initiates H2D copy
```

DLPack works for host data too, but the H2D transfer is implicit when the consumer is GPU-side.

## __array_function__ — call NumPy APIs with CuPy arrays

CuPy arrays implement `__array_function__`, so some NumPy module-level functions dispatch to the GPU automatically:

```python
import numpy as np
import cupy as cp

x = cp.arange(1024, dtype=cp.float32)
np.fft.fft(x)                 # dispatches to cp.fft.fft via protocol
```

Not all NumPy functions delegate; check support before relying on it. The explicit `cp.fft.fft(x)` is safer.

## Decision summary

| From → To | Method | Zero-copy? |
|---|---|---|
| CuPy → PyTorch | `torch.from_dlpack(cp_arr)` | Yes |
| PyTorch → CuPy | `cp.from_dlpack(torch_tensor)` | Yes |
| CuPy → Numba | Pass directly (CUDA Array Interface) | Yes |
| Numba dev array → CuPy | `cp.asarray(numba_arr)` | Yes |
| CuPy → NumPy | `cp.asnumpy(x)` / `x.get()` | No (D2H) |
| NumPy → CuPy | `cp.asarray(np_arr)` | No (H2D) |
| CuPy → JAX | `jax.dlpack.from_dlpack(cp_arr.__dlpack__())` | Yes |
| CuPy → TF | `tf.experimental.dlpack.from_dlpack(cp_arr.__dlpack__())` | Yes |
| CuPy → cuDF | Via RMM shared allocator | Yes |
| CuPy → Polars | Via NumPy intermediate | No |
| CuPy → pandas | Via NumPy intermediate | No |
