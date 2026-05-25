# Recommended Defaults

Single source of truth for the knobs other references mention. Edit here, not inline.

## File-size thresholds

| Threshold | Recommendation |
|---|---|
| < 100 MB on disk | Eager (`pl.read_*`) is fine; lazy adds no value |
| 100 MB – 1 GB | Lazy (`pl.scan_*` + `.collect()`); pushdown wins |
| 1 GB – fits in RAM | Lazy with explicit `schema=`; one batched `with_columns` |
| > RAM | Lazy + streaming engine (`collect(engine="streaming")` or `sink_*`) |

## Schema specification

- **Always pass `schema=`** to `scan_csv` / `scan_ndjson` when column types are known.
- For `scan_parquet`, the schema is in the file footer — pass `schema_overrides=` only to relax/upcast.
- For `read_database`, type info comes from the DB driver — no schema arg needed.

## Storage format

| Choose | Format | Compression |
|---|---|---|
| Analytical / archival | Parquet | `zstd` (level 3 default is fine) |
| Cross-language Polars round-trip | Arrow IPC | `zstd` |
| Streaming logs | NDJSON or Parquet | `zstd` |
| Interop with non-Arrow tools only | CSV | external gzip if size matters |

CSV is the worst storage format for analytics — no schema, no pushdown, slow parse. Use it only when forced.

## Streaming knobs

| Env var | Default | Tune when |
|---|---|---|
| `POLARS_STREAMING_CHUNK_SIZE` | engine-tuned | OOM during streaming → halve until stable |
| `POLARS_MAX_THREADS` | physical cores | Sharing a host with other workloads → set to half |
| `POLARS_TEMP_DIR` | OS tmp | Large external sort → point at fast local disk with space |
| `POLARS_VERBOSE` | unset | Debugging streaming → `1` |

## Expression batching

- **Always batch `with_columns([expr1, expr2, ...])`** in one call, not chained one-per-expression.
- The optimizer reorders and parallelizes only what it sees together.

## Group-by

- Prefer `Enum` over `Categorical` over `String` for high-cardinality keys.
- Use `pl.len()` for "rows in group", `pl.col(x).count()` for "non-null values in column x" (SQL semantics).
- Set `maintain_order=True` only when output order matters — it has a small cost.

## Joins

- Always pass `validate="m:1"` (or stricter) when you believe one side is a dimension table. Surfaces bugs early.
- Always sort both sides before `join_asof`; sort within `by=` groups too.
- Use `coalesce=True` when joining on differently-named keys and you want a single output column.

## Window expressions

- Always pass `order_by=` to `.over()` for order-dependent operations (`shift`, `cum_*`, rolling).
- Prefer `.over()` over `group_by + join` for per-group computations on row-aligned output.

## Engine choice

| If… | Use |
|---|---|
| Data fits in RAM, you want max speed | `.collect()` (default eager engine) |
| Intermediates won't fit | `.collect(engine="streaming")` |
| Final output also won't fit | `sink_parquet` / `sink_csv` / `sink_ipc` |
| Need a specific optimization off for debugging | `.collect(optimizations=pl.QueryOptFlags(predicate_pushdown=False))` |

## Code-style defaults

- Import as `import polars as pl` — never `from polars import *`.
- Reference columns with `pl.col("name")`, not `df["name"]` inside expression contexts.
- Name lazy plans with descriptive variables (`trades_q`, `daily_agg`) — they're cheap, eager `.collect()` is the expensive part.
- Inspect with `.explain()` before optimizing.

## Anti-defaults — never reach for these without justification

- `pl.col("x").map_elements(fn)` — only when no native expression covers it.
- `df.iter_rows()` / `df.to_dicts()` — only at API boundaries.
- `pl.Object` dtype — only to wrap a Python-only value at a boundary.
- `df.to_pandas()` mid-pipeline — only at the final ML/plotting boundary.
- `.collect()` inside a loop — materialize once, reuse the DataFrame.
