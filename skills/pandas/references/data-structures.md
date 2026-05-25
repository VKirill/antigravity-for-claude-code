# Data Structures & Dtypes

## Series and DataFrame

```python
import pandas as pd
import numpy as np

# Series: 1D labeled array
s = pd.Series([1, 2, 3], index=['a', 'b', 'c'], name='counts')

# DataFrame: 2D labeled table (dict of arrays)
df = pd.DataFrame({
    'user_id': [1, 2, 3, 4],
    'name':    ['ann', 'bob', 'cara', 'dan'],   # → str dtype (PyArrow-backed) in 3.0
    'amount':  [10.5, 20.0, np.nan, 15.0],
    'ts':      pd.to_datetime(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']),
})

df.dtypes
# user_id              int64
# name                   str       <- new in 3.0 (was object)
# amount             float64
# ts        datetime64[us]         <- new in 3.0 (was [ns])
```

## Index and MultiIndex

```python
# Single-level Index
idx = pd.Index([10, 20, 30], name='order_id')

# MultiIndex from tuples
mi = pd.MultiIndex.from_tuples(
    [('2026-01', 'US'), ('2026-01', 'EU'), ('2026-02', 'US')],
    names=['month', 'region']
)
df = pd.DataFrame({'rev': [100, 200, 150]}, index=mi)

df.index.names                # ['month', 'region']
df.index.get_level_values(0)  # Index(['2026-01', '2026-01', '2026-02'], name='month')

# From product
months = pd.period_range('2026-01', periods=3, freq='M')
regions = ['US', 'EU']
mi = pd.MultiIndex.from_product([months, regions], names=['month', 'region'])
```

`MultiIndex` enables hierarchical labels — see [indexing-and-selection.md](indexing-and-selection.md) for slicing.

## dtypes — the four families

### 1. NumPy-backed (legacy)
- `int64`, `float64`, `bool` — fast but can't hold `NA` (ints coerce to float on missing)
- `object` — used to be default for strings; **no longer default in 3.0**
- `datetime64[ns]` / `[us]` / `[ms]` / `[s]` — see datetime resolution below

### 2. Pandas extension (nullable)
- `Int64`, `Int32`, `Int16`, `Int8` and unsigned counterparts — capital letter → nullable
- `Float64`, `Float32` — nullable floats, `pd.NA` propagation
- `boolean` — three-valued: True / False / `pd.NA`
- `string` — legacy nullable string (now mostly superseded by 3.0 `str`)

```python
s = pd.Series([1, 2, None, 4], dtype='Int64')   # holds NA without float coercion
s.dtype                                          # Int64
s + 1                                            # <Int64> [2, 3, <NA>, 5]
```

### 3. PyArrow-backed (pandas 3.0 default for strings)
- `str` — new 3.0 default for string columns (PyArrow under the hood, falls back to numpy object if PyArrow missing)
- `pd.ArrowDtype('int64[pyarrow]')`, `'timestamp[us, UTC][pyarrow]'`, etc. — full PyArrow type system

```python
s = pd.Series(['a', 'b', 'c'])           # 3.0: dtype 'str'
s = pd.Series([1, 2, 3], dtype='int64[pyarrow]')   # explicit Arrow-backed int
s = pd.Series([], dtype=pd.ArrowDtype('list<int64>'))
```

See [arrow-backend.md](arrow-backend.md) for performance and conversion patterns.

### 4. Categorical
- `CategoricalDtype(categories=[...], ordered=True|False)` — see [categorical.md](categorical.md)

## Datetime resolution in 3.0

Pandas 2.x always used `datetime64[ns]`. **3.0 infers resolution**:

```python
pd.to_datetime(['2024-03-22 11:36']).dtype   # datetime64[us]   (not [ns])
pd.to_datetime([0], unit='s').dtype          # datetime64[s]
pd.to_datetime([0], unit='ms').dtype         # datetime64[ms]
pd.Series([datetime.now()]).dtype            # datetime64[us]
pd.to_datetime(['2024-01-01 00:00:00.000000001']).dtype  # datetime64[ns]  (ns detected)

# Force a specific resolution if you need to round-trip with legacy data:
ts = pd.to_datetime(df['ts']).astype('datetime64[ns]')
```

**Gotcha**: concatenating a `[us]` series with a `[ns]` series triggers a unit promotion — keep your time columns at the same resolution across an ETL.

## Inspecting structure

```python
df.shape           # (4, 4)
df.dtypes          # column dtype map
df.info()          # full summary incl. memory
df.memory_usage(deep=True)   # bytes per column (deep=True for object/str)
df.describe()      # numeric summary
df.head(3); df.tail(3)
df.columns; df.index
```

## Constructing — common patterns

```python
# From list of dicts (records)
pd.DataFrame([
    {'a': 1, 'b': 'x'},
    {'a': 2, 'b': 'y'},
])

# From NumPy array
pd.DataFrame(np.random.randn(5, 3), columns=['a', 'b', 'c'])

# Empty DataFrame with typed columns
pd.DataFrame({
    'id':   pd.Series(dtype='Int64'),
    'name': pd.Series(dtype='str'),
    'ts':   pd.Series(dtype='datetime64[us]'),
})

# From dict of Series (aligns on index)
pd.DataFrame({'x': s1, 'y': s2})
```

## Conversion

```python
# Promote object-string to PyArrow strings + nullable numerics in one shot
df2 = df.convert_dtypes(dtype_backend='pyarrow')

# Force a single column
df['amount'] = df['amount'].astype('Float64')

# Datetime parsing with explicit format (fast path, no inference)
df['ts'] = pd.to_datetime(df['ts'], format='%Y-%m-%d')

# Categorical
df['region'] = df['region'].astype('category')
```
