# Changelog

## v1.0.0 — 2026-05-16

Initial release. pandas 3.0 production skill.

### Added
- `SKILL.md` — Pattern 2 navigator with frontmatter (medium-stakes risk), version block placeholder for sync script, 9 capability sections, behavioral traits, important constraints, related skills, API Reference table linking all 14 reference files.
- `references/REFERENCE.md` — slim decision map + pandas 3.0 highlights cheat sheet.
- `references/data-structures.md` — Series, DataFrame, Index, MultiIndex, four dtype families (numpy / nullable / PyArrow / categorical), datetime resolution inference.
- `references/indexing-and-selection.md` — `.loc` / `.iloc` / `.at` / `.iat`, boolean masks, `query`, `where`, `mask`, `filter`, MultiIndex slicing with `IndexSlice`, set/reset index.
- `references/groupby.md` — split-apply-combine, named aggregations (preferred over dict), transform vs apply, multi-key groupby, `observed=True` for categoricals, `pd.Grouper`, top-N per group, pivot via groupby.
- `references/merge-join-concat.md` — `merge` with `how=` (incl. new 3.0 anti-joins), `validate`, `indicator`, `left_on/right_on`, joining on index, `concat` with `keys`, `merge_asof` for sorted nearest-key, `merge_ordered`, `compare`.
- `references/timeseries.md` — DatetimeIndex, parsing with `format=`, 3.0 resolution inference, `zoneinfo` over `pytz`, DST gotchas, calendar-day `Day` offset change, resample, rolling/expanding, shift/diff, Period vs Timestamp.
- `references/io.md` — Parquet (preferred) with partition_cols and filters, CSV with explicit dtypes and chunksize, JSON line-delimited, SQL with `method='multi'`, Excel, Feather, fsspec for cloud, `dtype_backend` selection.
- `references/copy-on-write.md` — 3.0 CoW default, chained-assignment silent no-op, migration patterns, `inplace=True` survival, read-only arrays, refactor table.
- `references/arrow-backend.md` — PyArrow as required dep, `str` dtype default in 3.0, three backends (numpy / nullable / pyarrow), `convert_dtypes`, performance table, zero-copy interop via `__arrow_c_stream__`, `is_string_dtype` for robust type checks.
- `references/missing-data.md` — `NaN` vs `pd.NA`, detection, drop/fill/interpolate, nullable Int64, `na=False` for `str.contains`, NaT for datetimes, common patterns (coalesce, imputation audit trail).
- `references/categorical.md` — when to use, `.cat` accessor, ordered comparisons, memory/groupby speedup, `observed=True`, parquet dictionary round-trip, ML feature engineering, concat with category mismatch.
- `references/troubleshooting.md` — SettingWithCopyWarning legacy, dtype drift, tz mixing, `pd.NA` ambiguous truthiness, slow `apply`/`iterrows`, memory blowup on `read_csv`, MultiIndex unsorted, merge fanout, function-mutation regression.
- `references/recommended-defaults.md` — single source of truth for production defaults: storage format, dtypes, pipeline style, groupby, merge, string ops, timeseries, performance routing.
- `references/wrong-vs-right.md` — 15 side-by-side mistake/fix pairs covering chained assignment, iterrows, `str.contains` na, mixed datetime, `apply(axis=1)`, dict-syntax agg, `inplace=True`, large CSV reads, tz arithmetic, merge validation, categorical observed, object-string check.
- `references/eval-cases.md` — 20 positive + 10 negative routing prompts for description audit.
- `CHANGELOG.md` — this file.

### Stack
- pandas 3.0.x (3.0.3 latest at release time per STACK_VERSIONS.md)
- PyArrow now required dependency
- Python 3.11+ minimum

### Notes
- Version block in SKILL.md is empty `<!-- versions:start --><!-- versions:end -->`; sync via `~/.claude/scripts/sync_skill_versions.py` to inject pinned versions from STACK_VERSIONS.md.
- This skill is `risk: medium-stakes` — financial/analytical correctness matters but not life-safety. Wrong-vs-right pairs and recommended-defaults are present per the high-stakes-adjacent template.
- Related Skills cross-references `python`, `polars`, `scikit-learn`, `pytorch`, `cuda-python`, `postgresql` — all confirmed to exist as of this release.
