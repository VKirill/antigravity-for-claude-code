---
name: polars
description: "Polars 1.40 — Rust-backed columnar DataFrame for Python. Lazy frames, query optimizer, streaming engine, expression API, Arrow memory model. Use when: polars, pola-rs, LazyFrame, DataFrame, pl.col, pl.lit, pl.when, .over, scan_parquet, scan_csv, sink_parquet, collect(engine='streaming'), group_by, with_columns, expressions, pandas alternative, ETL on millions of rows, large CSV/parquet. SKIP: small data wired to pandas (→pandas), server-side SQL (→postgresql), GPU compute (→cuda-python)."
stacks:
  - Polars
  - Python
tags:
  - polars
  - dataframe
  - etl
  - arrow
  - rust
packages:
  - polars
  - pyarrow
manifests:
  - pyproject.toml
risk: medium-stakes
source: vechkasov-global-skills
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Polars: `1.40.x`
- Python: `3.14.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->


## Use this skill when

- Building ETL pipelines over CSV / Parquet / NDJSON in the 100MB–100GB range
- Joining millions of rows where pandas chokes on memory
- Reading Parquet datasets with hive partitioning and predicate/projection pushdown
- Writing out-of-core transformations that must not load all data into RAM (`sink_parquet`)
- Replacing pandas `apply` with vectorized expression-based logic
- Computing window aggregates with `.over()` (rank, lag, cumulative sums per group)
- Time-series resampling and as-of joins on sorted timestamps
- Multi-key groupby aggregations that hit pandas categorical/object-dtype slowness
- Lazy query graphs with `.scan_*` + `.collect()` so the optimizer can push down filters
- Migrating an existing pandas codebase whose hot path is dataframe-bound

## Do not use this skill when

- Dataset is < 1 MB and already plugged into a pandas-only ML pipeline (sklearn/statsmodels expect pandas) — use **pandas**
- The right tool is SQL on the server — use **postgresql** or DuckDB
- GPU-resident compute is needed (cuDF / RAPIDS) — use **cuda-python** or a cuDF skill
- Geospatial-heavy work (shapely / GeoPandas) — Polars geo is still immature
- Streaming Kafka / event-bus ingestion — Polars batches files, not event streams

## Purpose

Polars is a Rust-implemented DataFrame library on top of Apache Arrow's columnar memory format. It exposes two execution modes: eager `DataFrame` (immediate compute, pandas-like) and lazy `LazyFrame` (query plan, optimized before execution). The point of using Polars over pandas is not "pandas with a faster backend" — it is a different programming model based on **expressions** that compose, parallelize across cores, and feed a cost-based query optimizer.

Polars wins decisively on large files, multi-key group-bys, window functions, and ETL with lazy IO. Pandas wins on tiny data, on libraries (sklearn / matplotlib / statsmodels) that consume pandas natively, and when the analyst writes ad-hoc one-liners in a notebook. The two coexist via `to_pandas()` / `from_pandas()` at boundaries.

## Capabilities

### LazyFrame, the query optimizer, and `.collect()`

`pl.scan_csv` / `pl.scan_parquet` / `pl.scan_ndjson` return a `LazyFrame`. Operations on it build a query plan; nothing executes until `.collect()`. The optimizer runs predicate pushdown, projection pushdown, slice pushdown, common-subplan elimination, expression simplification, join reordering, and type coercion. Inspect the plan with `.explain()`. See [references/lazy-vs-eager.md](references/lazy-vs-eager.md).

### Expression API — the core of Polars

Expressions (`pl.col`, `pl.lit`, `pl.when().then().otherwise()`, arithmetic, `.alias`, `.over`) are the lingua franca of Polars. They are declarative, composable, and the optimizer reasons over them. Expressions run inside **contexts**: `select`, `with_columns`, `filter`, `group_by(...).agg`, and `.over(...)` for window form. See [references/expressions-api.md](references/expressions-api.md).

### Streaming engine for out-of-core data

For datasets that exceed RAM, `.collect(engine="streaming")` and `sink_parquet` / `sink_csv` / `sink_ipc` stream chunks through the plan. Many but not all operations are streamable; the engine falls back where not supported. See [references/streaming.md](references/streaming.md).

### Group-by and aggregations with expression bodies

`df.group_by("k").agg(pl.col("x").sum(), pl.col("y").mean())` — aggregations are arbitrary expressions, including filtered and conditional ones. `group_by_dynamic` handles timeseries bucketing. See [references/groupby-aggregations.md](references/groupby-aggregations.md).

### Joins, including as-of

`.join(other, on=, how="inner|left|outer|cross|anti|semi", validate=, suffix=)` and `.join_asof` for time-aligned merges. See [references/joins.md](references/joins.md).

### Window expressions via `.over()`

The polars-idiomatic way to do per-group rank, lag/lead, cumulative aggregates is `pl.col("x").rank().over("k")` — no `groupby().apply()`. This is where Polars dramatically outperforms pandas. See [references/window-functions.md](references/window-functions.md).

### Strict, Arrow-backed type system

Polars dtypes (`Int64`, `Float64`, `String`, `Boolean`, `Date`, `Datetime`, `Duration`, `Categorical`, `Enum`, `Struct`, `List`, `Array`) are Arrow-native. Null semantics differ from pandas NaN — `None` / `Null` is a first-class value, not float NaN. See [references/data-types.md](references/data-types.md).

### Interop with pandas, NumPy, Arrow, DuckDB, PyTorch

`to_pandas()`, `from_pandas()`, `to_arrow()`, `from_arrow()`, `to_numpy()`. DuckDB reads/writes Polars directly. PyTorch dataloaders consume Polars via Arrow or NumPy. See [references/interop.md](references/interop.md).

### IO surface — `scan_*` vs `read_*`, hive partitioning, databases

`scan_*` returns lazy frames with pushdown into IO. `read_*` is eager. `pl.read_database` / `write_database` use ConnectorX or ADBC. Hive partitions are auto-discovered on parquet scans. See [references/io.md](references/io.md).

### Migration from pandas

The single densest reference in this skill. Translates `read_csv` → `scan_csv`/`read_csv`, `.loc[mask, cols]` → `.filter(...).select(...)`, `.apply` → expression, `.rolling` → `pl.col().rolling_*`, `.groupby().agg(dict)` → `.group_by().agg([exprs])`, dtype names, NaN ↔ Null. See [references/migration-from-pandas.md](references/migration-from-pandas.md).

## Behavioral Traits

- Always reaches for **expressions** before reaching for Python loops or `.map_elements` / `apply`.
- Always uses `scan_*` + `.collect()` over `read_*` for files larger than a few hundred MB.
- Always names lazy plans and inspects them with `.explain()` when performance is in question.
- Always specifies `schema=` (or `schema_overrides=`) on scans when columns are known — avoids slow inference and silent type drift.
- Prefers `sink_parquet` for outputs that don't need to live in memory.
- Prefers `.with_columns([...])` batched in a single call over chained one-column updates (single physical plan node).
- Uses `engine="streaming"` for datasets that don't fit RAM; verifies the operation is streamable by reading `.explain(streaming=True)`.
- Treats Polars Null and pandas NaN as different concepts; converts explicitly at boundaries.

## Important Constraints

- NEVER iterate a `DataFrame` row-by-row in Python — use expressions or, last resort, `.map_elements(strategy="thread_local")` with a documented justification.
- NEVER assume pandas NaN semantics. In Polars, `Null` is a distinct sentinel; `is_null()` is the test, not `is_nan()` (which only applies to floats).
- NEVER shadow the `pl` import (`pl = some_lazyframe` is a classic foot-gun in notebooks).
- NEVER load entire multi-GB Parquet datasets with `pl.read_parquet` when `pl.scan_parquet(...).filter(...).select(...).collect(engine="streaming")` would push the work down.
- NEVER mix `.groupby` (pandas) into Polars code — the Polars API is `.group_by` (1.x) and the old `.groupby` alias was removed.
- NEVER call `.collect()` more than once on the same `LazyFrame` if you can avoid it — cache with `.cache()` or materialize once and re-`.lazy()`.
- ALWAYS run `.explain()` on a slow query before assuming the optimizer is wrong; usually a missing filter or unnecessary `with_columns` is the cause.
- ALWAYS prefer `pl.col("x").over("k")` for per-group transforms over `group_by + join_back`.

## Related Skills

### Parent / sibling data tooling
- ✓ `python` — language foundation (typing, packaging, environments)
- ✓ `pandas` — small-data sibling; interop boundary via `to_pandas()` / `from_pandas()`
- ✓ `postgresql` — common source/sink via `read_database` / `write_database`

### Downstream ML / GPU
- ✓ `pytorch` — Polars feeds dataloaders via Arrow/NumPy; convert at the boundary
- ✓ `cuda-python` — when work needs to move to GPU (cuDF or Arrow-on-GPU)

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Capability map, lazy-vs-eager decision, when to open which reference | [references/REFERENCE.md](references/REFERENCE.md) |
| Polars dtypes, Arrow backing, Null semantics, casting, schema inference | [references/data-types.md](references/data-types.md) |
| Expression API — `pl.col`, `pl.lit`, `when/then/otherwise`, `.alias`, `.over`, contexts (select / with_columns / filter / group_by.agg / over) | [references/expressions-api.md](references/expressions-api.md) |
| LazyFrame vs DataFrame, `.lazy()` / `.collect()`, optimizer passes, `.explain()`, engine modes | [references/lazy-vs-eager.md](references/lazy-vs-eager.md) |
| IO — `scan_*` vs `read_*`, parquet hive partitioning, `read_database`, JSON / NDJSON, `sink_*` | [references/io.md](references/io.md) |
| Group-by and aggregations — multi-key, expression bodies, `group_by_dynamic`, rolling | [references/groupby-aggregations.md](references/groupby-aggregations.md) |
| Joins — `join`, `join_asof`, `how=`, `validate=`, `suffix=`, hash-join vs sort-merge planning | [references/joins.md](references/joins.md) |
| Window functions — `.over()` patterns, rank, lag/lead, cumulative aggregates; the polars-vs-pandas headline | [references/window-functions.md](references/window-functions.md) |
| Streaming engine — `collect(engine="streaming")`, `sink_*`, what's streamable, memory monitoring | [references/streaming.md](references/streaming.md) |
| pandas → polars migration cheat-sheet — read_csv, .loc, apply, rolling, dtypes, NaN vs Null | [references/migration-from-pandas.md](references/migration-from-pandas.md) |
| Interop — pandas / Arrow / NumPy / DuckDB / PyTorch tensors | [references/interop.md](references/interop.md) |
| Troubleshooting — PanicException, schema-mismatch on concat, plans not optimal, memory growth | [references/troubleshooting.md](references/troubleshooting.md) |
| Recommended defaults — when to go lazy, schema, streaming, parallelism | [references/recommended-defaults.md](references/recommended-defaults.md) |
| Wrong-vs-right code pairs — pandas-translated antipatterns vs idiomatic Polars | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases — routing prompts that should/shouldn't load this skill | [references/eval-cases.md](references/eval-cases.md) |

**How to use**: open the specific topic file. `migration-from-pandas.md` is the densest single document for engineers coming from pandas. `wrong-vs-right.md` is the fastest correction loop for code review.
