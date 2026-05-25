# Polars Reference Index

Slim navigator. Open the specific file that matches your task.

## Decision map — "I need to…"

| Task | Open |
|---|---|
| Decide between `DataFrame` and `LazyFrame` for a new pipeline | [lazy-vs-eager.md](lazy-vs-eager.md) |
| Write a column transformation (one column or many) | [expressions-api.md](expressions-api.md) |
| Group rows and aggregate | [groupby-aggregations.md](groupby-aggregations.md) |
| Compute per-group rank / lag / cumulative — without splitting the frame | [window-functions.md](window-functions.md) |
| Merge two frames | [joins.md](joins.md) |
| Read or write a file (CSV / Parquet / NDJSON / database) | [io.md](io.md) |
| Work with a dataset bigger than RAM | [streaming.md](streaming.md) |
| Convert from / to pandas / Arrow / NumPy / PyTorch / DuckDB | [interop.md](interop.md) |
| Translate pandas code to Polars | [migration-from-pandas.md](migration-from-pandas.md) |
| Understand dtype semantics (Null vs NaN, casting, schema) | [data-types.md](data-types.md) |
| Diagnose a `PanicException`, OOM, slow query | [troubleshooting.md](troubleshooting.md) |
| Pick sensible defaults (lazy threshold, schema, streaming) | [recommended-defaults.md](recommended-defaults.md) |
| Spot pandas-translated antipatterns in code review | [wrong-vs-right.md](wrong-vs-right.md) |
| Validate routing prompts for this skill | [eval-cases.md](eval-cases.md) |

## Lazy vs eager — quick rule

| Dataset size | Mode | Reader |
|---|---|---|
| < 100 MB or already in memory | Eager `DataFrame` is fine | `pl.read_csv` / `pl.read_parquet` / `pl.DataFrame(dict)` |
| 100 MB – 1 GB | Lazy preferred (pushdown wins) | `pl.scan_csv` / `pl.scan_parquet` + `.collect()` |
| 1 GB – fits-in-RAM | Lazy with explicit `schema=` | `.scan_*().collect()` |
| > RAM | Lazy + streaming engine | `.scan_*().sink_parquet(...)` or `.collect(engine="streaming")` |

## Three-line mental model

1. Build a `LazyFrame` plan via `scan_*` and chained methods (`filter`, `select`, `with_columns`, `group_by`, `join`).
2. Use **expressions** (`pl.col`, `pl.lit`, `pl.when`, `.over`) everywhere a column is referenced.
3. Call `.collect()` (eager engine) or `.collect(engine="streaming")` / `.sink_parquet()` (streaming engine) at the end.

That's the whole API surface for 80% of pipelines. The rest of the references zoom in on each piece.
