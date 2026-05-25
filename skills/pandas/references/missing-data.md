# Missing Data

## The two sentinels: `NaN` vs `pd.NA`

| Sentinel | Used by | Propagation | Semantics |
|---|---|---|---|
| `np.nan` (float NaN) | numpy-backed (`int64` coerces to `float64`, `float64`, `object`, `str` in 3.0) | `nan + 1 == nan` (math) | "Not a Number" — historically used for everything |
| `pd.NA` | nullable extension dtypes (`Int64`, `Float64`, `boolean`, `string[pyarrow]`) | All operations propagate (`pd.NA & False == pd.NA`) | "Missing" — three-valued logic |

**3.0 unifies behavior**: in nullable Float64 and pyarrow dtypes, `NaN` is now treated equivalent to `NA`. Arithmetic that produces `NaN` now produces `NA`. This makes nullable dtypes more consistent.

## Detection

```python
df.isna()           # element-wise — True where missing
df.notna()          # element-wise — True where present
df.isna().any()     # any missing in each column
df.isna().sum()     # count of missing per column
df.isna().any(axis=1)   # rows with any missing
```

`isnull` / `notnull` are aliases for `isna` / `notna`. Use the modern names.

## Dropping

```python
df.dropna()                            # drop any row with ANY NaN
df.dropna(how='all')                   # drop rows where ALL columns are NaN
df.dropna(subset=['amount', 'ts'])     # only consider these columns
df.dropna(thresh=3)                    # keep rows with ≥ 3 non-NaN values
df.dropna(axis=1, how='all')           # drop entirely-empty columns
```

## Filling

```python
# Constant
df['amount'] = df['amount'].fillna(0)
df.fillna({'amount': 0, 'name': 'unknown', 'ts': pd.NaT})    # per-column

# Forward / backward
df.ffill()       # forward-fill (carry last value down)
df.bfill()       # backward-fill
df.ffill(limit=3)   # max 3 consecutive fills

# Group-aware fill
df['amount'] = df.groupby('user_id')['amount'].ffill()

# Interpolation (numeric only)
df['value'] = df['value'].interpolate(method='linear')
df['value'] = df['value'].interpolate(method='time')       # uses time-index spacing
df['value'] = df['value'].interpolate(method='spline', order=3)
```

**3.0 deprecation**: `fillna(method='ffill')` is deprecated — use `df.ffill()` directly.

## Nullable integer dtype (no float coercion)

```python
# numpy int64 + missing = float (data loss!)
s = pd.Series([1, 2, None, 4])
s.dtype    # float64
s         # [1.0, 2.0, NaN, 4.0]

# Nullable Int64 keeps integer semantics
s = pd.Series([1, 2, None, 4], dtype='Int64')
s.dtype    # Int64
s         # [1, 2, <NA>, 4]
s + 1     # [2, 3, <NA>, 5]
```

Always use capital-letter nullable dtypes (`Int64`, `Float64`, `boolean`) when missingness is semantic in integer/boolean columns.

## Boolean indexing with missing values

`pd.NA` is **truthy-ambiguous** — boolean masks with `pd.NA` raise:

```python
s = pd.Series([True, False, pd.NA], dtype='boolean')

df[s]    # TypeError: boolean value of NA is ambiguous

# Fix: fill before indexing
df[s.fillna(False)]
```

This is intentional — three-valued logic forces you to declare intent.

## `str.contains` and friends — `na=` parameter

`Series.str.contains` returns `NaN` for missing strings, which breaks `df[mask]`:

```python
mask = df['name'].str.contains('an')
df[mask]     # ValueError if any NaN in mask

# Always pass na=False (or na=True for inclusive)
mask = df['name'].str.contains('an', na=False)
df[mask]     # works
```

Same for `str.startswith`, `str.endswith`, `str.match`, `str.fullmatch`, etc. **Always pass `na=`** in production code.

## Replacing

```python
df.replace({'unknown': pd.NA, '': pd.NA, 'N/A': pd.NA})
df['amount'].replace([np.inf, -np.inf], pd.NA)

# Regex replace
df['phone'].replace(r'[^\d]', '', regex=True)
```

## NaT for datetimes

Datetime missing values are `pd.NaT` (Not a Time):

```python
pd.Series([pd.Timestamp('2026-01-01'), pd.NaT, pd.Timestamp('2026-01-03')])
# dtype: datetime64[us]
# isna() and notna() both work on NaT
```

## `value_counts` includes / excludes NaN

```python
s.value_counts()              # excludes NaN by default
s.value_counts(dropna=False)  # includes NaN as its own bucket
```

## Reductions skip NaN by default

```python
s.sum()                # skips NaN
s.sum(skipna=False)    # NaN propagates → result is NaN
s.mean()               # skips NaN
s.count()              # non-NaN count (different from len(s))
len(s)                 # total length including NaN
```

For groupby, `dropna=False` keeps NaN as its own group:

```python
df.groupby('region', dropna=False).agg(...)
```

## Common patterns

### Coalesce — first non-null

```python
df['contact'] = df['email'].fillna(df['phone']).fillna(df['address'])

# Or with combine_first
df['contact'] = df['email'].combine_first(df['phone']).combine_first(df['address'])
```

### Required columns check

```python
required = ['user_id', 'amount', 'ts']
missing_rows = df[df[required].isna().any(axis=1)]
if len(missing_rows):
    raise ValueError(f'{len(missing_rows)} rows missing required fields')
```

### Mark imputed values

```python
df['amount_imputed'] = df['amount'].isna()
df['amount'] = df['amount'].fillna(df.groupby('region')['amount'].transform('median'))
```

Always keep an audit trail of what you imputed — downstream consumers need it.
