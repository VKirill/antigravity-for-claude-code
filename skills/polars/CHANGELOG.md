# Changelog

All notable changes to the `polars` skill are documented here. Follows SemVer at the skill level.

## [1.0.0] — 2026-05-16

Initial release. Pattern 2 medium-stakes skill for Polars 1.40.x — Rust-backed columnar DataFrame for Python.

### Added

- `SKILL.md` navigator (under 250 lines): purpose vs pandas, capabilities (LazyFrame, expressions, streaming, group-by, joins, windows, types, interop, IO, migration), behavioral traits, NEVER/ALWAYS constraints, related skills.
- `references/REFERENCE.md` — decision map, lazy-vs-eager size thresholds, three-line mental model.
- `references/data-types.md` — full dtype catalogue (Int*, Float*, String, Date, Datetime, Duration, Categorical, Enum, List, Array, Struct), Null-vs-NaN semantics, schema overrides.
- `references/expressions-api.md` — `pl.col`, `pl.lit`, `pl.when/then/otherwise`, `.alias`, `.over`, namespaces, aggregations, contexts, `map_elements` escape hatch.
- `references/lazy-vs-eager.md` — LazyFrame vs DataFrame decision, optimizer passes (predicate/projection/slice pushdown, CSE, type coercion, cardinality), `.explain()`.
- `references/io.md` — `scan_*` vs `read_*`, Parquet hive partitioning, `sink_*`, cloud paths, `read_database`, NDJSON/IPC, schema specification, compression.
- `references/groupby-aggregations.md` — `.group_by` (not `.groupby`), `.agg` with expression bodies, filtered aggregations, `group_by_dynamic`, rolling, `pl.len()` vs `.count()`.
- `references/joins.md` — `.join` with `how=inner/left/right/full/cross/semi/anti`, `validate=`, `coalesce=`, `join_asof` with `by=` / `tolerance=`, planner notes.
- `references/window-functions.md` — `.over()` patterns: share, rank, lag/lead with `order_by=`, cumulative aggregates per group, group-relative deltas, filtered windows, `mapping_strategy=`.
- `references/streaming.md` — `collect(engine="streaming")`, `sink_parquet/csv/ipc/ndjson`, streamable operations matrix, env vars (`POLARS_STREAMING_CHUNK_SIZE`, `POLARS_MAX_THREADS`, `POLARS_TEMP_DIR`, `POLARS_VERBOSE`), limitations.
- `references/migration-from-pandas.md` — the dense reference: read_csv→scan_csv, .loc→filter+select, apply→expressions, groupby.transform→.over, merge_asof→join_asof, dtype mapping, NaN vs Null trap, no-index model.
- `references/interop.md` — pandas (`to_pandas` / `from_pandas` with pyarrow ext arrays), Arrow, NumPy, DuckDB, PyTorch dataloader pattern, scikit-learn boundary, Numba/Cython, SQLContext.
- `references/troubleshooting.md` — PanicException debugging, schema-mismatch on concat (`vertical_relaxed`/`diagonal_relaxed`), plan-not-optimal checklist, memory growth, NaN vs Null, Categorical cross-frame issues, `order_by` on `.over()`.
- `references/recommended-defaults.md` — file-size thresholds, schema specification rules, streaming knobs, expression batching, join validation defaults, engine choice matrix, anti-defaults.
- `references/wrong-vs-right.md` — 15 antipattern/idiomatic pairs covering chained with_columns, apply→expressions, group_by+join vs .over(), read vs scan, .collect() in loops, .groupby typo, Null/NaN confusion, missing order_by, mid-pipeline to_pandas, alias forgetting, schema-incompatible concat, big-file inspection, Categorical without StringCache, immutable frame mutation.
- `references/eval-cases.md` — routing prompts (positive/negative/ambiguous) for description tuning.

### Verified against

- `docs.pola.rs` (main user guide)
- `docs.pola.rs/api/python/stable/reference/` (full API surface)
- Context7 `/pola-rs/polars/py_1_32_3` (Lazy API, streaming, expressions)
- GitHub releases for Polars 1.39 / 1.40 highlights (streaming AsOf, `engine="streaming"`, `pl.merge_sorted`, `group_by` without keys)

### Notes

- Skill positioned against pandas: when polars wins (size, ETL, lazy/streaming, window functions), when pandas stays (ML interop, tiny data, notebooks).
- `medium-stakes` risk: no `wrong-vs-right.md` requirement, but included for code-review value.
- Version block injection point preserved as blank line after frontmatter; sync registration in `sync_skill_versions.py` is the user's job (per task scope, do not auto-register).
