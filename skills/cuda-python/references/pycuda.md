# PyCUDA — low-level Python bindings to CUDA driver API

PyCUDA wraps the CUDA driver API directly. Less polished than CuPy, slower cadence, but useful when you have **existing `.cu` source** to wrap or need raw driver-level control without learning the official `cuda-python` bindings.

> In 2026, CuPy `RawKernel` covers ~95% of what PyCUDA used to be needed for, with less ceremony and faster updates. Prefer CuPy unless you're maintaining legacy code or specifically need PyCUDA's `SourceModule` ergonomics.

## Install

```bash
pip install pycuda
```

Requires CUDA Toolkit headers + `nvcc` on PATH at install time (it compiles a C extension). On systems where only the wheel `cupy-cuda12x` is installed, PyCUDA install fails — install the matching CUDA Toolkit first (or use conda-forge).

## Hello-world — autoinit + SourceModule

```python
import pycuda.autoinit            # creates context on import (the gotcha — see below)
import pycuda.driver as drv
from pycuda.compiler import SourceModule
import numpy as np


mod = SourceModule("""
    __global__ void multiply_them(float* dest, const float* a, const float* b) {
        const int i = threadIdx.x + blockIdx.x * blockDim.x;
        dest[i] = a[i] * b[i];
    }
""")

multiply_them = mod.get_function("multiply_them")

a = np.random.randn(400).astype(np.float32)
b = np.random.randn(400).astype(np.float32)
dest = np.empty_like(a)

multiply_them(
    drv.Out(dest), drv.In(a), drv.In(b),
    block=(400, 1, 1), grid=(1, 1)
)
```

`drv.In`, `drv.Out`, `drv.InOut` are direction hints — PyCUDA handles the H2D/D2H transfer transparently. For repeated launches with the same buffers, use `GPUArray` instead (avoids per-call copies).

## GPUArray — analogous to `cupy.ndarray`

```python
import pycuda.autoinit
import pycuda.gpuarray as gpuarray
import numpy as np


a_gpu = gpuarray.to_gpu(np.random.randn(1024).astype(np.float32))
b_gpu = a_gpu * 2.0 + 3.0       # element-wise ops, executed on GPU
print(b_gpu.get())              # D2H copy, returns numpy.ndarray
```

`GPUArray` supports a subset of NumPy operations. For anything beyond `+ - * / **` and basic reductions, fall back to a custom `SourceModule`.

## Manual context management (avoid `autoinit`)

`pycuda.autoinit` creates a primary context on import. This is convenient for scripts but problematic in libraries — it owns the context for the whole process and conflicts with PyTorch / CuPy which also want a primary context.

For libraries:

```python
import pycuda.driver as drv

drv.init()
dev = drv.Device(0)
ctx = dev.make_context()

try:
    # do GPU work
    ...
finally:
    ctx.pop()
    ctx.detach()
```

Even better — when used alongside CuPy/PyTorch — use the primary context they already created:

```python
import pycuda.driver as drv
import cupy as cp

drv.init()
# Attach PyCUDA to the primary context that CuPy initialized
dev = drv.Device(cp.cuda.runtime.getDevice())
ctx = dev.retain_primary_context()
ctx.push()
```

This avoids the multi-context corruption pattern.

## Async + streams

```python
import pycuda.driver as drv

stream = drv.Stream()
multiply_them(
    drv.Out(dest), drv.In(a), drv.In(b),
    block=(400, 1, 1), grid=(1, 1),
    stream=stream
)
stream.synchronize()
```

## When to use PyCUDA in 2026

| Use case | Should you use PyCUDA? |
|---|---|
| Existing `.cu` files in legacy project | Yes — `SourceModule` is convenient |
| New code from scratch | No — use CuPy `RawKernel` |
| Need driver-level API access | No — use `cuda.bindings.driver` |
| Need GPU array ops + custom kernel | No — CuPy covers both |
| Need to wrap a single `.cu` you don't own | Maybe — PyCUDA or CuPy `RawModule` |

## Migration to CuPy `RawKernel`

PyCUDA:

```python
mod = SourceModule("""__global__ void k(float* x) { ... }""")
k = mod.get_function("k")
k(x_gpu, block=(256, 1, 1), grid=(blocks, 1))
```

CuPy equivalent:

```python
k = cp.RawKernel(r'extern "C" __global__ void k(float* x) { ... }', 'k')
k((blocks,), (256,), (x_gpu,))
```

The differences are:

- CuPy requires `extern "C"` (mangling matters)
- CuPy wraps args as a tuple (one extra layer of `()`)
- CuPy compiles via NVRTC, PyCUDA via `nvcc` external process

## Common gotchas

- **`pycuda.autoinit` + PyTorch CUDA = sometimes crashes** — the dual-context corruption is a known issue. Prefer manual context management when other CUDA libraries are present.
- **Compilation is at runtime** — first call has 100–500ms JIT cost. Cache the compiled module in a module-level variable.
- **No automatic version compat shim** — PyCUDA links the driver API directly; old PyCUDA + new CUDA driver sometimes mismatch. Pin tightly.
