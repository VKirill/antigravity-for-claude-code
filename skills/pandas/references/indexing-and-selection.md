# Indexing and Selection

Under Copy-on-Write (3.0 default), **every indexer returns a copy**. Mutate the result with `.loc[...] = ...` on the original, not on a chained subselection. See [copy-on-write.md](copy-on-write.md).

## The four accessors

| Accessor | Lookup | Best for |
|---|---|---|
| `.loc[row, col]` | label-based | Row/column selection by label, boolean mask, slice of labels |
| `.iloc[row, col]` | positional | Position-based row/column selection |
| `.at[row, col]` | label scalar | Fast scalar access by label (faster than `.loc` for single cells) |
| `.iat[row, col]` | positional scalar | Fast scalar access by position |

```python
df.loc[3, 'amount']           # row label 3, column 'amount'
df.loc[df['amount'] > 10]     # boolean mask
df.loc[1:3, ['name', 'ts']]   # label slice is INCLUSIVE on both ends
df.iloc[0:3, [0, 2]]          # position slice is HALF-OPEN like Python
df.at[3, 'amount']            # scalar fast path — preferred over df.loc[3, 'amount'] for single cells
```

**`.loc` slicing is inclusive**: `df.loc[1:3]` includes labels 1, 2, AND 3. `df.iloc[1:3]` includes positions 1, 2 only.

## Boolean indexing

```python
df[df['amount'] > 10]                        # works but creates an intermediate
df.loc[df['amount'] > 10]                    # preferred — explicit
df.loc[df['amount'].between(5, 100, inclusive='both')]
df.loc[df['name'].isin(['ann', 'bob'])]
df.loc[~df['name'].isin(['ann'])]            # negation
df.loc[df['name'].str.contains('a', na=False)]   # ALWAYS na=False (see wrong-vs-right.md)
df.loc[(df['amount'] > 10) & (df['name'] == 'ann')]   # parens are mandatory for &/|
```

**Combining masks**: use `&` `|` `~`, NOT Python `and` / `or` / `not`. Wrap each mask in parens — `&` has higher precedence than `>`.

## `query()` — string expressions

For multi-clause filters, `.query()` is concise and uses `pd.eval` under the hood:

```python
df.query('amount > 10 and name == "ann"')
df.query('amount > @threshold')              # @-prefix for Python vars
df.query('`column with spaces` > 0')         # backticks for special names
```

`query` is comparable in speed to vectorized masks on numeric columns and dramatically more readable for ≥3 clauses.

## `where()` / `mask()`

Same shape as the source, replace where condition fails (`where`) or holds (`mask`):

```python
df['amount'].where(df['amount'] > 0)         # values ≤ 0 → NaN
df['amount'].mask(df['amount'] > 100, 100)   # cap at 100
```

## `filter()`

Selects rows or columns by label pattern (not values — for that use boolean indexing):

```python
df.filter(items=['name', 'amount'])              # specific columns
df.filter(like='id', axis=1)                     # columns containing 'id'
df.filter(regex='^user_', axis=1)                # regex on column names
```

## MultiIndex slicing with `IndexSlice`

```python
import pandas as pd
mi = pd.MultiIndex.from_tuples(
    [('2026-01', 'US'), ('2026-01', 'EU'), ('2026-02', 'US'), ('2026-02', 'EU')],
    names=['month', 'region']
)
df = pd.DataFrame({'rev': [100, 200, 150, 175]}, index=mi)

idx = pd.IndexSlice

# All months, only US region
df.loc[idx[:, 'US'], :]

# Specific month range, both regions
df.loc[idx['2026-01':'2026-02', :], :]

# Cross-section
df.xs('US', level='region')
df.xs('2026-01', level='month')
```

**Critical**: MultiIndex must be **sorted** for slice-based selection. Use `df.sort_index()` first or you'll get `UnsortedIndexError`.

```python
df = df.sort_index()    # always do this after constructing a MultiIndex
```

## Setting values

Always use `.loc[]` for assignment under CoW:

```python
df.loc[df['amount'].isna(), 'amount'] = 0          # fillna with explicit selector
df.loc[df['region'] == 'US', 'rev'] *= 1.05        # scale subset
df.loc[3, 'name'] = 'updated'                      # single cell
df.at[3, 'name'] = 'updated'                       # equivalent, faster for single cell
```

**Never** do this — it's a silent no-op under CoW:
```python
df[df['amount'] < 0]['amount'] = 0   # WRONG — does nothing
```

## Reindex and align

```python
df.reindex(['a', 'b', 'c'])           # rows by new index, NaN for missing
df.reindex(columns=['x', 'y'])        # columns
df.reindex_like(other_df)             # match another DataFrame's axes
df.align(other_df, join='outer')      # align two DataFrames, return both
```

## Set / reset index

```python
df = df.set_index('user_id')          # promote column to index
df = df.set_index(['month', 'region'])  # MultiIndex
df = df.reset_index()                 # demote index back to columns
df = df.reset_index(drop=True)        # discard old index entirely
```
