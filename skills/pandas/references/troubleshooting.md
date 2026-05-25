# Troubleshooting

## SettingWithCopyWarning (legacy)

**Symptom**: Code from 2.x raises or warns; under 3.0 the warning is gone but assignments don't take effect.

**Cause**: Chained assignment — two indexers on the left side. Under CoW (3.0 default), the intermediate is a logical copy and writes don't reach the source.

**Fix**: Use a single `.loc[row_selector, col_selector] = value`.

```python
# BROKEN
df[df['x'] > 0]['y'] = 1
# FIXED
df.loc[df['x'] > 0, 'y'] = 1
```

See [copy-on-write.md](copy-on-write.md) for migration patterns.

## Dtype drift on parquet/CSV roundtrip

**Symptom**: `df.to_csv(...); pd.read_csv(...)` returns different dtypes than the original.

**Cause**: CSV is untyped; pandas infers dtypes from sample rows. Edge values silently downgrade (e.g., a column of integers with one `''` becomes `object`).

**Fix**: Use parquet, OR specify `dtype={...}` on `read_csv`.

```python
df.to_csv('data.csv', index=False)
df2 = pd.read_csv('data.csv', dtype={'user_id': 'Int64', 'amount': 'Float64', 'name': 'str'})
# Now df.dtypes == df2.dtypes (modulo 'object' → 'str' in 3.0)
```

## "Cannot compare tz-naive and tz-aware datetime objects"

**Symptom**:
```
TypeError: Cannot compare tz-naive and tz-aware datetime-like objects.
```

**Cause**: Mixing `datetime64[us]` (naive) with `datetime64[us, UTC]` (aware) — happens after merging frames from different sources.

**Fix**: Make a decision and stick to it across the pipeline. Either localize everything or keep everything naive in UTC.

```python
# Option A: localize naive to UTC
df['ts'] = df['ts'].dt.tz_localize('UTC')

# Option B: strip tz from aware (back to naive UTC — usually fine if you treat naive as UTC by convention)
df['ts'] = df['ts'].dt.tz_convert('UTC').dt.tz_localize(None)
```

## "boolean value of NA is ambiguous"

**Symptom**: Boolean mask containing `pd.NA` raises in `if` / `df[mask]`.

**Cause**: `pd.NA` makes truthiness undefined (three-valued logic).

**Fix**: `fillna(False)` or `fillna(True)` before using as a mask.

```python
mask = (df['amount'] > 100) & df['flag']    # df['flag'] is BooleanDtype
df[mask.fillna(False)]                       # explicit
```

For `str.contains`, always pass `na=False`:
```python
df.loc[df['name'].str.contains('foo', na=False)]
```

## Datetime parsing fails or is glacially slow

**Symptom**: `pd.to_datetime(col)` on a 10M-row column takes 60s and partially fails.

**Cause**: Without `format=`, pandas tries multiple parsers in sequence.

**Fix**: Specify `format=` (or `format='ISO8601'` for auto-detect of ISO variants).

```python
df['ts'] = pd.to_datetime(df['ts'], format='%Y-%m-%d %H:%M:%S')
df['ts'] = pd.to_datetime(df['ts'], format='ISO8601')
df['ts'] = pd.to_datetime(df['ts'], format='mixed')    # last resort, slow
```

## Mixed types in a single column (Object dtype)

**Symptom**: `df.info()` shows `object` dtype where you expected numeric. Aggregations return strange results.

**Diagnosis**:
```python
df['col'].map(type).value_counts()
# <class 'int'>      990
# <class 'str'>       10    ← culprit
```

**Fix**: Coerce explicitly.
```python
df['col'] = pd.to_numeric(df['col'], errors='coerce')   # bad → NaN
# Then handle the NaN rows separately
```

## Slow `apply` or `iterrows`

**Symptom**: Pipeline is fast on 10k rows, takes hours on 10M.

**Cause**: Row-wise Python loop (every row boxed into a Series).

**Fix order** (try in this sequence):

1. **Vectorize** — use array ops, `np.where`, `df.eval`:
   ```python
   # SLOW
   df['discount'] = df.apply(lambda r: r['price'] * 0.9 if r['region'] == 'US' else r['price'], axis=1)
   # FAST
   df['discount'] = df['price'] * np.where(df['region'] == 'US', 0.9, 1.0)
   ```

2. **`.map()` with a dict** for lookups:
   ```python
   tax_rates = {'US': 0.07, 'EU': 0.20, 'APAC': 0.10}
   df['tax_rate'] = df['region'].map(tax_rates)
   ```

3. **Numba** for tight numeric loops you genuinely can't vectorize:
   ```python
   df.groupby('user_id').agg(custom=('amount', 'sum'), engine='numba')
   ```

4. **`itertuples()`** if you truly need Python row iteration (no Series boxing — faster than iterrows):
   ```python
   for row in df.itertuples(index=False):
       row.amount    # attribute access, fast
   ```

5. **polars** if even vectorized pandas is too slow.

See [wrong-vs-right.md](wrong-vs-right.md) for concrete iterrows replacements.

## Memory blowup on `read_csv`

**Symptom**: OOM when reading a 1 GB CSV on a 4 GB machine.

**Fix**: Chunk + explicit dtypes + parquet conversion:

```python
chunks = []
for chunk in pd.read_csv('huge.csv', chunksize=100_000, dtype={...}):
    chunk = chunk[chunk['region'] == 'US']    # filter early
    chunks.append(chunk)
df = pd.concat(chunks, ignore_index=True)

# Better: convert to parquet once and reuse
chunks = pd.read_csv('huge.csv', chunksize=100_000, dtype={...})
for i, chunk in enumerate(chunks):
    chunk.to_parquet(f'data/part-{i:04d}.parquet')
df = pd.read_parquet('data/')   # reads all parts, can use filters/columns
```

## MergeError or UnsortedIndexError on MultiIndex slice

**Symptom**: `df.loc[idx['a':'b', :], :]` raises `UnsortedIndexError`.

**Cause**: MultiIndex must be lexsorted for slice selection.

**Fix**:
```python
df = df.sort_index()
df.loc[idx['a':'b', :], :]
```

Always sort after constructing a MultiIndex.

## "merge keys must be unique" — silent fanout

**Symptom**: After a left join, your row count exploded.

**Cause**: Right side had duplicates on the merge key; each left row matched all duplicates.

**Diagnosis**:
```python
users['user_id'].duplicated().sum()   # > 0 → silent fanout in left join
```

**Fix**: Dedupe right side, or use `validate='many_to_one'` to catch this at merge time:
```python
pd.merge(orders, users, on='user_id', how='left', validate='many_to_one')
# MergeError: Merge keys are not unique in right dataset
```

## value_counts ignores NaN by default

**Symptom**: `df['col'].value_counts()` doesn't show the NaN count.

**Fix**: `dropna=False`:
```python
df['col'].value_counts(dropna=False)
```

Same for `groupby` — pass `dropna=False` to keep NaN groups.

## "ValueError: cannot reindex from a duplicate axis"

**Symptom**: Setting one DataFrame's column from another raises.

**Cause**: Target index has duplicates.

**Fix**: Reset the index or dedupe:
```python
df = df.reset_index(drop=True)
df = df[~df.index.duplicated(keep='first')]
```

## DataFrame is silently mutated by a function

**Symptom**: Calling `prepare(df)` returns a transformed frame, but the original is also changed.

**3.0**: This shouldn't happen anymore under CoW. If it does, the function is doing in-place mutation (`df['col'] = ...`) and returning the same object.

**Fix**: Either explicitly `df = df.copy()` at the start of the function, or rewrite to functional style:
```python
def prepare(df):
    return (df
        .assign(amount=lambda d: d['amount'].fillna(0))
        .pipe(filter_active))
```
