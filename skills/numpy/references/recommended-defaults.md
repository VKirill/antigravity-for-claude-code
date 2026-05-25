# Recommended Defaults

The default knob values, idioms, and patterns to reach for in new NumPy code. These represent the consensus 2.x best practice and avoid known footguns.

## Random number generation

**Always use the modern `Generator` API:**

```python
rng = np.random.default_rng(seed=SEED)
```

| Topic | Default |
|---|---|
| Generator constructor | `np.random.default_rng(seed)` — never `np.random.seed` |
| BitGenerator | `PCG64` (default of `default_rng`); `PCG64DXSM` or `Philox` for parallel |
| Parallel streams | `SeedSequence(seed).spawn(n)` — never split a single Generator |
| `integers(low, high)` | `high` is exclusive by default; pass `endpoint=True` if you want inclusive |
| Reproducible tests | Pass a fixed seed; use a different seed per-test if independence matters |

## Linear algebra

| Operation | Preferred | Avoid |
|---|---|---|
| Solve `Ax = b` | `np.linalg.solve(A, b)` | `np.linalg.inv(A) @ b` |
| Over/underdetermined | `np.linalg.lstsq(A, b, rcond=None)` | Manual normal equations |
| Symmetric/Hermitian eigendecomp | `np.linalg.eigh(A)` | `np.linalg.eig(A)` |
| Positive-definite solve | `cholesky` + `cho_solve` (via SciPy) | `inv` |
| Matrix multiplication | `A @ B` or `np.matmul` | `np.dot` for ndim > 2 |
| Multi-tensor contraction | `np.einsum(..., optimize='optimal')` | Manual chain of matmuls |
| `lstsq` rcond | `rcond=None` (current default) | Implicit (deprecated) |

## Dtypes

| Situation | Default |
|---|---|
| Production array creation | Explicit `dtype=` (don't rely on inference) |
| ML / GPU pipelines | `float32` (memory and speed; precision usually adequate) |
| General numeric work | `float64` |
| Counts, indices | `int64` (cross-platform default in 2.x) |
| Boolean masks | `bool_` (1 byte/element, not 1 bit) |
| Strings (fixed-width) | `'U16'` etc. (`np.str_`) |
| Strings (variable-width) | `np.dtypes.StringDType` (2.x) |
| Mixed Python objects | `object_` — avoid if possible (slow, no GIL release) |

## Casting

| Use | Default |
|---|---|
| Ufunc casting policy | `'same_kind'` (default) |
| Safety-critical cast | `casting='safe'` — raises on lossy conversion |
| Value-preserving cast | `casting='same_value'` (new in 2.4) — runtime check |
| Explicit copy on cast | `.astype(dtype, copy=True)` — explicit even if redundant |

## Memory and contiguity

| Situation | Default |
|---|---|
| Before BLAS-heavy call | `np.ascontiguousarray(arr)` once, reuse |
| Output buffer in tight loop | Pre-allocate, pass as `out=` to ufuncs |
| Need read-only broadcast | `np.broadcast_to(arr, shape)` (no allocation) |
| Need writeable broadcast | `np.broadcast_to(arr, shape).copy()` |
| Need transpose without copy | `arr.T` (view) |

## Aggregations

| Situation | Default |
|---|---|
| Reductions on possibly-NaN data | `nansum`, `nanmean`, `nanmax`, `nanquantile` |
| Percentile method | `method='linear'` (default), or explicit choice |
| Long sums of small floats | `arr.sum(dtype=np.float64)` for stable accumulator |
| Counting truthy | `np.count_nonzero(mask)` not `mask.sum()` |
| Unique values + counts | `np.unique(arr, return_counts=True)` or `np.unique_counts(arr)` |

## IO

| Situation | Default |
|---|---|
| Single array persistence | `np.save(path, arr)` (`.npy`) |
| Multi-array bundle | `np.savez(path, **arrays)` (`.npz`) |
| Loading | `np.load(path)` — never `allow_pickle=True` for untrusted files |
| Larger than RAM | `np.memmap(path, dtype, mode, shape)` |
| Real tabular data | Delegate to **pandas** / **polars** parquet |
| Inter-process exchange | Parquet (typed, schema-validated) — not pickle |

## Type hints

```python
import numpy.typing as npt

def f(arr: npt.NDArray[np.float64]) -> npt.NDArray[np.float64]:
    ...
```

| Situation | Default |
|---|---|
| Generic ndarray | `npt.NDArray[np.float64]` (or other dtype) |
| Dtype-only annotation | `npt.DTypeLike` |
| Array-like input | `npt.ArrayLike` |

## Threading

| Situation | Default |
|---|---|
| Python-level parallelism over NumPy | `ThreadPoolExecutor` — NumPy releases GIL |
| BLAS thread count | Set `OMP_NUM_THREADS=1` when doing Python-level parallelism over BLAS calls (avoid oversubscription) |
| Free-threaded Python (3.13+) | NumPy 2.x continues to improve nogil support; check current state per release |

## Error handling

```python
with np.errstate(over='raise', divide='raise'):
    result = arr / divisor              # raises FloatingPointError on overflow/div-by-zero
```

| Situation | Default |
|---|---|
| Production numeric code | `np.errstate(invalid='raise')` for critical paths |
| Silent overflow tolerance | Default (`warn` for invalid/divide; `ignore` for overflow/underflow) |

## Don't do

| ❌ Anti-pattern | ✅ Use instead |
|---|---|
| `np.random.seed(s) ; np.random.rand(...)` | `np.random.default_rng(s).random(...)` |
| `np.linalg.inv(A) @ b` | `np.linalg.solve(A, b)` |
| `np.in1d(a, b)` | `np.isin(a, b)` |
| `np.matrix(...)` | `np.ndarray` with `@` |
| `dtype=np.int` (removed) | `dtype=int` or `dtype=np.int64` |
| `np.vectorize(f)(arr)` for speed | Real vectorization via ufuncs |
| `for i in range(len(arr)): out[i] = f(arr[i])` | Vectorized expression |
| `arr.mean()` with int64 of length > 2^53 | `arr.sum(dtype=np.float64) / len(arr)` |
| `pickle` for cross-version persistence | `.npy` / parquet |
