# GroupBy — split-apply-combine

`df.groupby(keys)` returns a `DataFrameGroupBy` lazily — no computation until you call `.agg`, `.transform`, `.filter`, `.apply`, or `.size()`/`.count()`.

## Anatomy

```python
gb = df.groupby('region')       # group key, doesn't compute
gb.agg('sum')                    # aggregate: one row per group
gb.transform('mean')             # broadcast: same shape as df
gb.filter(lambda g: len(g) > 5)  # subset: keep groups passing a predicate
gb.apply(custom_fn)              # flexible escape hatch (slow)
```

## Named aggregations (preferred in 3.0)

Dict-syntax (`df.groupby('k').agg({'col': 'sum'})`) is deprecated. Use **named aggregations** with tuples or `pd.NamedAgg`:

```python
# Tuple form (concise)
out = df.groupby('region').agg(
    total_rev=('amount', 'sum'),
    avg_rev=('amount', 'mean'),
    n_users=('user_id', 'nunique'),
    first_ts=('ts', 'min'),
)

# Equivalent with pd.NamedAgg (more explicit)
out = df.groupby('region').agg(
    total_rev=pd.NamedAgg(column='amount', aggfunc='sum'),
    avg_rev=pd.NamedAgg(column='amount', aggfunc='mean'),
)
```

**Output column names are explicit**, never auto-generated like `('amount', 'sum')` tuples. This is the right pattern.

## Multi-key groupby

```python
df.groupby(['region', 'product']).agg(rev=('amount', 'sum'))
df.groupby(['region', 'product'], as_index=False).agg(rev=('amount', 'sum'))  # flat columns
df.groupby(['region', 'product'], dropna=False).size()  # include NaN groups
df.groupby('region', sort=False).agg(rev=('amount', 'sum'))   # don't sort groups (faster)
df.groupby('region', observed=True).size()  # only seen categorical values (default False)
```

`observed=True` matters for categorical group keys — without it pandas materializes every category × category combination (huge for high-cardinality cats).

## Common aggregation strings

```python
df.groupby('region').agg(
    n=('amount', 'count'),           # non-null count
    n_total=('amount', 'size'),      # total rows including NaN
    n_unique=('amount', 'nunique'),
    sum=('amount', 'sum'),
    mean=('amount', 'mean'),
    median=('amount', 'median'),
    std=('amount', 'std'),
    var=('amount', 'var'),
    min=('amount', 'min'),
    max=('amount', 'max'),
    first=('amount', 'first'),
    last=('amount', 'last'),
    p25=('amount', lambda x: x.quantile(0.25)),   # custom via lambda
)
```

## Custom aggregations

Lambdas work but lose vectorization. Prefer named functions for clarity:

```python
def revenue_per_user(s):
    return s.sum() / s.count() if s.count() else 0

df.groupby('region').agg(rpu=('amount', revenue_per_user))
```

## Transform — same shape as input

`transform` broadcasts the per-group result back to the original index:

```python
df['region_total'] = df.groupby('region')['amount'].transform('sum')
df['amount_z'] = df.groupby('region')['amount'].transform(
    lambda x: (x - x.mean()) / x.std()
)

# Multiple transforms
df = df.assign(
    region_mean=df.groupby('region')['amount'].transform('mean'),
    region_rank=df.groupby('region')['amount'].transform('rank', ascending=False),
)
```

## Filter — keep / drop whole groups

```python
# Keep only groups with > 5 rows
df.groupby('region').filter(lambda g: len(g) > 5)

# Keep groups whose mean exceeds a threshold
df.groupby('region').filter(lambda g: g['amount'].mean() > 50)
```

## Apply — flexible but slow

`apply` is the escape hatch. Avoid when `agg` / `transform` will do — `apply` runs Python per group:

```python
def summary(g):
    return pd.Series({
        'total': g['amount'].sum(),
        'top_user': g.loc[g['amount'].idxmax(), 'user_id'],
    })

df.groupby('region').apply(summary, include_groups=False)   # 3.0: include_groups=False is required for the new behavior
```

`include_groups=False` (3.0) tells pandas not to pass the group keys to the function — recommended.

## Grouping on MultiIndex

```python
# Group by an index level
df.groupby(level='region').agg(total=('amount', 'sum'))
df.groupby(level=['month', 'region']).agg(total=('amount', 'sum'))

# Group by a function of the index
df.groupby(df.index.year).size()
```

## `pd.Grouper` for time-based groups

```python
import pandas as pd
df.groupby(pd.Grouper(key='ts', freq='1D')).agg(daily=('amount', 'sum'))
df.groupby([pd.Grouper(key='ts', freq='1W'), 'region']).agg(weekly=('amount', 'sum'))
```

Equivalent to `df.set_index('ts').groupby([pd.Grouper(freq='1W'), 'region']).sum()` but cleaner.

## Common patterns

### Top-N per group

```python
# Top 3 rows per region by amount
df.sort_values(['region', 'amount'], ascending=[True, False]) \
  .groupby('region') \
  .head(3)

# Rank within group
df['rank'] = df.groupby('region')['amount'].rank(method='dense', ascending=False)
df.query('rank <= 3')
```

### Pivot via groupby

```python
df.groupby(['region', 'product'])['amount'].sum().unstack('product', fill_value=0)
# equivalent to:
df.pivot_table(values='amount', index='region', columns='product', aggfunc='sum', fill_value=0)
```

### Cumulative within group

```python
df['cum_amount'] = df.groupby('user_id')['amount'].cumsum()
df['running_max'] = df.groupby('user_id')['amount'].cummax()
df['pct_of_total'] = df['amount'] / df.groupby('region')['amount'].transform('sum')
```

## Performance notes

- Sort the dataframe by group key first if you call groupby repeatedly on the same key — much faster
- `observed=True` for categorical keys (avoids materializing empty groups)
- Prefer string aggfunc (`'sum'`, `'mean'`) over lambdas — string dispatches to Cython
- `as_index=False` saves a `reset_index()` and is slightly faster
- For multi-million rows with high-cardinality keys, consider polars
