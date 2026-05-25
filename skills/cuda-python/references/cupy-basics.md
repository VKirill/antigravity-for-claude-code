# CuPy basics — drop-in NumPy on GPU

CuPy mirrors the NumPy/SciPy API. Most code works after replacing `np` with `cp`. This file is the working-day reference.

## Import

```python
import cupy as cp
import numpy as np
```

In portable code, prefer the [optional-dep pattern](optional-dep-pattern.md) and import `xp` instead.

## Array creation

```python
x = cp.array([1, 2, 3])              # like np.array
y = cp.zeros((1024, 1024), dtype=cp.float32)
z = cp.empty_like(x)
r = cp.arange(0, 100, 2)
g = cp.random.default_rng(42).standard_normal((512, 512))
```

`cp.asarray(np_arr)` performs the host→device copy. Reading the value back to NumPy:

```python
a_np = cp.asnumpy(x)   # or x.get()
```

Both return a `numpy.ndarray`. `get()` is the method form; `asnumpy()` is the module form — they are equivalent.

## Device selection

```python
with cp.cuda.Device(0):
    a = cp.array([1, 2, 3])         # allocated on device 0

with cp.cuda.Device(1):
    b = cp.array([4, 5, 6])         # allocated on device 1
```

Cross-device operations require an explicit copy:

```python
with cp.cuda.Device(0):
    a = cp.array([1, 2, 3])
with cp.cuda.Device(1):
    b = cp.asarray(a)               # implicit cross-device copy
```

Default device is 0. Set the global default with `cp.cuda.Device(n).use()`.

## Streams — overlap transfer and compute

The default stream synchronizes globally and is fine for most code. For overlap:

```python
stream1 = cp.cuda.Stream(non_blocking=True)
stream2 = cp.cuda.Stream(non_blocking=True)

with stream1:
    a = cp.array(host_data)         # H2D on stream1
    b = a * 2                       # compute on stream1

with stream2:
    c = cp.array(other_data)        # H2D on stream2 — overlaps with stream1
    d = c + 5                       # compute on stream2

stream1.synchronize()
stream2.synchronize()
```

Streams are most useful when you have **pinned** host memory (`cp.cuda.PinnedMemoryPool`) — pageable transfers serialize on the driver regardless of stream.

## Element-wise math (most common case)

```python
a = cp.random.standard_normal(1_000_000, dtype=cp.float32)
b = cp.random.standard_normal(1_000_000, dtype=cp.float32)

c = a * b + cp.sin(a)               # same syntax as NumPy
norm = cp.linalg.norm(c)            # cp.linalg mirrors np.linalg
fft = cp.fft.fft(c)                 # cp.fft mirrors np.fft
```

The first call to any kernel JIT-compiles — expect 100–500ms warmup. Subsequent calls are fast. Measure steady-state, not first-call latency.

## Kernel fusion — `@cp.fuse`

Multiple element-wise ops become one kernel:

```python
@cp.fuse()
def squared_error(pred, target):
    diff = pred - target
    return diff * diff


loss = squared_error(p, t).sum()    # one fused kernel, not three
```

Limitations: only element-wise plus reduce-at-the-end work inside `@cp.fuse`. No branching, no shape changes.

## ElementwiseKernel — declarative custom kernels

```python
squared_diff = cp.ElementwiseKernel(
    in_params='float32 x, float32 y',
    out_params='float32 z',
    operation='z = (x - y) * (x - y)',
    name='squared_diff',
)

a = cp.random.standard_normal(1024, dtype=cp.float32)
b = cp.random.standard_normal(1024, dtype=cp.float32)
out = squared_diff(a, b)
```

Use generic types (`T x, T y, T z`) to support multiple dtypes from one definition.

## ReductionKernel — declarative reductions

```python
l2norm = cp.ReductionKernel(
    in_params='T x',
    out_params='T y',
    map_expr='x * x',
    reduce_expr='a + b',
    post_map_expr='y = sqrt(a)',
    identity='0',
    name='l2norm',
)

n = l2norm(a)
```

## RawKernel — raw CUDA C

Use when you have an existing `.cu` source or need shared memory / warp intrinsics:

```python
add_kernel = cp.RawKernel(r'''
    extern "C" __global__
    void add(const float* a, const float* b, float* out, int n) {
        int i = blockIdx.x * blockDim.x + threadIdx.x;
        if (i < n) out[i] = a[i] + b[i];
    }
''', 'add')

a = cp.arange(1024, dtype=cp.float32)
b = cp.arange(1024, dtype=cp.float32)
out = cp.empty_like(a)

threads_per_block = 256
blocks = (a.size + threads_per_block - 1) // threads_per_block
add_kernel((blocks,), (threads_per_block,), (a, b, out, a.size))
```

`RawKernel` compiles via NVRTC at first call. Cache by reusing the kernel object — don't construct it inside a loop.

## RawModule — share state across kernels

```python
code = r'''
extern "C" __global__ void k1(...) { ... }
extern "C" __global__ void k2(...) { ... }
'''
module = cp.RawModule(code=code)
k1 = module.get_function('k1')
k2 = module.get_function('k2')
```

Both kernels share constant memory, textures, and globals defined in the module.

## Random — pick the right RNG

```python
# Modern API (preferred)
rng = cp.random.default_rng(seed=42)
x = rng.standard_normal(1024)

# Legacy module-level (avoid in new code)
x = cp.random.randn(1024)
```

Seeding the legacy module-level state is global and surprising. Use `default_rng` per call site.

## Common gotchas

- **`cp.array(np_arr)` is cheap, `np.array(cp_arr)` is expensive** — first does a tiny metadata wrap then H2D copy; second triggers a sync + D2H copy.
- **No `cp.array(cp_arr)` no-op short-circuit** — always allocates a new array. Use `cp.asarray` if you want the no-copy path.
- **`cp.ndarray.tolist()` is a synchronization point** — pulls every value to host. Cheap for tiny arrays, expensive for big ones.
- **First call is slow** because of NVRTC JIT compilation. Warm up before benchmarking.
- **Errors are async by default** — a kernel that raises `cudaErrorIllegalAddress` may be reported at the *next* sync point, far from the actual bug. Set `CUPY_DUMP_CUDA_SOURCE_ON_ERROR=1` and use `compute-sanitizer` to trace.

## Synchronization

```python
cp.cuda.Stream.null.synchronize()    # block until default stream done
cp.cuda.Device().synchronize()       # block until current device idle
```

Don't sprinkle `synchronize()` everywhere — it kills async parallelism. Sync only at output boundaries (just before `.get()`, just before logging, just before timing).
