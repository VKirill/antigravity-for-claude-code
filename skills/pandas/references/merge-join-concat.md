# Merge, Join, Concat

## `pd.merge` — SQL-style joins on columns

```python
import pandas as pd

orders = pd.DataFrame({
    'order_id':   [1, 2, 3, 4],
    'user_id':    [10, 20, 30, 99],
    'amount':     [50.0, 75.0, 100.0, 25.0],
})
users = pd.DataFrame({
    'user_id':    [10, 20, 30, 40],
    'name':       ['ann', 'bob', 'cara', 'dan'],
})

# Inner join (default) — keep only matching keys
pd.merge(orders, users, on='user_id', how='inner')

# Left join — keep all left rows, NaN for missing right
pd.merge(orders, users, on='user_id', how='left')

# Right join — keep all right rows
pd.merge(orders, users, on='user_id', how='right')

# Full outer join — keep all rows from both
pd.merge(orders, users, on='user_id', how='outer')

# Cross join — Cartesian product (every row × every row)
pd.merge(orders, users, how='cross')
```

### Anti-joins (new in 3.0)

```python
# Left-anti: rows in `orders` whose user_id is NOT in `users`
pd.merge(orders, users, on='user_id', how='left_anti')
# → returns the row with user_id=99

# Right-anti: rows in `users` whose user_id is NOT in `orders`
pd.merge(orders, users, on='user_id', how='right_anti')
# → returns the row with user_id=40
```

This replaces the awkward `merge(how='left', indicator=True).query("_merge == 'left_only'")` pattern.

## Always set `validate` and `indicator` in production

```python
pd.merge(
    orders,
    users,
    on='user_id',
    how='left',
    validate='many_to_one',   # raises if right side has duplicates on key
    indicator=True,            # adds _merge column showing match status
)
```

`validate` options:
- `'one_to_one'` — both sides unique on key
- `'one_to_many'` — left unique, right may duplicate
- `'many_to_one'` — left may duplicate, right unique
- `'many_to_many'` — no uniqueness assumption (silent fanout — almost always a bug)

**3.0 also validates `how`** — typos like `how='lefty'` now raise instead of silently doing inner.

## Different column names — `left_on` / `right_on`

```python
pd.merge(
    orders,
    users.rename(columns={'user_id': 'uid'}),
    left_on='user_id',
    right_on='uid',
    how='left',
)
```

## Joining on the index

```python
pd.merge(orders, users.set_index('user_id'), left_on='user_id', right_index=True, how='left')

# Or the shorthand `.join()`:
orders.set_index('user_id').join(users.set_index('user_id'), how='left')
```

`.join()` defaults to a left join on the index — handy for fast multi-frame combines.

## Suffixes

When both frames have same-named non-key columns:

```python
pd.merge(left, right, on='user_id', suffixes=('_orders', '_users'))
# Columns 'amount' from both sides become 'amount_orders' and 'amount_users'
```

## `pd.concat` — stack frames

```python
# Vertical (axis=0): same columns, stack rows
pd.concat([df_jan, df_feb, df_mar], axis=0, ignore_index=True)

# Horizontal (axis=1): same index, side-by-side columns
pd.concat([df_users, df_metrics], axis=1)

# With hierarchical labels (`keys` adds a MultiIndex level)
pd.concat({'jan': df_jan, 'feb': df_feb}, names=['month'])
```

Key flags:
- `ignore_index=True` — drop existing indexes, renumber 0..n-1
- `sort=False` (default) — preserve column order; `True` to sort
- `join='outer'` (default) — union of columns; `'inner'` for intersection
- `keys=[...]` + `names=[...]` — produce a MultiIndex with source labels

## `merge_asof` — sorted nearest-key joins (timeseries)

For each row in `left`, find the **most recent** row in `right` whose key is `<=` left's key:

```python
trades = pd.DataFrame({
    'ts':    pd.to_datetime(['2026-01-01 09:00:01', '2026-01-01 09:00:05']),
    'price': [100.0, 101.5],
})
quotes = pd.DataFrame({
    'ts':  pd.to_datetime(['2026-01-01 09:00:00', '2026-01-01 09:00:02', '2026-01-01 09:00:04']),
    'bid': [99.5, 100.0, 101.0],
})

# For each trade, attach the most recent quote
pd.merge_asof(
    trades.sort_values('ts'),
    quotes.sort_values('ts'),
    on='ts',
    direction='backward',           # default; 'forward' or 'nearest' also valid
    tolerance=pd.Timedelta('1s'),   # cap how far back to look
)
```

Both sides **must be sorted** on the key.

Use `by=` for per-group asof:
```python
pd.merge_asof(trades, quotes, on='ts', by='ticker')
```

## `merge_ordered` — outer join + fill

Designed for time-series alignment. Merges two ordered frames and optionally forward-fills NaNs:

```python
pd.merge_ordered(
    df_a, df_b,
    on='ts',
    fill_method='ffill',   # 'ffill' or None
    suffixes=('_a', '_b'),
)
```

## `compare` — diff two DataFrames

```python
df1.compare(df2)
# Returns the differences side by side (multiIndex columns 'self' / 'other')

df1.compare(df2, keep_shape=True, keep_equal=True)
# Same shape as inputs, NaN where equal
```

Useful for regression tests and ETL verification.

## Performance notes

- Sort keys before merging large frames (`.sort_values(key).reset_index(drop=True)`)
- For one-to-many joins, put the smaller frame on the right
- Use indexes (`.set_index(key)`) for repeated joins on the same key — faster lookup
- `validate=` catches data quality bugs early — always set it
- For multi-million-row merges, profile against polars `.join()` (often 3–10× faster)
