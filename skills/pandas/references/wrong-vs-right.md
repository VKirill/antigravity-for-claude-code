# Wrong vs Right — Common Pandas Patterns

Side-by-side contrasts of mistakes (often subtly broken) and the production-correct equivalents.

## 1. Chained assignment

### Wrong
```python
df[df['amount'] < 0]['amount'] = 0    # silent no-op under CoW (3.0)
```
Under CoW the intermediate is a logical copy. The write succeeds against that copy, then the copy is discarded. **Your data is unchanged.**

### Right
```python
df.loc[df['amount'] < 0, 'amount'] = 0
```
Single `.loc[row_selector, col_selector] = value`. CoW-safe and the only correct form.

---

## 2. iterrows for row computation

### Wrong
```python
totals = []
for idx, row in df.iterrows():
    totals.append(row['price'] * row['quantity'] * (1 - row['discount']))
df['total'] = totals
```
`iterrows` boxes every row into a Series. On 1M rows this can take **30–60 seconds**. The same operation vectorized takes **<100 ms**.

### Right
```python
df['total'] = df['price'] * df['quantity'] * (1 - df['discount'])
```
Vectorized numpy operation. ~500× faster.

### Still right if you genuinely need rowwise Python
```python
def compute(p, q, d):
    return p * q * (1 - d)

df['total'] = [compute(p, q, d) for p, q, d in zip(df['price'], df['quantity'], df['discount'])]
# Or via itertuples (no Series boxing)
df['total'] = [r.price * r.quantity * (1 - r.discount) for r in df.itertuples(index=False)]
```

---

## 3. `str.contains` without `na=False`

### Wrong
```python
mask = df['name'].str.contains('john')
df[mask]    # ValueError if any NaN in name column
```
NaN propagates through `str.contains`, producing NaN in the mask. Boolean indexing with NaN raises.

### Right
```python
df[df['name'].str.contains('john', na=False)]
```
`na=False` treats missing as non-match. Use `na=True` if you want missing names to be included.

---

## 4. Mixed datetime dtypes silently downcast

### Wrong
```python
df_ns = pd.DataFrame({'ts': pd.to_datetime(['2026-01-01'])})  # 3.0: us
df_us = pd.DataFrame({'ts': pd.to_datetime(['2026-01-02']).astype('datetime64[us]')})
out = pd.concat([df_ns, df_us])
# Pandas silently promotes to the finest resolution
# In a long pipeline this can mean comparing different resolutions implicitly
```

### Right
```python
# Decide one resolution at ingest and enforce it
TS_DTYPE = 'datetime64[us]'

def load(path):
    df = pd.read_parquet(path)
    df['ts'] = df['ts'].astype(TS_DTYPE)
    return df

out = pd.concat([load('a.parquet'), load('b.parquet')])
```

---

## 5. apply(axis=1) for row math

### Wrong
```python
df['gross'] = df.apply(lambda r: r['net'] / (1 - r['tax_rate']), axis=1)
```
`apply(axis=1)` runs Python per row with Series boxing overhead. Slow.

### Right
```python
df['gross'] = df['net'] / (1 - df['tax_rate'])
```

### Right for conditional logic
```python
# Wrong:
df['tier'] = df.apply(lambda r: 'gold' if r['spend'] > 1000 else ('silver' if r['spend'] > 100 else 'bronze'), axis=1)

# Right:
df['tier'] = np.select(
    [df['spend'] > 1000, df['spend'] > 100],
    ['gold', 'silver'],
    default='bronze',
)
```

---

## 6. Dict-syntax aggregation (deprecated)

### Wrong
```python
df.groupby('region').agg({
    'amount': ['sum', 'mean'],
    'user_id': 'nunique',
})
# Returns MultiIndex columns; 'amount sum' tuple keys; deprecated path
```

### Right
```python
df.groupby('region').agg(
    total_amount=('amount', 'sum'),
    avg_amount=('amount', 'mean'),
    n_users=('user_id', 'nunique'),
)
# Flat output columns with explicit names
```

---

## 7. `pd.options.mode.copy_on_write = True` (legacy)

### Wrong (3.0)
```python
import pandas as pd
pd.options.mode.copy_on_write = True   # 3.0: deprecated no-op
```
The option has no effect — CoW is unconditional.

### Right
```python
# Delete the line. Done.
```

---

## 8. `inplace=True` instead of reassignment

### Wrong
```python
df.fillna(0, inplace=True)
df.sort_values('ts', inplace=True)
df.reset_index(inplace=True, drop=True)
```
Breaks method chaining, harder to test, no longer guarantees zero-copy in 3.0.

### Right
```python
df = (df
    .fillna(0)
    .sort_values('ts')
    .reset_index(drop=True))
```

---

## 9. Reading large CSV without dtype + chunking

### Wrong
```python
df = pd.read_csv('big.csv')    # 5 GB file, 4 GB RAM → OOM
```
Inference scans the whole file twice; types may downgrade on bad rows.

### Right
```python
DTYPES = {
    'user_id': 'Int64',
    'amount': 'Float64',
    'region': 'category',
    'name': 'str',
}
chunks = []
for chunk in pd.read_csv('big.csv', chunksize=200_000, dtype=DTYPES, parse_dates=['ts']):
    chunks.append(chunk[chunk['region'] == 'US'])   # filter early
df = pd.concat(chunks, ignore_index=True)
df.to_parquet('big_us.parquet')   # cache for next run
```

---

## 10. Naive timezone arithmetic

### Wrong
```python
df['ts_local'] = df['ts_utc'] - pd.Timedelta(hours=4)   # "Eastern is UTC-4"
```
Breaks on DST transitions; users in different cells see different "local" times depending on date.

### Right
```python
df['ts_local'] = df['ts_utc'].dt.tz_convert('America/New_York')
```

---

## 11. `merge` without `validate`

### Wrong
```python
result = pd.merge(orders, users, on='user_id', how='left')
# users had two rows for user_id=10 → orders fans out 2× silently
```

### Right
```python
result = pd.merge(orders, users, on='user_id', how='left', validate='many_to_one')
# Raises MergeError if users has duplicates on user_id — catches bugs upfront
```

---

## 12. Categorical groupby without `observed=True`

### Wrong
```python
df['region'] = df['region'].astype('category')
df['product'] = df['product'].astype('category')
df.groupby(['region', 'product']).agg(rev=('amount', 'sum'))
# Creates rows for every region×product combo, even unseen ones (huge output)
```

### Right
```python
df.groupby(['region', 'product'], observed=True).agg(rev=('amount', 'sum'))
```

---

## 13. Object dtype for strings (after migration)

### Wrong
```python
df = pd.read_csv('legacy.csv')
df['name'].str.upper()    # slow object-dtype path
```

### Right
```python
df = pd.read_csv('legacy.csv', dtype_backend='pyarrow')
# Or after the fact:
df = df.convert_dtypes(dtype_backend='pyarrow')
df['name'].str.upper()    # vectorized PyArrow path
```

---

## 14. `concat` without `ignore_index` in append loop

### Wrong
```python
result = pd.DataFrame()
for chunk in chunks:
    result = pd.concat([result, chunk])   # quadratic in chunks; preserves chunk indices (often duplicates)
```

### Right
```python
result = pd.concat(list(chunks), ignore_index=True)   # single concat, fresh index
```
Better: don't accumulate — write each chunk to its own parquet partition.

---

## 15. Checking dtype against `'object'` for strings (broken in 3.0)

### Wrong
```python
if df['name'].dtype == 'object':    # was true in 2.x for strings; false in 3.0 (now 'str')
    df['name'] = df['name'].str.strip()
```

### Right
```python
if pd.api.types.is_string_dtype(df['name']):
    df['name'] = df['name'].str.strip()
```
`is_string_dtype` handles `'str'`, `'string[python]'`, `'string[pyarrow]'` uniformly.
