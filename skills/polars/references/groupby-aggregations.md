# Group-By and Aggregations

The method is `.group_by` (with underscore). The pandas-style `.groupby` was removed in 1.0.

## Basic pattern

```python
import polars as pl

agg = (
    df.group_by("symbol")
      .agg(
          pl.col("price").mean().alias("mean_price"),
          pl.col("qty").sum().alias("total_qty"),
          pl.col("ts").min().alias("first_ts"),
          pl.col("ts").max().alias("last_ts"),
          pl.len().alias("n_trades"),
      )
)
```

Aggregations inside `.agg(...)` are arbitrary **expressions**. Anything you can write as an expression — including conditionals, filtered aggregations, and arithmetic — works.

## Multi-key group_by

```python
df.group_by("country", "device").agg(
    pl.col("revenue").sum(),
    pl.col("user_id").n_unique().alias("dau"),
)
# Or:
df.group_by(["country", "device"]).agg(...)
```

## Filtered aggregations (pandas can't do this cleanly)

```python
df.group_by("user_id").agg(
    pl.col("amount").sum().alias("total"),
    pl.col("amount").filter(pl.col("status") == "ok").sum().alias("ok_total"),
    pl.col("amount").filter(pl.col("status") == "failed").sum().alias("failed_total"),
    (pl.col("status") == "failed").mean().alias("fail_rate"),
)
```

This compiles to a single pass over the data. In pandas you'd need multiple groupbys or `apply`.

## `pl.len()` vs `pl.col(x).count()` vs `pl.col(x).len()`

| | Counts nulls? | What it does |
|---|---|---|
| `pl.len()` | n/a | Number of rows in the group |
| `pl.col("x").len()` | yes | Length of column x in the group (= `pl.len()`) |
| `pl.col("x").count()` | no | Non-null count (matches SQL `COUNT(x)`) |
| `pl.col("x").n_unique()` | counts as one | Distinct values |

Polars 1.x aligned `.count()` with SQL semantics — it ignores nulls. Use `.len()` for the previous behavior.

## Sorting and limiting groups

```python
# Top 10 symbols by total qty
(
    df.group_by("symbol")
      .agg(pl.col("qty").sum().alias("total"))
      .sort("total", descending=True)
      .head(10)
)

# Maintain input order of groups
df.group_by("symbol", maintain_order=True).agg(...)
```

## Returning the unaggregated rows of a group

```python
df.group_by("user_id").agg(pl.col("amount"))     # amount is List[Float64], one list per user
df.group_by("user_id").agg(pl.all())             # all other columns wrapped as lists
```

Then `explode` to flatten:

```python
df.group_by("user_id").agg(pl.col("amount")).explode("amount")
```

## `group_by_dynamic` — time-series bucketing

```python
(
    df.sort("ts")
      .group_by_dynamic(
          index_column="ts",
          every="1h",        # bucket width
          period="1h",       # window width (≥ every; > every = overlapping windows)
          offset="0m",       # offset of first bucket
          closed="left",     # 'left' | 'right' | 'both' | 'none'
          group_by="symbol", # optional secondary keys
      )
      .agg(
          pl.col("price").mean().alias("vwap_proxy"),
          pl.col("qty").sum().alias("vol"),
      )
)
```

Polars expects the index column to be sorted; `group_by_dynamic` does not sort for you.

## Rolling group_by

`rolling` is a per-row windowed aggregation anchored on a time column. Unlike `group_by_dynamic`, it produces one row per input row.

```python
(
    df.sort("ts")
      .rolling(index_column="ts", period="5m", group_by="symbol")
      .agg(pl.col("price").mean().alias("rolling_mean_5m"))
)
```

For per-column rolling (not anchored on time), use the expression form:

```python
df.with_columns(pl.col("x").rolling_mean(window_size=10).alias("ma10"))
```

## `agg` vs `select` after `group_by`

`.agg(...)` is the standard form. There's also `.select(...)` on grouped data which behaves differently (less common — prefer `.agg`).

## Cardinality and performance

Polars picks group-by strategy based on cardinality estimates. For very high cardinality (millions of groups), the planner uses a hash strategy; for low cardinality, a faster path. You normally don't need to tune this.

For repeated group-bys on the same key, ensure the key column has a useful dtype (`Enum` or `Categorical` beats raw `String`).

## Pitfalls

- `df.group_by("k").agg(pl.col("x"))` (no aggregation function) returns **lists**, not scalars. Confuses pandas users.
- Group key columns are added first in the output; if you want a specific order, follow with `.select(...)`.
- `group_by_dynamic` requires a sorted index — running it on unsorted data silently produces wrong buckets. Always `.sort("ts")` first.
- Time period strings: `"1h"`, `"30m"`, `"1d"`, `"1w"`, `"1mo"`, `"1q"`, `"1y"`. Calendar units (`mo`, `q`, `y`) are non-uniform.
