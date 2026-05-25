# Performance

NumPy is fast when you let it do the work in C. Slow NumPy is almost always Python-loop NumPy. The hierarchy of speedup techniques, in order of priority:

1. Vectorize — replace Python loops with whole-array ops
2. Avoid copies — use views and `out=` buffers
3. Ensure contiguity for BLAS-heavy paths
4. Use `np.einsum` with `optimize=True` for multi-tensor work
5. Profile before optimizing — don't guess

## Vectorization

The single biggest lever. Replace `for` loops over array elements with a single ufunc call.

```python
# ❌ Python loop — slow
out = np.empty_like(arr)
for i in range(len(arr)):
    out[i] = arr[i] ** 2 + 3 * arr[i] - 1

# ✅ Vectorized — one ufunc chain, all C
out = arr ** 2 + 3 * arr - 1
```

Typical speedup: 50–500×. The Python interpreter overhead alone is ~100 ns/iter, so a loop over 1M elements wastes ~100 ms before any actual math.

## Pre-allocate with `out=`

If you do need a loop (e.g. iterating over batches), pre-allocate the output and pass it as `out=` to ufuncs:

```python
# ❌ Allocates a new array every iteration
result = np.zeros(N)
for batch in batches:
    result += process(batch)

# ✅ Reuse the same output buffer
result = np.zeros(N)
tmp = np.empty(batch_size)
for batch in batches:
    np.multiply(batch, factor, out=tmp)
    np.add(result, tmp, out=result)
```

## Contiguity

NumPy arrays have **strides**. Contiguous arrays (`flags['C_CONTIGUOUS']` or `'F_CONTIGUOUS'`) are laid out without gaps; BLAS routines require contiguous input and will silently copy non-contiguous arrays before calling LAPACK. For repeated heavy work, force contiguity once:

```python
A = some_array.T                           # transpose → not C-contiguous
np.linalg.solve(A, b)                       # internally copies A — slow if A is large

A = np.ascontiguousarray(some_array.T)     # explicit copy to C-contiguous; do once
np.linalg.solve(A, b)                       # now no internal copy
```

Use `np.asfortranarray` for column-major contiguity (some LAPACK routines prefer this).

When indexing or reshaping, NumPy may or may not return a contiguous view depending on the operation. `arr.flags` shows you immediately.

## Views vs copies for performance

- Basic slicing returns a view — free
- Fancy indexing copies — pay the cost
- `arr.reshape(...)` returns a view if possible, copy if not — `arr.copy().reshape(...)` if you need a copy
- `arr.T` is a view with swapped strides — extremely cheap

## `np.einsum` for tensor contractions

For multi-array sum-product expressions, einsum can beat naive chains of matmul because:

1. It encodes the full contraction in one call (less Python overhead)
2. With `optimize='optimal'`, it picks a contraction order that minimizes flops

```python
# Compute the full chain A B C D — order of multiplication matters a lot
result = np.einsum('ij,jk,kl,lm->im', A, B, C, D, optimize='optimal')

# Inspect the chosen path
path, info = np.einsum_path('ij,jk,kl,lm->im', A, B, C, D, optimize='optimal')
print(info)
```

For two-tensor contractions, plain `@` / `np.matmul` is usually fastest because it goes directly to optimized GEMM.

## Avoiding huge intermediates

Broadcasting can silently allocate enormous temp arrays:

```python
# ❌ Allocates (N, N) intermediate for a 1D result
N = 100_000
a = np.arange(N)
result = (a[:, None] - a[None, :]) ** 2          # N x N matrix — 80 GB at float64!

# ✅ Often there's a closed form that avoids the full pairwise expansion
# For sum of pairwise squared diffs: 2*N*sum(a**2) - 2*sum(a)**2
```

When a result requires pairwise data but ends up reduced (sum, max, dot product), look for the analytic shortcut or use `np.einsum`.

## Profiling

```python
# cProfile — function-level
import cProfile
cProfile.run('my_func(arr)', sort='cumulative')

# line_profiler — line-level (pip install line_profiler)
@profile               # decorator picked up by `kernprof`
def my_func(arr):
    ...
# Run: kernprof -l -v script.py

# memory_profiler — allocations (pip install memory_profiler)
@profile
def my_func(arr):
    ...
# Run: python -m memory_profiler script.py
```

For micro-benchmarks use `timeit`:

```python
%timeit np.linalg.solve(A, b)           # in IPython/Jupyter
# or
import timeit
timeit.timeit(lambda: np.linalg.solve(A, b), number=100)
```

## GIL and threading

Most NumPy ufuncs and all BLAS calls **release the GIL** while running in C. This means:

- A `ThreadPoolExecutor` with N workers can give near-linear speedup on independent NumPy ops
- This is unusual for Python — most libraries are GIL-bound
- The free-threaded build of Python 3.13+ (PEP 703) makes this even more attractive

```python
from concurrent.futures import ThreadPoolExecutor

with ThreadPoolExecutor(max_workers=8) as pool:
    results = list(pool.map(lambda x: np.linalg.eigvalsh(x), matrices))
```

Note: BLAS (OpenBLAS, MKL) is itself multi-threaded by default. If you're spawning N Python threads each running BLAS, you may oversubscribe CPU cores. Set `OMP_NUM_THREADS=1` (or `OPENBLAS_NUM_THREADS=1`) when doing Python-level parallelism over BLAS calls.

## Numerical precision tips

- `float32` is ~2× faster than `float64` for memory-bound work; ~1.5× for CPU-bound. ML often uses float32.
- For very long sums of small floats, prefer `np.sum(arr, dtype=np.float64)` even if input is float32 — accumulator dtype prevents catastrophic precision loss.
- `np.einsum` with `optimize=True` allocates intermediate arrays as the smallest stable dtype — pass `dtype=` explicitly if you need a wider accumulator.

## When NumPy isn't enough

- True elementwise compiled code: **Numba** `@njit`, **Cython**, or write a C extension
- GPU: **CuPy** (drop-in NumPy API on CUDA) — see the `cuda-python` skill
- Autograd / GPU training: **PyTorch** — see the `pytorch` skill
- Out-of-core / streaming: **Dask Array** or **Polars** (for table-shaped data)
