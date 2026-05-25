# IO — Reading and Writing

## Fastest-to-slowest IO formats

| Format | Speed | Schema | Compressed | Use for |
|---|---|---|---|---|
| **Parquet** | Fastest | Yes (typed) | Yes (snappy, zstd) | Inter-process, long-term storage — preferred |
| Feather (Arrow IPC) | Fastest | Yes | Optional | Short-lived caches between Python processes |
| Pickle | Fast | No | Optional | Single-process only; security risk (no validation) |
| CSV | Slow | No | Manual gzip | Human-readable, interop only |
| JSON | Slow | No | Manual | API responses, line-delimited logs |
| Excel | Slowest | Partial | N/A | Business handoff only |
| SQL | Varies | Yes | N/A | When the source is a DB |

**Default**: Parquet for everything that doesn't have a hard requirement otherwise.

## Parquet — preferred format

```python
# Read
df = pd.read_parquet('data.parquet')
df = pd.read_parquet('s3://bucket/data.parquet')      # works with fsspec
df = pd.read_parquet('data.parquet', columns=['a', 'b'])  # column pruning

# Partitioned dataset with predicate pushdown
df = pd.read_parquet(
    'dataset/',
    filters=[('year', '==', 2026), ('region', 'in', ['US', 'EU'])],
)

# Write
df.to_parquet('data.parquet', compression='zstd', index=False)

# Partitioned write — one parquet file per (year, region) combination
df.to_parquet(
    'dataset/',
    partition_cols=['year', 'region'],
    compression='zstd',
    index=False,
)
```

Why parquet wins:
- Typed schema (no dtype drift on roundtrip)
- Columnar (read only the columns you need)
- Compressed (typically 5–10× smaller than CSV)
- Predicate pushdown via partitions and statistics
- Native Arrow interop (zero-copy with PyArrow)

## CSV — for human-readable interop

```python
# Read — ALWAYS specify dtype in production
df = pd.read_csv(
    'data.csv',
    dtype={
        'user_id': 'Int64',
        'amount': 'Float64',
        'region': 'category',
        'name': 'str',
    },
    parse_dates=['ts'],
    date_format='%Y-%m-%d %H:%M:%S',     # explicit format = fast parsing
    na_values=['', 'NULL', 'N/A'],
    keep_default_na=True,
    encoding='utf-8',
    on_bad_lines='warn',                  # 'error' | 'warn' | 'skip'
)

# Chunked reading for memory-bound files
for chunk in pd.read_csv('huge.csv', chunksize=100_000, dtype={...}):
    process(chunk)

# Or as a context manager (3.0)
with pd.read_csv('huge.csv', chunksize=100_000) as reader:
    for chunk in reader:
        process(chunk)
```

**Production checklist for `read_csv`**:
- [ ] Explicit `dtype={...}` for every column (skip inference)
- [ ] `parse_dates=[...]` with `date_format=...`
- [ ] `na_values=[...]` for project-specific sentinels
- [ ] `chunksize=` if file > available RAM / 5
- [ ] `on_bad_lines='warn'` (or `'error'` in strict pipelines)

### Write CSV

```python
df.to_csv('out.csv', index=False, date_format='%Y-%m-%d %H:%M:%S')
df.to_csv('out.csv.gz', index=False, compression='gzip')   # auto-detect from extension
```

## Excel

```python
# Read
df = pd.read_excel('book.xlsx', sheet_name='Sheet1')
sheets = pd.read_excel('book.xlsx', sheet_name=None)     # dict of {sheet_name: DataFrame}
df = pd.read_excel('book.xlsx', sheet_name=0, header=2, usecols='A:C')

# Write
df.to_excel('out.xlsx', sheet_name='data', index=False)

# Multi-sheet
with pd.ExcelWriter('out.xlsx', engine='openpyxl') as writer:
    df1.to_excel(writer, sheet_name='users', index=False)
    df2.to_excel(writer, sheet_name='orders', index=False)
```

Requires `openpyxl` (`.xlsx`) or `xlrd` (legacy `.xls`).

## JSON

```python
# Records (default) — array of objects
df.to_json('out.json', orient='records', date_format='iso')
df = pd.read_json('out.json', orient='records')

# Line-delimited (preferred for streams / Spark / BigQuery)
df.to_json('out.jsonl', orient='records', lines=True, date_format='iso')
df = pd.read_json('out.jsonl', lines=True)

# Specific orientations
df.to_json(orient='split')     # {index, columns, data} — preserves index
df.to_json(orient='table')     # JSON Table Schema — preserves dtypes
```

**3.0 deprecates `date_format='epoch'`** — use `'iso'`.

## SQL

```python
from sqlalchemy import create_engine

engine = create_engine('postgresql+psycopg://user:pw@host/db')

# Read
df = pd.read_sql('SELECT * FROM orders WHERE created_at > %s', engine, params=(cutoff,))
df = pd.read_sql_table('orders', engine, columns=['id', 'amount'])
df = pd.read_sql_query('SELECT * FROM orders LIMIT 1000', engine, parse_dates=['ts'])

# Chunked for big queries
for chunk in pd.read_sql_query('SELECT * FROM events', engine, chunksize=50_000):
    process(chunk)

# Write
df.to_sql(
    'orders',
    engine,
    if_exists='append',          # 'fail' | 'replace' | 'append'
    index=False,
    method='multi',              # batch INSERT (much faster)
    chunksize=1_000,
)
```

**Use `method='multi'` or a custom `method` callback for bulk inserts** — default row-at-a-time is glacial. For PostgreSQL, `COPY FROM` via `psycopg` is fastest.

**Often better**: do the aggregation in SQL and only pull the result. Pandas-in-the-loop with DB row-shipping is usually a code smell.

## Feather (Arrow IPC)

```python
df.to_feather('cache.feather')
df = pd.read_feather('cache.feather')
```

Fast roundtrip with full type fidelity. Use for short-lived caches between Python steps — long-term, parquet is more portable.

## Pickle

```python
df.to_pickle('cache.pkl')
df = pd.read_pickle('cache.pkl')
```

**Never** unpickle untrusted data — pickle can execute arbitrary code. Use parquet for stored datasets, pickle only for local single-process caches.

## fsspec / cloud storage

Most `read_*` and `to_*` accept any URI fsspec understands:

```python
df = pd.read_parquet('s3://bucket/data.parquet', storage_options={'key': '...', 'secret': '...'})
df.to_parquet('gs://bucket/out.parquet')
df = pd.read_csv('https://example.com/data.csv')
df = pd.read_parquet('az://container/data.parquet')
```

Requires the matching fsspec backend (`s3fs`, `gcsfs`, `adlfs`).

## Dtype backend selection (3.0)

```python
# Use PyArrow as the dtype backend throughout
df = pd.read_csv('data.csv', dtype_backend='pyarrow')
df = pd.read_parquet('data.parquet', dtype_backend='pyarrow')

# Or 'numpy_nullable' for pandas nullable extension types (Int64, Float64, string)
df = pd.read_csv('data.csv', dtype_backend='numpy_nullable')
```

PyArrow backend is usually faster and smaller for string-heavy data; numpy_nullable plays better with libraries that don't understand PyArrow types.
