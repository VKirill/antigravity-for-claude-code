# Window Functions — `.over()`

This is the single biggest reason to use Polars over pandas. `.over()` lets you compute per-group values **without** splitting and re-merging the frame.

## The pattern

```python
df.with_columns(
    pl.col("x").AGG().over("group_key").alias("x_agg_per_group")
)
```

Output has the **same row count** as input. The aggregation is broadcast back to every row of its group.

## Examples

### Per-group share / fraction
```python
df.with_columns(
    (pl.col("revenue") / pl.col("revenue").sum().over("region")).alias("share_of_region")
)
```

### Rank within group
```python
df.with_columns(
    pl.col("score").rank(method="ordinal", descending=True).over("user_id").alias("rank")
)
```

`method=` ∈ `{"average", "min", "max", "dense", "ordinal", "random"}` — same as pandas.

### Lag / lead with explicit ordering
```python
df.with_columns([
    pl.col("price").shift(1).over("symbol", order_by="ts").alias("prev_price"),
    pl.col("price").shift(-1).over("symbol", order_by="ts").alias("next_price"),
])
```

`order_by=` is **required** when the operation depends on row order (`shift`, `cum_sum`, `cum_min`, rolling, etc.) and the frame is not pre-sorted within the group.

### Cumulative aggregates per group
```python
df.with_columns([
    pl.col("amount").cum_sum().over("user_id", order_by="ts").alias("running_total"),
    pl.col("amount").cum_count().over("user_id", order_by="ts").alias("running_count"),
    pl.col("amount").cum_max().over("user_id", order_by="ts").alias("running_max"),
])
```

### Group-relative deltas
```python
df.with_columns(
    (pl.col("price") - pl.col("price").mean().over("symbol")).alias("price_dev_from_mean")
)
```

### First / last per group (broadcast)
```python
df.with_columns([
    pl.col("ts").first().over("session_id", order_by="ts").alias("session_start"),
    pl.col("ts").last().over("session_id", order_by="ts").alias("session_end"),
])
```

### Multiple `over` keys
```python
df.with_columns(
    pl.col("amount").sum().over(["country", "device"]).alias("total_per_country_device")
)
```

## `mapping_strategy=`

Controls how the per-group result is mapped back:

| Strategy | Behavior |
|---|---|
| `"group_to_rows"` (default) | Result vector length matches the input group length, broadcast row-by-row |
| `"explode"` | Treat result as a list, explode it; group lengths must align with input row count after explode |
| `"join"` | Like a `join` on the group key — collapses to one row per group then broadcasts |

You rarely need to set this; the default does what you expect for aggregates.

## `.over()` vs `group_by + join_back`

```python
# Antipattern — pandas habit
agg = df.group_by("region").agg(pl.col("revenue").sum().alias("total"))
result = df.join(agg, on="region")     # extra join, extra memory

# Idiomatic
result = df.with_columns(pl.col("revenue").sum().over("region").alias("total"))
```

The `.over()` form is one pass, no join, no temporary frame.

## Filtered window expressions

You can filter inside the window:

```python
df.with_columns(
    pl.col("amount").filter(pl.col("status") == "ok").sum().over("user_id").alias("ok_total")
)
```

## Rolling per group

```python
df.with_columns(
    pl.col("price").rolling_mean(window_size=10).over("symbol", order_by="ts").alias("ma10")
)
```

For time-anchored rolling (window expressed as a duration), use the `_by` variants:

```python
df.with_columns(
    pl.col("price").rolling_mean_by("ts", window_size="5m").over("symbol").alias("ma5m")
)
```

## Pitfalls

- **Forgot `order_by`**: `shift`, `cum_*`, and rolling over `.over()` will pick an unspecified order. Always pass `order_by=` for these.
- **`.over()` after `.group_by()`**: doesn't make sense — `.group_by` already collapses rows. Use `.over()` on the un-grouped frame instead.
- **Mixing `.over()` with `.agg()`** in the same `select`: `.over()` produces row-aligned output; `.agg()` collapses. Choose one form per pipeline step.
- **Returning lists from `over`**: if the operation produces a vector longer than the group (e.g., explode-style), set `mapping_strategy="explode"`.
