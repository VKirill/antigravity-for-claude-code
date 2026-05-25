# Copy-on-Write (CoW) — 3.0 default

## What changed in 3.0

CoW is now the **only** behavior. Before 3.0, it was opt-in via `pd.options.mode.copy_on_write = True`. In 3.0:

- Every indexer that returns a `Series`/`DataFrame` returns a **logical copy**
- Chained assignment (`df[mask]['col'] = x`) **silently no-ops** on the original — it doesn't raise `SettingWithCopyWarning` because there's nothing ambiguous to warn about; it just doesn't propagate
- The `mode.copy_on_write` option is **deprecated and inert** (setting it has no effect)
- Under the hood pandas uses **lazy views** where it can prove no mutation happens, and only physically copies when needed — so CoW is usually as fast as 2.x (sometimes faster)

## The core rule

```python
# WRONG — silent no-op under CoW
df[df['amount'] < 0]['amount'] = 0
df.loc[df['amount'] < 0].iloc[:, 2] = 0    # also no-op

# RIGHT — single indexer with both row and column selector
df.loc[df['amount'] < 0, 'amount'] = 0
```

If you want to mutate, use **one** `.loc[row_selector, col_selector] = value`. Don't split it.

## Migration patterns

### Pattern: filter then mutate

```python
# BEFORE (2.x, worked despite SettingWithCopyWarning)
sub = df[df['region'] == 'US']
sub['amount'] *= 1.05    # WARNING in 2.x, NO-OP in 3.0

# AFTER (3.0, explicit copy)
sub = df[df['region'] == 'US'].copy()
sub['amount'] *= 1.05    # sub is independent now; original df unchanged

# OR (3.0, single-shot on original)
df.loc[df['region'] == 'US', 'amount'] *= 1.05
```

### Pattern: rename + mutate

```python
# BEFORE
renamed = df.rename(columns={'amt': 'amount'})
renamed['amount'] = renamed['amount'] * 100   # in 2.x: mutated original via view

# AFTER (3.0)
renamed = df.rename(columns={'amt': 'amount'})
renamed['amount'] = renamed['amount'] * 100   # safe — renamed is a logical copy
```

This actually **gets safer** under CoW — you don't accidentally mutate the source through a view.

### Pattern: passing DataFrames to functions

```python
def normalize(df):
    df['amount'] = df['amount'] / df['amount'].max()
    return df

# BEFORE (2.x): caller's df was mutated as a side effect
# AFTER (3.0): caller's df is untouched (function got a logical copy on the assignment)
result = normalize(my_df)
```

This is **better**: functions can no longer silently mutate their inputs.

### Pattern: setting a single column from another

```python
# WORKS under CoW
df['region_total'] = df.groupby('region')['amount'].transform('sum')

# Adding/replacing a column at the top level is always safe
df['flag'] = df['amount'] > 100
```

## When pandas physically copies

CoW means the **logical** semantics are copy. The runtime defers actual memory copies until needed (lazy view). You get a real copy when:

- You write to the column (`df['col'] = ...` or `df.loc[..., 'col'] = ...`)
- The original is garbage-collected before the view
- An operation explicitly materializes (`.reset_index()`, `.sort_values()`)

In practice, performance is comparable to 2.x for read-heavy workloads, slightly better for some pipelines (no defensive `.copy()` needed at every stage).

## `inplace=True` survives but loses its meaning

```python
df.fillna(0, inplace=True)
df.sort_values('ts', inplace=True)
```

In 3.0, `inplace=True` still mutates the object but **no longer guarantees zero-copy** under the hood. It's also been a long-running anti-pattern (breaks method chaining, harder to debug). **Prefer the functional style**:

```python
df = df.fillna(0).sort_values('ts')
# or
df = df.pipe(lambda d: d.fillna(0)).pipe(lambda d: d.sort_values('ts'))
```

3.0 also makes `inplace=True` methods return `self` instead of `None` — so you can chain them, though there's still no reason to use them over the functional form.

## Read-only arrays

Under CoW, NumPy arrays you get from `df.values` or `df['col'].to_numpy()` may be **read-only** (writeable=False). Always copy if you need to mutate:

```python
arr = df['col'].to_numpy()
arr[0] = 999    # may raise — array is read-only

arr = df['col'].to_numpy().copy()    # safe
# Or:
arr = df['col'].to_numpy(copy=True)  # explicit, future-proof
```

## What "chained assignment" means

The dangerous pattern is **two indexers on the left side** of `=`:

```python
df[mask]['col'] = x        # chained — silently no-ops
df.loc[mask]['col'] = x    # also chained
df.loc[mask].iloc[:, 0] = x  # also chained
```

The fix is always **one indexer** that takes both row and column selectors:

```python
df.loc[mask, 'col'] = x
df.iloc[mask, 0] = x
df.loc[df.index[mask], df.columns[0]] = x
```

## Detection in legacy code

To find chained assignment in 2.x code being ported:

```bash
# Heuristic grep — flag any `df[<expr>][<expr>] = ` or `df.loc[<expr>][<expr>] = `
grep -rnE '\][^]]*\][^]]*\s*=\s*[^=]' src/
```

Most are false positives but it's a useful starting point. Run on a small file first.

## Summary refactor table

| 2.x pattern | 3.0 pattern |
|---|---|
| `df[mask]['col'] = x` | `df.loc[mask, 'col'] = x` |
| `sub = df[mask]; sub['col'] = x` | `sub = df[mask].copy(); sub['col'] = x` |
| `pd.options.mode.copy_on_write = True` | Delete the line — CoW is default |
| `df.fillna(0, inplace=True)` | `df = df.fillna(0)` |
| Catching `SettingWithCopyWarning` | Delete the handler — warning is gone |
| `arr = df.values; arr[0]=x` | `arr = df.values.copy(); arr[0]=x` |
