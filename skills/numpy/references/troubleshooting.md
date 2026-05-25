# Troubleshooting

Common NumPy errors and surprising behaviors, with diagnostic steps.

## `AttributeError: module 'numpy' has no attribute 'int'`

(or `bool`, `float`, `object`, `str`, `complex`, `in1d`, `cumproduct`, `trapz`, ...)

**Cause**: removed in NumPy 2.0. Code was written against 1.x.

**Fix**: see [v2-migration.md](v2-migration.md) for the full table. Most common:

```python
np.int        → int  (or np.int64)
np.float      → float  (or np.float64)
np.bool       → bool  (or np.bool_)
np.in1d       → np.isin
np.trapz      → np.trapezoid
np.cumproduct → np.cumprod
np.row_stack  → np.vstack
```

## `ValueError: operands could not be broadcast together`

```
ValueError: operands could not be broadcast together with shapes (3,4) (5,)
```

**Cause**: incompatible shapes for broadcasting.

**Diagnose**: right-align the shapes:
```
(3, 4)
   (5,)
```
Trailing 4 vs 5 — not equal, neither is 1 → fail.

**Fix**: usually means a transpose was forgotten or an axis needs adding. Try `b[:, None]` or `b[None, :]` or `b.T`. See [broadcasting.md](broadcasting.md).

## Mutation propagates unexpectedly (view bug)

```python
sub = arr[1:5]
sub[0] = 999
# arr[1] is now 999 — surprise!
```

**Cause**: basic slicing returns a view. Mutating the slice mutates the source.

**Fix**: add `.copy()` if you want independence:
```python
sub = arr[1:5].copy()
```

The reverse trap: fancy indexing returns a copy, so:
```python
arr[arr > 0] *= 2     # works — buffered assignment through mask
result = arr[arr > 0]
result *= 2           # does NOT mutate arr — result is a copy
```

## Dtype silently changed to `float64`

```python
arr = np.array([1, 2, 3], dtype=np.float32)
arr + 0.5            # dtype is now... still float32 in 2.x (NEP 50)
arr + np.array([0.5])  # ... but this could be float64 depending on inputs
arr.sum()            # dtype is float32 (no upcast)
arr.mean()           # internally upcasts to float64 for accuracy, returns float64
```

**Cause**: NEP 50 promotion rules are subtle. Some reductions auto-upcast their accumulator for stability.

**Fix**: be explicit about dtype in production:
```python
arr.sum(dtype=np.float64)     # explicit accumulator
arr.astype(np.float64).mean() # explicit input cast
```

## NaN poisons everything

```python
arr = np.array([1.0, 2.0, np.nan, 4.0])
arr.sum()    # → nan
arr.max()    # → nan
arr == np.nan  # → [False, False, False, False] — NaN never equals anything!
```

**Diagnose**: `np.isnan(arr)` to detect NaN. `np.any(np.isnan(arr))` for a quick check.

**Fix**: use NaN-aware variants when intentional:
```python
np.nansum(arr)        # ignores NaN
np.nanmean(arr)
np.nanargmax(arr)
```

For testing: `np.isnan(x)` not `x == np.nan`.

## `OverflowError` on Python scalar in NEP 50

```python
np.array([1], dtype=np.int8) + 1000
# OverflowError: Python integer 1000 out of bounds for int8
```

**Cause**: NEP 50 — Python scalars no longer upcast the array dtype. The value 1000 doesn't fit in int8.

**Fix**: cast explicitly:
```python
np.array([1], dtype=np.int8).astype(np.int64) + 1000
# or
np.array([1], dtype=np.int8) + np.int64(1000)
```

## "Truth value of array is ambiguous"

```python
arr = np.array([1, 2, 3])
if arr > 0:    # ValueError: The truth value of an array with more than one element is ambiguous.
    ...
```

**Fix**: collapse to a scalar boolean:
```python
if (arr > 0).all():   # or .any()
    ...
```

Or use `np.where`:
```python
np.where(arr > 0, arr, -arr)   # element-wise conditional
```

## `np.random.seed()` does nothing for code using `default_rng`

```python
np.random.seed(42)
rng = np.random.default_rng()
rng.random(5)    # NOT reproducible — uses fresh OS entropy
```

**Cause**: `default_rng()` ignores the global state set by `np.random.seed`.

**Fix**: pass the seed to `default_rng`:
```python
rng = np.random.default_rng(42)
```

## Slow code — suspect Python loops

If a NumPy operation feels orders-of-magnitude slower than expected, ask:

1. Is there a `for` loop iterating over array elements? → vectorize
2. Is `apply` / `vectorize` used? → rewrite as ufunc expression
3. Is the data dtype `object`? → coerce to a numeric dtype
4. Is the array non-contiguous before BLAS? → `np.ascontiguousarray`
5. Are huge intermediates being allocated by broadcasting? → check `.shape` of each step
6. Is BLAS oversubscribing with Python threads? → set `OMP_NUM_THREADS=1`

See [performance.md](performance.md).

## `LinAlgError: Singular matrix`

```python
np.linalg.solve(A, b)
# LinAlgError: Singular matrix
```

**Cause**: `A` is singular or near-singular. `np.linalg.solve` requires invertible `A`.

**Diagnose**:
```python
np.linalg.cond(A)        # if > 1/eps, effectively singular
np.linalg.matrix_rank(A) # if < n, rank-deficient
```

**Fix**:
- If `A` is rectangular or rank-deficient by design → use `np.linalg.lstsq(A, b, rcond=None)` (least squares)
- If `A` should be PD → use `np.linalg.cholesky(A)` (will fail loudly if not PD)
- If `A` is just ill-conditioned → regularize (add `lambda * I`) before solving

## DeprecationWarning that disappears with `-W error`

```python
# Code seems fine but tests fail under -W error::DeprecationWarning
arr.strides = (8, 4)        # deprecation
```

**Cause**: NumPy 2.4 deprecated several APIs that worked silently in earlier 2.x.

**Fix**: heed the warning. For `strides`, use `np.lib.stride_tricks` or pass strides to the `np.ndarray` constructor.

## `np.load` raises `ValueError: Object arrays cannot be loaded when allow_pickle=False`

**Cause**: the `.npy` file contains an object-dtype array, which requires pickle to deserialize.

**Fix**:
- If you trust the file: `np.load(path, allow_pickle=True)` — but never on untrusted input!
- Better: re-save the source data with a numeric dtype, or use parquet for heterogeneous data

## Performance regression after upgrading NumPy

If something got slower after a NumPy upgrade:

1. Check `np.show_config()` — BLAS may have changed (OpenBLAS vs MKL vs Accelerate)
2. Check thread count: `os.environ['OPENBLAS_NUM_THREADS']`
3. Check for hidden `object` dtype creeping in via `pd.NA` or Arrow extension types
4. Profile with `line_profiler` to find the slow path

## Reproducibility issue across machines

Two machines, same seed, different results:

- Different BLAS library: solver routines can produce bit-different results (still correct)
- Different NumPy major version: random streams may differ between major versions
- Different CPU SIMD: `X86_V2` vs `X86_V3` vs `X86_V4` paths can produce bit-different float reductions

For bit-exact reproducibility across machines, pin NumPy version AND BLAS library, and consider `np.errstate(over='raise')` to catch subtle differences early.
