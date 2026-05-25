# PyArrow Backend & String Dtype

## What changed in 3.0

- **PyArrow is now a required dependency** (was optional in 2.x)
- The **default string dtype is `str`** (PyArrow-backed) instead of `object`
- `np.nan` is the missing-value sentinel for `str` (consistent with other numpy-backed types)
- New methods: `DataFrame.from_arrow()` / `Series.from_arrow()`, and `__arrow_c_stream__()` for zero-copy interop

## The new default string dtype

```python
import pandas as pd

s = pd.Series(['a', 'b', 'c'])
s.dtype       # 3.0: 'str'   (was 'object' in 2.x)
type(s.dtype) # pandas.core.arrays.string_.StringDtype

# Same for DataFrame columns
df = pd.DataFrame({'name': ['ann', 'bob']})
df.dtypes
# name    str
```

The `str` dtype:
- Stores strings contiguously in memory (PyArrow buffer) → much smaller than `object`
- Vectorized string operations (`.str.contains`, `.str.upper`, etc.) are 2–5× faster
- Cannot hold non-string values — type-safe (object could hold a dict, int, anything)
- Uses `np.nan` for missing values

### Opting out (rare)

If you genuinely need object dtype (e.g., heterogeneous lists in a column):

```python
s = pd.Series(['a', 'b'], dtype=object)
df['weird_col'] = df['weird_col'].astype(object)
```

But this is rare — almost always use `str` (default) or `pd.ArrowDtype('large_string')` for huge string columns.

## The two backend choices

Pandas now has **three** backends for most dtypes:

1. **numpy (legacy)** — `int64`, `float64`, `bool`, `object`, `datetime64[ns]`
2. **numpy_nullable** — `Int64`, `Float64`, `boolean`, `string` (pandas extension arrays)
3. **pyarrow** — `int64[pyarrow]`, `string[pyarrow]`, `timestamp[us, UTC][pyarrow]` etc.

```python
import pandas as pd
import pyarrow as pa

# Explicit pyarrow column
s_arr = pd.Series([1, 2, 3], dtype='int64[pyarrow]')
s_arr = pd.Series([1, 2, 3], dtype=pd.ArrowDtype(pa.int64()))

# List type, struct type, full PyArrow type system available
s_list = pd.Series([[1, 2], [3, 4]], dtype=pd.ArrowDtype(pa.list_(pa.int64())))
s_struct = pd.Series([{'a': 1, 'b': 'x'}], dtype=pd.ArrowDtype(pa.struct([('a', pa.int64()), ('b', pa.string())])))
```

## `convert_dtypes` — promote legacy DataFrames

```python
# Convert all object columns to nullable-typed PyArrow-backed columns in one shot
df2 = df.convert_dtypes(dtype_backend='pyarrow')

df2.dtypes
# user_id          int64[pyarrow]
# name            string[pyarrow]
# amount         double[pyarrow]
# ts        timestamp[us][pyarrow]

# Or stick with pandas nullable types
df2 = df.convert_dtypes(dtype_backend='numpy_nullable')
# dtypes: Int64, Float64, string, ...
```

Use this on legacy 2.x dataframes loaded from CSV/SQL with `object` columns to get the memory and speed wins.

## Reading directly into PyArrow backend

```python
df = pd.read_csv('data.csv', dtype_backend='pyarrow')
df = pd.read_parquet('data.parquet', dtype_backend='pyarrow')
df = pd.read_sql_query(query, engine, dtype_backend='pyarrow')
```

`dtype_backend` defaults to `'numpy_nullable'` for some readers; pass `'pyarrow'` explicitly when you want pyarrow types end-to-end.

## Performance — numpy vs PyArrow backend

Rough rules:

| Operation | numpy (legacy) | PyArrow | Winner |
|---|---|---|---|
| `str.contains`, `str.upper`, etc. | object dtype: very slow | vectorized C++ | **PyArrow** (2–5×) |
| Integer arithmetic | tight C loops | similar | numpy slightly faster for small frames |
| Reading parquet | requires conversion | zero-copy | **PyArrow** |
| Reading CSV | comparable | comparable | tie |
| Memory (string columns) | ~50–100 B/string | ~length + offsets | **PyArrow** (5–10× less) |
| Interop with PyArrow / Polars | requires copy | zero-copy | **PyArrow** |
| sklearn / scipy compatibility | full | partial | numpy |
| Aggregations (sum, mean) | tight C loops | tight C loops | tie |

**Default recommendation**: use `dtype_backend='pyarrow'` for ingest if downstream is pandas/polars/parquet. Use the numpy backend if you immediately hand off to sklearn/scipy/numba (PyArrow types sometimes need conversion).

## Zero-copy Arrow interop (3.0)

```python
import pyarrow as pa

# DataFrame ↔ PyArrow Table (zero-copy if PyArrow-backed)
table = df.__arrow_c_stream__()       # 3.0: standard PyCapsule interface
table_alt = pa.table(df)              # also works

df_back = pd.DataFrame.from_arrow(table)
s = pd.Series.from_arrow(arrow_array)
```

This is the foundation for fast handoff between pandas, polars, DuckDB, and any other Arrow-aware library.

## Gotchas

### Comparing strings

```python
s = pd.Series(['a', 'b', 'c'])     # str dtype
s == 'a'                            # works
s.isin(['a', 'b'])                  # works

# Mixing with object dtype may need explicit conversion
s.astype('string') == old_object_series.astype('string')
```

### Missing values

```python
s_str = pd.Series(['a', None, 'c'])
s_str
# 0      a
# 1    NaN     ← np.nan, not pd.NA (3.0 chose nan for str dtype consistency)
# 2      c
# dtype: str

s_arrow = pd.Series(['a', None, 'c'], dtype='string[pyarrow]')
s_arrow
# 0      a
# 1   <NA>     ← pd.NA for pyarrow-backed
# 2      c
```

`str` uses `np.nan` (3.0 design choice). `pd.ArrowDtype('large_string')` and `'string[pyarrow]'` use `pd.NA`. Pick one across your codebase and stick to it.

### Old code checking `dtype == object` for strings

```python
# BEFORE (2.x)
if df['name'].dtype == 'object':    # was true for strings
    ...

# AFTER (3.0)
if df['name'].dtype == 'str':       # new check
    ...

# Universal check
if pd.api.types.is_string_dtype(df['name']):
    ...
```

`pd.api.types.is_string_dtype` handles all three backends transparently — use it for robust type checks.

## When NOT to use PyArrow backend

- Heavy interop with scipy/sklearn/numba that hasn't yet learned PyArrow types (workaround: `.to_numpy()` at the boundary)
- Custom C extensions that expect contiguous `float64` buffers
- Very small frames where the conversion overhead exceeds operation cost
