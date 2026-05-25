# Numba CUDA — `@cuda.jit` kernels in pure Python syntax

Numba JIT-compiles a subset of Python to PTX. The same source file runs on CPU (via `NUMBA_ENABLE_CUDASIM=1`) and on GPU. Best library for "I need a custom kernel but don't want to write C."

## Install (note: separate package)

```bash
pip install numba-cuda
```

The built-in `numba.cuda` target inside the `numba` package was moved out. Imports stay the same:

```python
from numba import cuda
```

## Minimal kernel — vector add

```python
import numpy as np
from numba import cuda


@cuda.jit
def add_kernel(a, b, out):
    i = cuda.grid(1)
    if i < a.size:
        out[i] = a[i] + b[i]


N = 1_000_000
a = np.random.standard_normal(N).astype(np.float32)
b = np.random.standard_normal(N).astype(np.float32)
out = np.empty_like(a)

# Move to device (or use cuda.to_device explicitly)
d_a = cuda.to_device(a)
d_b = cuda.to_device(b)
d_out = cuda.device_array_like(a)

threads_per_block = 256
blocks_per_grid = (N + threads_per_block - 1) // threads_per_block
add_kernel[blocks_per_grid, threads_per_block](d_a, d_b, d_out)

d_out.copy_to_host(out)
```

The `kernel[blocks, threads](args)` syntax is the launch — bracket-index a kernel with grid dimensions, then call with arguments.

## Thread position

`cuda.grid(ndim)` gives the absolute thread position. Prefer it over manual `threadIdx + blockIdx * blockDim`:

```python
@cuda.jit
def kernel_1d(arr):
    i = cuda.grid(1)              # equivalent to: cuda.threadIdx.x + cuda.blockIdx.x * cuda.blockDim.x
    if i < arr.size:
        arr[i] *= 2


@cuda.jit
def kernel_2d(matrix):
    i, j = cuda.grid(2)
    if i < matrix.shape[0] and j < matrix.shape[1]:
        matrix[i, j] += 1
```

`cuda.gridsize(ndim)` returns the total grid extent in each dimension — useful for the grid-stride-loop pattern:

```python
@cuda.jit
def grid_stride_add(a, b, out):
    start = cuda.grid(1)
    stride = cuda.gridsize(1)
    for i in range(start, a.size, stride):
        out[i] = a[i] + b[i]
```

Grid-stride loops let one kernel launch handle any input size — pick a fixed `(blocks, threads)` (e.g., `128, 256`) and the loop handles the rest.

## Shared memory

```python
from numba import cuda, float32

TPB = 16   # threads per block, one dimension


@cuda.jit
def matmul_shared(A, B, C):
    sA = cuda.shared.array(shape=(TPB, TPB), dtype=float32)
    sB = cuda.shared.array(shape=(TPB, TPB), dtype=float32)

    x, y = cuda.grid(2)
    tx, ty = cuda.threadIdx.x, cuda.threadIdx.y

    if x >= C.shape[0] or y >= C.shape[1]:
        return

    acc = float32(0.0)
    for tile in range(A.shape[1] // TPB):
        sA[tx, ty] = A[x, tile * TPB + ty]
        sB[tx, ty] = B[tile * TPB + tx, y]
        cuda.syncthreads()

        for k in range(TPB):
            acc += sA[tx, k] * sB[k, ty]
        cuda.syncthreads()

    C[x, y] = acc
```

`cuda.shared.array(shape, dtype)` allocates per-block shared memory. `cuda.syncthreads()` is the block-level barrier — every thread in the block waits.

Shared memory size must be a compile-time constant. For dynamic size, use `cuda.shared.array(0, dtype)` and pass the size at launch.

## Atomic operations

```python
@cuda.jit
def histogram(values, bins):
    i = cuda.grid(1)
    if i < values.size:
        b = int(values[i])
        cuda.atomic.add(bins, b, 1)
```

Available: `cuda.atomic.add`, `.sub`, `.and_`, `.or_`, `.xor`, `.exch`, `.max`, `.min`, `.cas` (compare-and-swap), `.inc`, `.dec`. They operate on global or shared memory.

## Device functions

Functions called from kernels (not launched directly):

```python
from numba import cuda


@cuda.jit(device=True, inline=True)
def squared(x):
    return x * x


@cuda.jit
def sum_of_squares(a, out):
    i = cuda.grid(1)
    if i < a.size:
        out[i] = squared(a[i])
```

Device functions return values (unlike kernels, which write to output arrays). Mark with `device=True`.

## Synchronization

```python
cuda.synchronize()              # block until all GPU work done

stream = cuda.stream()
add_kernel[blocks, threads, stream](d_a, d_b, d_out)
stream.synchronize()
```

Streams in Numba look like `cuda.stream()` — pass as the third launch parameter.

## CUDASim — run kernels on CPU for tests

The single most important Numba CUDA feature for CI. Set the env var **before** `numba.cuda` is imported:

```bash
NUMBA_ENABLE_CUDASIM=1 pytest
```

In a pytest fixture:

```python
# conftest.py
import os
import pytest


@pytest.fixture(scope="session", autouse=True)
def enable_cudasim():
    os.environ["NUMBA_ENABLE_CUDASIM"] = "1"
    yield
    os.environ.pop("NUMBA_ENABLE_CUDASIM", None)
```

What the simulator gives you:

- Kernel logic runs in pure Python — one Python thread per CUDA thread
- `print()` works inside kernels
- `pdb.set_trace()` works inside kernels
- Atomics, shared memory, `syncthreads`, device functions all simulated
- `cuda.is_available()` returns True

What the simulator **does not** give you:

- No type checking (mismatches that fail on real GPU pass silently in simulator)
- No warp-level primitives (no `cuda.shfl`, no `cuda.ballot`, no `cuda.match_any`)
- Only one simulated GPU
- Slower by ~1000x — keep test input sizes small

Use simulator for **logic correctness**, not performance. Run real-GPU tests separately on a GPU runner before release.

## Detection — `cuda.is_available()`

```python
from numba import cuda

if cuda.is_available():
    add_kernel[blocks, threads](d_a, d_b, d_out)
else:
    out = a + b   # CPU fallback
```

Note: `cuda.is_available()` returns True under `NUMBA_ENABLE_CUDASIM=1` even without a GPU. Combine with the [optional-dep-pattern](optional-dep-pattern.md) for a unified check across CuPy/Numba/PyTorch.

## Interop with CuPy

A `cupy.ndarray` exposes `__cuda_array_interface__`, so it passes directly to a Numba kernel:

```python
import cupy as cp
from numba import cuda


@cuda.jit
def scale(arr, k):
    i = cuda.grid(1)
    if i < arr.size:
        arr[i] *= k


x = cp.arange(1024, dtype=cp.float32)
scale[4, 256](x, 2.0)
# x is mutated in place on the GPU — no copy
```

## Common gotchas

- **First launch is slow** (NVRTC compile). Warm up before timing.
- **Kernels cannot return values** — write to an output array passed as a parameter.
- **No Python objects inside kernels** — only numeric types, arrays, tuples of these.
- **Bounds checking is your job** — out-of-bounds writes are silent corruption, not exceptions.
- **Shared memory shape must be literal** — `cuda.shared.array((TPB, TPB), ...)` works; `cuda.shared.array((n, n), ...)` where `n` is a variable does not.
- **`cuda.synchronize()` is global** — it blocks all streams. Use stream-scoped sync for parallel pipelines.
