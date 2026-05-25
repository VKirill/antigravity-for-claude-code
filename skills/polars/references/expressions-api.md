# Expression API

Expressions are the core of Polars. Everything column-related is an expression.

## What an expression is

An expression is a lazy description of a per-column computation. It does nothing on its own — it is evaluated inside a **context**.

```python
import polars as pl

expr = pl.col("price") * pl.col("qty")  # not a value, a plan
```

## Contexts that evaluate expressions

| Context | Method | Output | Notes |
|---|---|---|---|
| Projection | `df.select(...)` | Columns produced by the listed expressions, original frame discarded | |
| Mutation | `df.with_columns(...)` | All original columns + new/replaced ones | Batch many in one call |
| Filtering | `df.filter(expr)` | Rows where `expr` evaluates `True` | `expr` must produce `Boolean` |
| Group aggregation | `df.group_by(...).agg(...)` | One row per group, aggregations as columns | Inside `.agg`, expressions auto-aggregate |
| Window | `expr.over(...)` | Same number of rows as input, value computed per group | Used inside `select` / `with_columns` |
| Sort | `df.sort(by, descending=False)` | Sorted frame; `by` can be expression(s) | |

## Building blocks

### `pl.col` — reference a column
```python
pl.col("price")
pl.col("price", "qty")        # multiple — produces multiple output columns
pl.col(pl.Float64)            # by dtype — all Float64 cols
pl.col("^price_.*$")          # regex
pl.col("*")                   # all columns
pl.all()                      # also all columns
pl.exclude("id", "ts")        # all except these
```

### `pl.lit` — literal value
```python
pl.lit(0)
pl.lit("USD")
pl.lit(datetime.date(2026, 1, 1))
pl.lit(None, dtype=pl.Int64)   # typed null
```

### Arithmetic and comparisons
```python
pl.col("a") + pl.col("b")
pl.col("price") * 1.2
pl.col("qty") >= 10
(pl.col("a") > 0) & (pl.col("b") < 100)    # & | ~ for boolean combine
```

### `.alias` — name the output
```python
(pl.col("price") * pl.col("qty")).alias("notional")
```

### `pl.when / .then / .otherwise` — conditional
```python
pl.when(pl.col("qty") > 0)
  .then(pl.lit("buy"))
  .when(pl.col("qty") < 0)
  .then(pl.lit("sell"))
  .otherwise(pl.lit("flat"))
  .alias("side")
```

### String, datetime, list, struct namespaces
Every expression exposes namespaces for typed operations:
```python
pl.col("name").str.to_lowercase()
pl.col("name").str.contains("(?i)admin")
pl.col("ts").dt.year()
pl.col("ts").dt.truncate("1h")
pl.col("tags").list.len()
pl.col("tags").list.contains("vip")
pl.col("addr").struct.field("zip")
```

### Aggregations (inside `group_by().agg` or as scalars)
```python
pl.col("x").sum()
pl.col("x").mean()
pl.col("x").min(), .max(), .median(), .quantile(0.95)
pl.col("x").std(), .var()
pl.col("x").n_unique()
pl.col("x").len()        # count incl. nulls
pl.col("x").count()      # count excl. nulls (SQL COUNT)
pl.col("x").first(), .last()
pl.col("x").filter(pl.col("y") > 0).sum()   # filtered aggregation
pl.col("x").mode()
```

## Expression composition — one `select`, many columns

Polars rewards batching expressions in a single context — the optimizer sees them all and parallelizes.

```python
out = df.select([
    pl.col("price"),
    pl.col("qty"),
    (pl.col("price") * pl.col("qty")).alias("notional"),
    pl.col("ts").dt.truncate("1h").alias("bucket"),
    pl.when(pl.col("qty") > 0).then(pl.lit("buy")).otherwise(pl.lit("sell")).alias("side"),
])
```

`with_columns` is the same idea but keeps the existing columns.

## Window expressions — `.over()`

`.over(key)` evaluates an aggregation **per group** but returns the **same number of rows** as the input (broadcasted). This is the canonical replacement for `groupby().apply()` from pandas.

```python
df.with_columns([
    # rank per group
    pl.col("score").rank(method="ordinal").over("user_id").alias("rank"),

    # group share
    (pl.col("revenue") / pl.col("revenue").sum().over("region")).alias("share"),

    # cumulative within group, ordered by ts
    pl.col("amount").cum_sum().over("user_id", order_by="ts").alias("running"),

    # lag / lead
    pl.col("price").shift(1).over("symbol", order_by="ts").alias("prev"),
])
```

See [window-functions.md](window-functions.md) for the full pattern catalogue.

## Lazy expression composition

Expressions can be assigned and reused. No execution happens until a context evaluates them.

```python
spread = (pl.col("ask") - pl.col("bid")).alias("spread")
mid    = ((pl.col("ask") + pl.col("bid")) / 2).alias("mid")

quotes.select([pl.col("ts"), pl.col("symbol"), spread, mid])
```

## `map_elements` — escape hatch (avoid)

If — and only if — no expression / namespace method covers your case, `pl.col("x").map_elements(fn)` runs a Python callable per element. This is **slow** and not parallelized. Always prefer expressions. Pass `return_dtype=` to avoid the warning.

```python
# Last resort
pl.col("payload").map_elements(json.loads, return_dtype=pl.Struct({...}))
```

`map_batches(fn)` operates on a whole chunk (`Series`) and is faster when vectorizable in NumPy / Arrow.

## Gotchas

- `pl.col("x").sum()` outside `group_by` produces a **scalar** (one-row frame). Inside `with_columns` it broadcasts.
- `.over()` defaults to unordered. For time-dependent aggregates (`cum_sum`, `shift`), pass `order_by=` explicitly.
- `pl.col("a", "b").sum()` returns **two columns** — `a` and `b` summed. Use distinct calls for one column each if needed.
- Forgot to `.alias()` after a computation → output column inherits the leftmost column's name, which surprises readers in code review.
