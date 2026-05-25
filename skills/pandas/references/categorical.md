# Categorical Dtype

## When to use Categorical

- Low-cardinality columns (≤ a few thousand unique values) with millions of rows
- Columns with **semantic ordering** (sizes S/M/L, severity low/medium/high, grades)
- Groupby keys where the same groups appear repeatedly
- Memory-constrained pipelines (categorical is 10–100× smaller than string for repeated values)

Don't use for:
- High-cardinality strings (user IDs, free-text names) — use PyArrow `str`
- Columns with mostly unique values — overhead exceeds benefit
- Columns you'll constantly add new values to (categorical mutation is slower)

## Creating

```python
import pandas as pd

# From a Series
s = pd.Series(['low', 'high', 'medium', 'low'])
cat = s.astype('category')
cat.dtype       # CategoricalDtype(categories=['high', 'low', 'medium'], ordered=False)

# Explicit categories (with ordering)
cdtype = pd.CategoricalDtype(categories=['low', 'medium', 'high'], ordered=True)
s_ord = s.astype(cdtype)
s_ord < 'high'   # works because ordered=True

# At construction
df = pd.DataFrame({
    'severity': pd.Categorical(['low', 'high'], categories=['low', 'medium', 'high'], ordered=True),
})
```

## The `.cat` accessor

```python
s = df['severity']

s.cat.categories       # Index(['low', 'medium', 'high'])
s.cat.ordered          # True
s.cat.codes            # integer codes [0, 2, 1, 0] — useful for ML features
s.cat.add_categories(['critical'])
s.cat.remove_unused_categories()
s.cat.rename_categories({'low': 'L', 'high': 'H'})
s.cat.reorder_categories(['high', 'medium', 'low'], ordered=True)
s.cat.set_categories(['low', 'medium', 'high', 'critical'])    # full replacement
s.cat.as_ordered() / s.cat.as_unordered()
```

## Ordered comparisons

```python
ordered = pd.Categorical(['low', 'high'], categories=['low', 'medium', 'high'], ordered=True)

ordered > 'medium'    # [False, True]
ordered.min()         # 'low'
ordered.sort_values() # sorts by category position, not alphabetically
```

## Memory wins

```python
import sys

s_str = pd.Series(['US', 'EU', 'APAC'] * 1_000_000)
s_cat = s_str.astype('category')

s_str.memory_usage(deep=True)    # ~24 MB (object dtype) or ~9 MB (str dtype 3.0)
s_cat.memory_usage(deep=True)    # ~3 MB — int8 codes + tiny category index
```

For repeated low-cardinality string columns, expect **5–30× memory reduction**.

## GroupBy speedup

Pandas can skip the hashing pass when grouping on categorical:

```python
df['region'] = df['region'].astype('category')
df.groupby('region', observed=True).agg(total=('amount', 'sum'))
```

**Critical**: pass `observed=True` when grouping on a categorical — otherwise pandas creates a row for every Cartesian product of categories, even unseen ones. For a multi-key groupby on three 10-category columns, `observed=False` creates 1000 rows even if your data only contains 50.

## Operations that preserve / lose categorical

| Operation | Preserves dtype? |
|---|---|
| `df[mask]` (boolean filter) | Yes (removes unused categories on demand via `remove_unused_categories()`) |
| `df.sort_values()` | Yes (sort by category order if ordered) |
| `df.groupby(cat_col)` | Yes |
| `pd.concat([df1, df2])` with different categories | **No** — coerces to object/string unless categories are union-merged |
| `df['cat_col'].str.upper()` | **No** — returns object/string |
| Arithmetic on category codes | Use `s.cat.codes` explicitly |

For concat with category mismatch:
```python
# Both frames need the same CategoricalDtype
shared = pd.CategoricalDtype(categories=union_categories, ordered=False)
df1['col'] = df1['col'].astype(shared)
df2['col'] = df2['col'].astype(shared)
pd.concat([df1, df2])
```

Or use the `union_categoricals` helper:
```python
from pandas.api.types import union_categoricals
combined = union_categoricals([df1['col'], df2['col']])
```

## Parquet round-trip — dictionary type

Categorical maps cleanly to PyArrow's `dictionary` type and round-trips through parquet:

```python
df['region'] = df['region'].astype('category')
df.to_parquet('data.parquet')

df2 = pd.read_parquet('data.parquet')
df2['region'].dtype    # category (preserved)
```

Categories are encoded once in the parquet file, with int32 codes per row — also a wire-format win.

## ML feature engineering

```python
# Integer codes for tree models
df['region_code'] = df['region'].cat.codes    # int8/int16/int32

# One-hot
pd.get_dummies(df, columns=['region'], dtype='boolean')    # 3.0: dtype keyword preferred
```

Tree-based models (HistGradientBoosting in sklearn, lightgbm, xgboost) prefer raw categorical or integer codes. Linear/neural models prefer one-hot.

## Gotchas

### Adding a value outside categories

```python
s = pd.Series(pd.Categorical(['a', 'b'], categories=['a', 'b']))
s[0] = 'c'    # ValueError — 'c' not in categories

# Fix: add the category first
s = s.cat.add_categories(['c'])
s[0] = 'c'    # ok
```

### Sorting unordered category

```python
s = pd.Series(pd.Categorical(['b', 'a', 'c']))    # unordered
s.sort_values()    # sorts by category insertion order, not alphabetic
# To sort alphabetic, cast back: s.astype(str).sort_values()
```

### NaN in categories

`pd.NA` / `NaN` is always a valid value for a categorical — it doesn't need to be in `categories`. It's stored as code `-1`.

```python
s = pd.Series(['a', 'b', None], dtype='category')
s.cat.codes    # [0, 1, -1]
```
