# NumPy 2.x Migration Guide

The 2.0 release was the largest cleanup since 1.0. Code written against 1.x mental models breaks immediately and loudly. This is the single most important reference for an LLM still anchored on 1.x examples.

## Removed type aliases

The single biggest source of `AttributeError` after upgrading. All Python-typed aliases are gone:

| Removed | Replacement |
|---|---|
| `np.int` | Python `int`, or `np.int64` (canonical) |
| `np.bool` | Python `bool`, or `np.bool_` (canonical) |
| `np.float` | Python `float`, or `np.float64` |
| `np.complex` | Python `complex`, or `np.complex128` |
| `np.object` | Python `object`, or `np.object_` |
| `np.str` | Python `str`, or `np.str_` |
| `np.long` | `np.int_` (platform int) or `np.int64` |
| `np.float_` | `np.float64` |
| `np.complex_` | `np.complex128` |
| `np.longfloat` | `np.longdouble` |
| `np.singlecomplex` | `np.complex64` |
| `np.cfloat` | `np.complex128` |
| `np.longcomplex`, `np.clongfloat` | `np.clongdouble` |
| `np.string_` | `np.bytes_` |
| `np.unicode_` | `np.str_` |
| `np.NaN`, `np.NAN` | `np.nan` |
| `np.Inf`, `np.Infinity`, `np.infty` | `np.inf` |
| `np.PINF`, `np.NINF` | `np.inf`, `-np.inf` |

```python
# ❌ Pre-2.0 code — fails with AttributeError in 2.x
arr = np.array([1, 2, 3], dtype=np.int)
mask = np.array([True, False], dtype=np.bool)

# ✅ 2.x — use Python builtin or canonical NumPy name
arr = np.array([1, 2, 3], dtype=int)
arr = np.array([1, 2, 3], dtype=np.int64)
mask = np.array([True, False], dtype=bool)
mask = np.array([True, False], dtype=np.bool_)
```

Note: `np.bool` was re-introduced as a **canonical** dtype name in 2.0 (separate from Python's `bool`). It's an alias for `np.bool_`. Use freely; just don't expect 1.24-era "alias to Python bool" semantics.

## Renamed and removed functions

| Old | New |
|---|---|
| `np.in1d(a, b)` | `np.isin(a, b)` |
| `np.cumproduct(a)` | `np.cumprod(a)` |
| `np.product(a)` | `np.prod(a)` |
| `np.alltrue(a)` | `np.all(a)` |
| `np.sometrue(a)` | `np.any(a)` |
| `np.round_(a)` | `np.round(a)` |
| `np.trapz(y, x)` | `np.trapezoid(y, x)` |
| `np.row_stack(arrs)` | `np.vstack(arrs)` |
| `np.msort(a)` | `np.sort(a, axis=0)` |
| `np.cast[dtype](x)` | `np.asarray(x, dtype=dtype)` |
| `np.source(f)` | `inspect.getsource(f)` |
| `np.lookfor(...)` | (removed — use IDE / docs) |
| `np.who()` | (removed — use IDE variable explorer) |
| `np.asfarray(x)` | `np.asarray(x, dtype=float)` |
| `np.issubsctype(...)` | (removed) |
| `np.find_common_type(...)` | `np.promote_types(...)` / `np.result_type(...)` |
| `np.recfromcsv(f)` | `np.genfromtxt(f, delimiter=',')` |
| `np.recfromtxt(f)` | `np.genfromtxt(f)` |
| `np.geterrobj()` / `np.seterrobj()` / `extobj=` ufunc kwarg | `np.errstate()` |
| `np.compat` submodule | (removed) |
| `numpy.linalg.linalg` submodule | use top-level `numpy.linalg` |
| `numpy.fft.helper` submodule | use top-level `numpy.fft` |
| `numpy.array_api` submodule | main `numpy` namespace (Array API compliant) |

In 2.4 additionally:

- `np.in1d` is fully **removed** (had been deprecated since 1.25)
- `interpolation=` kwarg removed from `np.quantile` / `np.percentile` — use `method=`
- `disp` removed from `np.corrcoef`; `bias` and `ddof` removed
- `np.fix` deprecated — use `np.trunc`
- `numpy.lib.user_array.container` deprecated

## NEP 50 — Dtype promotion changes

The single most subtle breaking change. Pre-NEP-50, NumPy promoted dtypes based on the **values** of inputs; post-NEP-50, promotion is based **only on dtypes** of operands.

```python
# Old behavior (NumPy 1.x):
np.array([1], dtype=np.int8) + 1            # → int8 (small Python int)
np.array([1], dtype=np.int8) + 1000         # → int16 or int32 (large Python int upcasts)
np.float32(1.0) + 1.0                       # → float64 (Python float upcasts)

# New behavior (NEP 50, NumPy 2.x):
np.array([1], dtype=np.int8) + 1            # → int8 — Python scalars no longer upcast
np.array([1], dtype=np.int8) + 1000         # → OverflowError at runtime if value doesn't fit!
np.float32(1.0) + 1.0                       # → float32 — Python float treated as float32 here
```

**Consequences:**

- Code relying on Python-scalar-induced upcasting now silently produces lower-precision results
- Operations that mix `float32` arrays with Python `float` constants now stay `float32` — fine for ML, surprising for general numeric work
- Use explicit casts (`np.asarray(value, dtype=np.float64)`) when you need a specific promotion

For the full promotion table, see https://numpy.org/devdocs/numpy_2_0_migration_guide.html

## Scalar repr changes

NumPy scalars now print with their dtype:

```python
# 1.x
np.float64(3.0)         # repr: 3.0

# 2.x
np.float64(3.0)         # repr: np.float64(3.0)
np.int32(5)             # repr: np.int32(5)
```

**Impact:** code that parses `repr()` of scalars (e.g., writing repr to a log and parsing back) breaks. Fixes:

- Use `str(scalar)` or `f"{scalar!s}"` — still produces `3.0`
- Store structured data (JSON, pickle, parquet) instead of repr
- For temporary 1.x-style output: `np.set_printoptions(legacy='1.25')`

## String truthiness

Old: `np.array(["0"]).astype(bool)` was `[False]` (parsed as int 0).
New: `np.array(["0"]).astype(bool)` is `[True]` (Python `bool('0')` → True).

```python
# To get the old "parse-as-int" semantics:
np.array(["0", "1"]).astype(np.int64).astype(bool)   # → [False, True]
```

## Windows default integer

On 64-bit Windows the default platform integer dtype is now `int64` (was `int32`). Cross-platform code that assumed Windows-specific 32-bit int will silently change behavior.

```python
np.array([1, 2, 3]).dtype         # int64 on ALL 64-bit platforms in 2.x
```

Explicitly pass `dtype=` if you depend on a specific width.

## `numpy.array_api` removed

The experimental submodule used during Array API standardization was removed in 2.0 — the main `numpy` namespace is now Array API compliant. For strict compliance testing, install the separate `array-api-strict` package.

```python
# ❌ Old
from numpy.array_api import asarray

# ✅ New — just use numpy directly
from numpy import asarray
```

## `numpy.round` returns a copy

`np.round` (and `arr.round`) now **always returns a copy**, never a view (changed in 2.4). Mostly transparent, but if you were relying on view aliasing for in-place rounding semantics, switch to explicit assignment.

## C extension changes

- C extensions use PEP 489 multi-phase init — deleting and re-importing `numpy` in the same process is no longer supported
- Some C API symbols renamed; if you maintain a C extension that ships pre-built wheels, rebuild against NumPy 2.x headers
- The single binary built against NumPy 2.x is forward-compatible with later 2.x — a wheel built against 2.0 works on 2.4

## Migration checklist

1. **Grep for removed aliases**: `np\.int\b`, `np\.bool\b`, `np\.float\b`, `np\.object\b`, `np\.str\b`, `np\.complex\b`, `np\.in1d\b`, `np\.trapz\b`, `np\.row_stack\b`, `np\.cumproduct\b`, `np\.product\b`, `np\.alltrue\b`, `np\.sometrue\b`, `np\.round_\b`
2. **Replace with canonical names** (see tables above)
3. **Audit dtype-sensitive code** for NEP 50 surprises — particularly mixed-precision float math
4. **Search for `repr(np.<scalar>)`** patterns — replace with `str()`
5. **Search for `numpy.array_api`** imports — remove, use main `numpy`
6. **Run tests with `-W error::DeprecationWarning`** to catch remaining issues early
