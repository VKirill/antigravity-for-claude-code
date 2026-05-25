# Troubleshooting

Common failures and the canonical fix.

## `PanicException` from the Rust core

Polars panics if an internal invariant is broken. Usually caused by:

- Mixing types in a `concat` (`Int32` + `Int64`)
- Operating on a non-finite float where the function requires finite (e.g., `quantile` on a column with all-NaN)
- Constructing a `Categorical` outside a `StringCache` and then comparing across frames

**Fix**: catch the panic message and search the Polars issue tracker. Always include:
- Polars version (`pl.show_versions()`)
- Minimal reproducer (10–20 lines)
- Output of `lf.explain()` if it's a lazy plan

```python
# Common: schema mismatch in concat
pl.concat([a, b])                                  # raises if schemas differ
pl.concat([a, b], how="vertical_relaxed")          # auto-supertype the columns
pl.concat([a, b], how="diagonal")                  # union of columns, missing ones become Null
pl.concat([a, b], how="diagonal_relaxed")          # both, with supertype
```

## Schema mismatch on `pl.concat`

```
SchemaError: type Int32 is incompatible with expected type Int64
```

Either pre-cast each frame to a common schema, or use `how="vertical_relaxed"` / `"diagonal_relaxed"` to let Polars upcast automatically. For multi-file scans where one file has an extra column, use `pl.scan_parquet([...], allow_missing_columns=True)`.

## Lazy plan is "not optimal" — what to check

Run `lf.explain()` and look for:

- **Filter not pushed into scan**: there's likely a non-deterministic or Python UDF between the filter and the scan. Move the filter immediately after `scan_*`.
- **Many separate `WITH_COLUMNS` nodes**: collapse into one `.with_columns([expr1, expr2, ...])`.
- **`COLLECT` node early in the plan**: an inadvertent `.collect()` materialized mid-plan. Search the code for stray `.collect()` calls.
- **`SLICE` not pushed down**: `.head(n)` is at the top of the plan but not propagated to the scan. Reorder so the slice can travel down (no operations that depend on count between).
- **Hash join on huge frames**: planner picked hash join when sort-merge would be cheaper. If both sides are pre-sorted on the key, pass `algorithm="sort_merge"` or sort+collect first.

## Memory growth / OOM

1. Run `.explain(streaming=True)` — confirm streamability.
2. Switch from `.collect()` to `.collect(engine="streaming")` or `sink_parquet`.
3. Lower `POLARS_STREAMING_CHUNK_SIZE`.
4. Avoid `.unique()` and `.sort()` on very high-cardinality columns — they materialize.
5. Check for unintentional `to_pandas()` / `to_numpy()` in the pipeline — those force materialization.
6. Beware large `Object`-typed columns: each row is a boxed Python object, no Arrow speedup.

## "Cannot compare values of different types"

Polars is strict: comparing `Datetime("us")` to `Datetime("ns")` raises. Cast first:

```python
df.with_columns(pl.col("ts").cast(pl.Datetime("ns")))
```

Same trap with tz-aware vs naive Datetime — Polars refuses the comparison.

## `is_null()` returns False on a NaN

`Null` and `NaN` are different. Use `is_null() | is_nan()` for the pandas-style "missing" check, or pre-normalize:

```python
df = df.with_columns(pl.col(pl.Float64).fill_nan(None))
# Now is_null() catches both
```

## "duplicate column" after a join

You joined on different left/right names and didn't set `suffix=` while the result kept both. Pass `coalesce=True` if you want one column, or `suffix="_right"` to keep both distinguishable.

## Categorical comparisons fail across frames

```
ComputeError: cannot compare categoricals coming from different sources
```

Either use `pl.Enum` (a fixed vocabulary, always cross-frame compatible) or wrap the code in a global string cache:

```python
with pl.StringCache():
    df1 = df1.with_columns(pl.col("status").cast(pl.Categorical))
    df2 = df2.with_columns(pl.col("status").cast(pl.Categorical))
    out = df1.join(df2, on="status")
```

Prefer `Enum` — it doesn't need the cache.

## `shift` / `cum_sum` over `.over()` gives wrong values

You forgot `order_by=`. Window operations that depend on row order silently use an arbitrary order otherwise:

```python
# Wrong
pl.col("amount").cum_sum().over("user_id")

# Right
pl.col("amount").cum_sum().over("user_id", order_by="ts")
```

## `join_asof` produces all-Null right side

Both frames must be sorted on the `on=` key. If `by=` is set, both must also be sorted within each `by` group. Pattern:

```python
left  = left.sort("symbol", "ts")
right = right.sort("symbol", "ts")
left.join_asof(right, on="ts", by="symbol")
```

## `with_columns` doesn't update an existing column

It does — by name. If the alias matches an existing column, that column is replaced. If your output looks unchanged, the alias is probably wrong (typo in `.alias("price")` vs `.alias("Price")`).

## Slow query on a Parquet directory

- Confirm `hive_partitioning=True` is set if you use `key=value/` folders.
- Confirm filters reference partition keys (those prune entire files).
- Confirm `select(...)` happens before unnecessary `with_columns` so projection pushdown drops unused columns at the file level.

## `map_elements` running serially

That's by design — Python UDFs hold the GIL. To go parallel:
1. Refactor to expressions if at all possible.
2. If you must, use `map_batches` instead — it operates on a whole chunk per call and lets vectorized NumPy / Arrow code run.
3. As a last resort, split the frame and use `concurrent.futures.ThreadPoolExecutor` on `to_pandas` chunks.

## How to file a useful bug report

```python
print(pl.show_versions())     # OS, Polars + deps
print(lf.explain())           # plan
print(df.head().to_dict())    # tiny reproducer data
```

Reproducer should be < 30 lines and not depend on private files.
