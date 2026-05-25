# LazyFrame vs DataFrame

Polars has two execution modes. Choose the right one — they are not interchangeable.

## DataFrame — eager

`DataFrame` operations execute immediately, like pandas. Use for small data, exploration, notebooks, or when the data is already in memory.

```python
import polars as pl

df = pl.read_csv("trades.csv")
out = (
    df.filter(pl.col("qty") > 0)
      .with_columns((pl.col("price") * pl.col("qty")).alias("notional"))
)
# `out` is a DataFrame, ready to inspect
```

## LazyFrame — query plan, executed by `.collect()`

`LazyFrame` builds a plan. Nothing runs until `.collect()` (or `.sink_*`). The optimizer reorders, pushes down filters and projections, and parallelizes.

```python
lf = pl.scan_csv("trades.csv")          # nothing read yet
plan = (
    lf.filter(pl.col("qty") > 0)
      .with_columns((pl.col("price") * pl.col("qty")).alias("notional"))
      .group_by("symbol")
      .agg(pl.col("notional").sum())
)
out = plan.collect()                    # now Polars opens the file, pushes the filter
                                        # into the CSV reader, runs the agg, returns DataFrame
```

## When to use which

| Situation | Pick |
|---|---|
| File > ~100 MB | LazyFrame (`scan_*`) |
| Reading Parquet with selective columns / filters | LazyFrame (pushdown) |
| Interactive notebook with a 10 MB CSV | DataFrame |
| Chained transformations you want optimized | LazyFrame |
| One-shot inspection (`.head()`, `.describe()`) | DataFrame |
| Dataset doesn't fit in RAM | LazyFrame + streaming engine |

## Switching modes

```python
df.lazy()       # DataFrame  -> LazyFrame
lf.collect()    # LazyFrame  -> DataFrame  (eager engine, default)
lf.collect(engine="streaming")   # LazyFrame -> DataFrame  (streaming engine, chunked)
```

## Optimizer passes

| Pass | What it does |
|---|---|
| Predicate pushdown | Move `filter` down to the scan so the reader skips rows |
| Projection pushdown | Read only the columns you actually use |
| Slice pushdown | `head(n)` / `limit(n)` propagates so the reader stops early |
| Common subplan elimination | Cache repeated subgraphs (matters in `pl.collect_all`) |
| Simplify expressions | Constant folding, dead-code elimination |
| Join ordering | Reorder join branches to minimize materialized sizes |
| Type coercion | Insert minimum casts |
| Cardinality estimation | Pick hash vs sort-merge join, pick group-by strategy |

You can disable individual passes for debugging:

```python
lf.collect(optimizations=pl.QueryOptFlags(predicate_pushdown=False))
```

## `.explain()` — inspect the optimized plan

Always run this first if a lazy query is slow or producing surprising results.

```python
print(lf.explain())                 # optimized plan
print(lf.explain(optimized=False))  # the naive plan you wrote
print(lf.explain(format="tree"))    # tree view, more readable
```

Look for:
- `FILTER` nodes that have been pushed down into the scan (good)
- `WITH_COLUMNS` nodes ahead of a `FILTER` they don't depend on (bad — move the filter earlier)
- `Σ JOIN` left-vs-right side sizes for hash join, or a `SORT_MERGE_JOIN` for already-sorted keys

## Streaming engine

For datasets that don't fit in memory:

```python
out = lf.collect(engine="streaming")
# or write directly:
lf.sink_parquet("output.parquet")
```

The streaming engine processes data in chunks. Most operations are supported; some (e.g., certain `over` patterns, pivots on unknown columns) fall back to in-memory. See [streaming.md](streaming.md).

## Common pitfalls

- **Calling `.collect()` inside a hot loop**: each call re-runs the plan from scratch. Materialize once.
- **Re-introducing pandas habits**: chaining `df = df.with_columns(...)` per column instead of one batched `with_columns([...])`. The optimizer sees only what's batched.
- **Mixing `pl.collect_all([lf1, lf2, lf3])` for shared subplans**: only worth it if `lf1..lf3` share a common ancestor (e.g., the same `scan_*`) — Polars then computes the common part once.
- **`.head(5).collect()` on a parquet dataset**: with slice pushdown, this reads only the first row group, not the whole file. Verify with `.explain()`.

## Reuse a materialized DataFrame lazily

If you need to run several queries against the same intermediate result, materialize once and lift back to lazy:

```python
base = (
    pl.scan_parquet("events.parquet")
      .filter(pl.col("ts").dt.year() == 2026)
      .collect()                  # materialize once
)
# Now run several lazy plans on top
q1 = base.lazy().group_by("user_id").agg(pl.col("amount").sum())
q2 = base.lazy().group_by("country").agg(pl.col("amount").mean())
```
