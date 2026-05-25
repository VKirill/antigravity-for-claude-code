---
name: pandas
description: "pandas 3.0 — DataFrame analysis library for Python. PyArrow-backed string dtype default, Copy-on-Write default, nullable Int64/Float64/BooleanDtype, datetime resolution inference, named aggregations, merge_asof/merge_ordered, anti-joins. Use when: pandas, dataframe, series, groupby, merge, join, pivot, melt, read_csv, read_parquet, to_parquet, timeseries, resample, datetime, multiindex, pyarrow, arrow, copy-on-write, CoW, dtype, NaN, NA, missing data, IndexSlice, NamedAgg, pd.col. SKIP: lazy/streaming > 1GB (→polars), ML pipelines (→scikit-learn), pure SQL aggregation (→postgresql), deep learning tensors (→pytorch)."
stacks:
  - pandas
  - python
packages:
  - pandas
  - pyarrow
  - numpy
tags:
  - pandas
  - dataframe
  - data-analysis
  - etl
manifests:
  - pyproject.toml
  - requirements.txt
source: vechkasov-global-skills
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- pandas: `3.0.x`
- Python: `3.14.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded when description matches the task. SKILL.md is the navigator — open only the reference file matching the sub-domain (IO, groupby, timeseries, etc.).

## Use this skill when

- Analyzing tabular data — exploration, filtering, sorting, aggregation
- ETL pipelines — reading CSV/Parquet/Excel/SQL, transforming, writing back
- Joining and merging DataFrames — inner/outer/left/right/cross, anti-joins, asof, ordered
- Grouping data with split-apply-combine — `groupby().agg()`, named aggregations, transform, filter
- Time-series work — `DatetimeIndex`, `resample`, `rolling`, `shift`, tz handling
- Reshaping — pivot, melt, stack/unstack, crosstab, explode, `get_dummies`
- Handling missing data — `NaN` vs `pd.NA`, fillna, dropna, interpolate, nullable dtypes
- Migrating from pandas 2.x — adopting Copy-on-Write, Arrow-backed strings, datetime resolution inference
- Optimizing memory / speed — categorical dtype, PyArrow backend, vectorized ops over `apply`/`iterrows`

## Do not use this skill when

- Workloads need streaming, lazy execution, or > 1 GB single-machine processing — use **polars** (sibling, lazy by default, multi-threaded by default)
- Building ML pipelines (estimators, cross-validation, pipelines) — use **scikit-learn** which consumes/produces pandas
- Aggregation/filtering can run database-side without pulling data — use **postgresql** with raw SQL
- Heavy numerical/matrix math on homogeneous arrays — use **numpy** directly
- Pure Python language questions (type hints, asyncio, packaging) — use **python**

## Purpose

pandas is the de facto DataFrame library for Python — labeled `Series` and `DataFrame` structures with rich indexing, aggregation, joining, and time-series facilities. As of pandas 3.0 (January 2026), the library defaults to a dedicated `str` dtype backed by PyArrow (no more `object` dtype for strings), Copy-on-Write semantics (chained assignment is now a hard error in practice, not a warning), and datetime resolution inference (`us` / `s` / `ns` chosen by input rather than always-`ns`). PyArrow is now a required dependency.

**pandas vs polars positioning**: pandas remains the right tool for interactive analysis, notebooks, ML feature-prep, and anything that fits comfortably in RAM (rule of thumb: data ≤ ~5× available memory with chunking, ≤ 1 GB without). For multi-GB, lazy/streaming, columnar query optimization, or strict schema enforcement, polars is faster and uses less memory — but lacks pandas' ecosystem breadth (matplotlib/seaborn/sklearn/statsmodels all speak pandas). Many production stacks use both: polars for ingest/heavy transforms, then `.to_pandas()` for downstream consumers.

## Capabilities

### Data structures and dtypes

`Series` (1D labeled array), `DataFrame` (2D labeled table), `Index` and `MultiIndex` (labels). In pandas 3.0 the default string dtype is `str` (PyArrow-backed) instead of `object`. Nullable dtypes (`Int64`, `Float64`, `boolean`, `string`, `ArrowDtype(...)`) handle missing values without coercing integers to float. Datetime resolution is inferred — strings parse to `datetime64[us]` by default rather than `[ns]`.

See [references/data-structures.md](references/data-structures.md) and [references/arrow-backend.md](references/arrow-backend.md).

### Indexing and selection

`.loc[]` (label-based), `.iloc[]` (positional), `.at[]` / `.iat[]` (scalar fast path), boolean masks, `.query()` (string expressions), `.filter()`, `.where()`, `.mask()`. MultiIndex slicing via `pd.IndexSlice`. With Copy-on-Write, every indexer returns a copy — mutate the result, not the original.

See [references/indexing-and-selection.md](references/indexing-and-selection.md).

### Group by — split-apply-combine

`df.groupby(keys).agg(...)` with **named aggregations** (`name=('col', 'aggfunc')` or `pd.NamedAgg`) is the preferred pattern in 3.0 — output column names are explicit, dict-syntax is deprecated. `transform` returns same-shape, `filter` returns a subset of groups, `apply` is the escape hatch (slow — prefer `agg`/`transform`).

See [references/groupby.md](references/groupby.md).

### Merge / join / concat

`pd.merge(left, right, how=..., on=..., validate=..., indicator=True)` — 3.0 adds `how='left_anti'` / `'right_anti'` and validates `how`. `merge_asof` for sorted nearest-key joins (timeseries); `merge_ordered` for ordered fillna joins. `concat` along axis 0 or 1 with `keys=` for hierarchical labels.

See [references/merge-join-concat.md](references/merge-join-concat.md).

### Time series

`DatetimeIndex`, `pd.date_range`, `resample('1h').agg(...)`, `rolling(window=...)`, `expanding`, `shift`, `tz_localize` / `tz_convert`. In 3.0 timezones use stdlib `zoneinfo` instead of `pytz`. `pd.offsets.Day` now preserves calendar time-of-day across DST (was 24h fixed).

See [references/timeseries.md](references/timeseries.md).

### IO

`read_parquet` / `to_parquet` (preferred for inter-process), `read_csv` (specify `dtype=` in production), `read_excel`, `read_json` (line-delimited for streams), `read_sql`. Chunked reads via `chunksize=`. Parquet partitioning via `partition_cols=`.

See [references/io.md](references/io.md).

### Missing data

`NaN` (legacy numeric) vs `pd.NA` (nullable dtypes — propagating logic). `isna` / `notna` / `fillna(method='ffill'|'bfill')` / `dropna` / `interpolate`. Nullable `Int64` survives missing values without float coercion.

See [references/missing-data.md](references/missing-data.md).

### Categorical

`CategoricalDtype` for low-cardinality columns — massive memory win, faster groupby, ordered comparisons. Maps cleanly to PyArrow dictionary type for parquet round-trip.

See [references/categorical.md](references/categorical.md).

### Copy-on-Write (3.0 default)

CoW is now ON unconditionally. Any indexer returns a logical copy; chained assignment (`df[mask]['col'] = x`) silently no-ops on the original. Refactor to `df.loc[mask, 'col'] = x`. The `mode.copy_on_write` option is deprecated and inert.

See [references/copy-on-write.md](references/copy-on-write.md).

## Behavioral Traits

- Always specify `dtype=` on `read_csv` in production code — inference is slow and silently downgrades types on edge rows
- Always prefer Parquet over CSV for any inter-process / inter-job IO — typed, compressed, columnar, ~10× faster
- Always vectorize over `iterrows` / `apply(axis=1)` — vectorized ops are typically 50–500× faster
- Always use **named aggregations** in `groupby().agg(...)` — explicit output names, deprecation-proof
- Always chain via `.pipe(func, *args)` for custom transforms — preserves CoW, keeps the pipeline readable
- Always call `.copy()` when intent is to mutate after a `.loc[]` / boolean-mask filter — explicit, future-proof
- Always read parquet partitioned datasets with `filters=[('col', '==', value)]` predicate pushdown — skips files
- Prefer `pd.NA`-aware nullable dtypes (`Int64`, `string`) over `NaN`-coercing numpy dtypes when missingness is semantic
- Convert legacy `object`-string columns via `df.convert_dtypes(dtype_backend='pyarrow')` for memory + speed wins

## Important Constraints

- NEVER use `iterrows()` in a hot loop — it boxes every row into a `Series`; use vectorized ops, `apply`, or `itertuples` if you must
- NEVER use chained assignment (`df[mask]['col'] = value`) — silently no-ops under CoW; always `df.loc[mask, 'col'] = value`
- NEVER call `df.str.contains(pattern)` without `na=False` — `NaN` propagates and breaks boolean indexing
- NEVER read large CSVs without `chunksize=` and explicit `dtype=` — memory blow-up + slow inference
- NEVER mix datetime dtypes silently — coerce inputs to one resolution (`us` or `ns`) before concat / merge / groupby on time keys
- NEVER trust `apply(axis=1)` to be fast — it's a Python-level loop with extra `Series` construction overhead
- NEVER store sensitive data in pickle — use parquet (no arbitrary-code execution, schema-validated)
- NEVER expect `mode.copy_on_write` to do anything in 3.0 — CoW is the default and the option is inert

## Related Skills

### Parent — Python language
- `python` — type hints, packaging, asyncio, pyproject.toml (pandas is a library, this skill is the runtime)

### Siblings — DataFrame / numeric ecosystem
- ✓ `polars` — Rust-based lazy DataFrame, multi-threaded by default, better for > 1 GB or streaming
- ✓ `scikit-learn` — ML pipelines; consumes/produces pandas DataFrames natively
- ✓ `pytorch` — tensor framework; pandas is the typical data-prep stage before tensor conversion
- ✓ `cuda-python` — GPU compute; pair with `df.to_numpy()` → CuPy for GPU-accelerated numerics

### Source/sink
- `postgresql` — `read_sql` / `to_sql` source/sink; push aggregations server-side when possible

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Index, decision map, when-to-use which doc | [references/REFERENCE.md](references/REFERENCE.md) |
| Series, DataFrame, Index, MultiIndex, dtypes (Arrow string default, nullable Int64/Float64/Boolean, datetime resolutions) | [references/data-structures.md](references/data-structures.md) |
| `.loc` / `.iloc` / `.at` / `.iat`, boolean indexing, `query`, `where`, `mask`, MultiIndex with `IndexSlice` | [references/indexing-and-selection.md](references/indexing-and-selection.md) |
| `groupby` split-apply-combine, named aggregations, transform, filter, apply, multi-key, MultiIndex grouping | [references/groupby.md](references/groupby.md) |
| `merge` (inner/outer/left/right/cross/anti), `join`, `concat`, `merge_asof`, `merge_ordered`, validate, indicator | [references/merge-join-concat.md](references/merge-join-concat.md) |
| `DatetimeIndex`, `resample`, `rolling`, `shift`, `tz_localize`/`tz_convert`, zoneinfo, Period vs Timestamp, DST | [references/timeseries.md](references/timeseries.md) |
| `read_csv`/`read_parquet`/`read_excel`/`read_json`/`read_sql`, `to_parquet`, dtype inference, chunked reads, partitioning | [references/io.md](references/io.md) |
| Copy-on-Write semantics in 3.0, what changed from 2.x, refactor patterns, chained assignment | [references/copy-on-write.md](references/copy-on-write.md) |
| PyArrow string default, `ArrowDtype`, numpy vs pyarrow-backed columns, `.convert_dtypes(dtype_backend='pyarrow')` | [references/arrow-backend.md](references/arrow-backend.md) |
| `NaN` vs `pd.NA`, `isna`/`notna`, `fillna`/`dropna`/`interpolate`, nullable integers, propagation rules | [references/missing-data.md](references/missing-data.md) |
| `CategoricalDtype`, ordered categories, memory savings, groupby speedup, parquet dictionary round-trip | [references/categorical.md](references/categorical.md) |
| Troubleshooting — SettingWithCopyWarning legacy, dtype drift, datetime parse failures, mixed types, slow apply | [references/troubleshooting.md](references/troubleshooting.md) |
| Recommended defaults — parquet over CSV, explicit dtypes on read, `.pipe()` chains, named aggregations | [references/recommended-defaults.md](references/recommended-defaults.md) |
| Wrong vs right — chained assignment, iterrows, str.contains without `na=False`, mixed datetime, apply for row math | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases — positive and negative routing prompts | [references/eval-cases.md](references/eval-cases.md) |

**How to use**: open the specific topic file. SKILL.md is the navigator — don't read the whole references/ directory.
