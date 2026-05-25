# Wrong vs Right

Side-by-side antipatterns common in pandas-translated code, with idiomatic Polars equivalents.

## 1. Chained single-column updates instead of batched `with_columns`

```python
# WRONG — three plan nodes
df = df.with_columns(pl.col("price") * pl.col("qty")).alias("notional"))
df = df.with_columns(pl.col("ts").dt.year().alias("year"))
df = df.with_columns(pl.col("name").str.to_lowercase())

# RIGHT — one plan node, optimizer sees all three together
df = df.with_columns(
    (pl.col("price") * pl.col("qty")).alias("notional"),
    pl.col("ts").dt.year().alias("year"),
    pl.col("name").str.to_lowercase(),
)
```

## 2. `apply` / `map_elements` for things expressions can do

```python
# WRONG — Python per row, GIL-bound, ~50x slower
df = df.with_columns(
    pl.col("name").map_elements(lambda s: s.upper(), return_dtype=pl.String)
)

# RIGHT — vectorized, parallel
df = df.with_columns(pl.col("name").str.to_uppercase())
```

## 3. `group_by + join` instead of `.over()`

```python
# WRONG — extra join, extra memory
totals = df.group_by("region").agg(pl.col("revenue").sum().alias("total"))
out = df.join(totals, on="region").with_columns(
    (pl.col("revenue") / pl.col("total")).alias("share")
)

# RIGHT — one pass
out = df.with_columns(
    (pl.col("revenue") / pl.col("revenue").sum().over("region")).alias("share")
)
```

## 4. `read_parquet` then filter, instead of `scan_parquet` + filter

```python
# WRONG — reads the whole file into memory, then filters
df = pl.read_parquet("events.parquet")
df = df.filter(pl.col("year") == 2026).select("user_id", "amount")

# RIGHT — predicate + projection pushdown, only what's needed is read
out = (
    pl.scan_parquet("events.parquet")
      .filter(pl.col("year") == 2026)
      .select("user_id", "amount")
      .collect()
)
```

## 5. Iterating rows in Python

```python
# WRONG
totals = {}
for row in df.iter_rows(named=True):
    totals[row["user_id"]] = totals.get(row["user_id"], 0) + row["amount"]

# RIGHT
totals = df.group_by("user_id").agg(pl.col("amount").sum())
```

## 6. `.collect()` inside a loop

```python
# WRONG — re-runs the whole plan every iteration
lf = pl.scan_parquet("data.parquet").filter(pl.col("x") > 0)
results = []
for k in keys:
    results.append(lf.filter(pl.col("k") == k).collect())

# RIGHT — materialize once
df = pl.scan_parquet("data.parquet").filter(pl.col("x") > 0).collect()
results = [df.filter(pl.col("k") == k) for k in keys]

# BETTER — single grouped pass
result = df.filter(pl.col("k").is_in(keys)).group_by("k").agg(...)
```

## 7. `.groupby` (typo / pandas habit) — does not exist

```python
# WRONG — AttributeError in 1.x
df.groupby("symbol").agg(...)

# RIGHT
df.group_by("symbol").agg(...)
```

## 8. Treating `Null` and `NaN` as the same

```python
# WRONG — misses NaN values
df.filter(pl.col("x").is_null())

# RIGHT — explicit about which sentinel
df.filter(pl.col("x").is_null() | pl.col("x").is_nan())
# or normalize first
df = df.with_columns(pl.col(pl.Float64).fill_nan(None))
df.filter(pl.col("x").is_null())
```

## 9. No `order_by` on order-dependent `.over()`

```python
# WRONG — arbitrary order within the group
df.with_columns(pl.col("amount").cum_sum().over("user_id"))

# RIGHT
df.with_columns(pl.col("amount").cum_sum().over("user_id", order_by="ts"))
```

## 10. Mid-pipeline `to_pandas()` for a single missing operation

```python
# WRONG — materializes, leaves Polars, loses lazy benefits
df_pd = df.to_pandas()
df_pd["score"] = df_pd["a"] * df_pd["b"]      # plain arithmetic — Polars has this!
df = pl.from_pandas(df_pd)

# RIGHT — stay in Polars
df = df.with_columns((pl.col("a") * pl.col("b")).alias("score"))
```

The only valid reason to leave Polars is to feed a library that won't take Arrow / Polars frames (scikit-learn, matplotlib, etc.) — and even then, only at the final boundary.

## 11. Forgetting `.alias()` after a computation

```python
# WRONG — output column inherits leftmost input name; confusing in review
df.select(pl.col("price") * pl.col("qty"))    # column is named "price"

# RIGHT
df.select((pl.col("price") * pl.col("qty")).alias("notional"))
```

## 12. `pl.concat` on schema-incompatible frames without `_relaxed`

```python
# WRONG — raises SchemaError
pl.concat([a_int32, b_int64])

# RIGHT
pl.concat([a_int32, b_int64], how="vertical_relaxed")
# or pre-cast to a common schema
pl.concat([a_int32.cast({"x": pl.Int64}), b_int64])
```

## 13. Loading a massive Parquet "to look at it"

```python
# WRONG — OOM on a 50 GB file
df = pl.read_parquet("big.parquet")
df.head()

# RIGHT — slice pushes down
pl.scan_parquet("big.parquet").head(20).collect()

# Or for schema-only inspection
pl.scan_parquet("big.parquet").schema
```

## 14. Building `Categorical` across frames without `StringCache` or `Enum`

```python
# WRONG — ComputeError on join
a = a.with_columns(pl.col("status").cast(pl.Categorical))
b = b.with_columns(pl.col("status").cast(pl.Categorical))
a.join(b, on="status")

# RIGHT — Enum is always cross-frame compatible
status_dt = pl.Enum(["pending", "ok", "failed"])
a = a.with_columns(pl.col("status").cast(status_dt))
b = b.with_columns(pl.col("status").cast(status_dt))
a.join(b, on="status")
```

## 15. `df["col"] = ...` style mutation

```python
# WRONG — not valid Polars; tries to call __setitem__
df["score"] = df["a"] * df["b"]

# RIGHT — Polars frames are immutable; every op returns a new frame
df = df.with_columns((pl.col("a") * pl.col("b")).alias("score"))
```
