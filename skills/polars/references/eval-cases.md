# Eval Cases

Routing prompts that should — or should not — load the `polars` skill. Used to validate the description.

## Positive (should load `polars`)

| Prompt | Why it should match |
|---|---|
| "How do I read a 50GB parquet file lazily in Polars?" | Direct mention + lazy + parquet |
| "Convert this pandas groupby to polars" | Migration phrasing |
| "What's `pl.col` vs `pl.lit`?" | Polars expression entry points |
| "My `collect(engine='streaming')` is OOMing" | Streaming engine |
| "How to do rolling mean per group in polars without apply?" | Window expressions + anti-`apply` |
| "Join two LazyFrames with validate='m:1'" | LazyFrame + join validation |
| "scan_csv with explicit schema for billion-row file" | Lazy IO + schema |
| "Replace pandas merge_asof with polars" | join_asof migration |
| "polars .with_columns vs .assign" | API mapping |
| "Why is my polars groupby slower than expected?" | Performance debugging |
| "Use polars with DuckDB" | Interop |
| "pl.when / then / otherwise multiple conditions" | Conditional expression |
| "Hive-partitioned parquet read in polars" | IO + partitioning |
| "sink_parquet vs collect for ETL pipeline" | Streaming output |
| "Polars Categorical vs Enum dtype" | Type system |

## Negative (should NOT load `polars`)

| Prompt | Should route to |
|---|---|
| "How do I one-hot encode a column for sklearn?" | `scikit-learn` |
| "Best Postgres index for this WHERE clause" | `postgresql` |
| "PyTorch DataLoader for image classification" | `pytorch` |
| "Pandas Copy-on-Write semantics" | `pandas` |
| "How to plot a histogram with matplotlib" | (no skill — generic Python) |
| "Run a SQL aggregation on a 1TB Postgres table" | `postgresql` |
| "CuDF vs pandas on GPU" | `cuda-python` |
| "ETL DAG orchestration with Airflow" | (not a Polars question) |

## Ambiguous — both `pandas` and `polars` could match

These should load `pandas` if the existing code is pandas, `polars` if it's polars or unspecified-but-large.

| Prompt | Pick |
|---|---|
| "Read a 200MB CSV and do a groupby" | `polars` (size threshold) |
| "Read a 5MB CSV and pivot it" | `pandas` (small, idiomatic in pandas) |
| "Sklearn pipeline reading from CSV" | `pandas` (sklearn ergonomics) |
| "Train a model on 100M rows" | `polars` for prep, then handoff |
| "Refactor this pandas script for speed" | `polars` (migration phrasing) |

## Description tuning notes

The current description includes:
- Library names: `polars`, `pola-rs`
- API entry points: `LazyFrame`, `DataFrame`, `pl.col`, `pl.lit`, `pl.when`, `.over`, `scan_parquet`, `scan_csv`, `sink_parquet`, `collect(engine='streaming')`, `group_by`, `with_columns`
- Concepts: lazy frame, streaming engine, expressions, query optimizer, columnar, arrow-backed, rust dataframe
- Positioning: "pandas alternative", "fast pandas", "ETL on millions of rows"
- SKIP rules: small-data pandas, database-side SQL, GPU compute

If any of the negative prompts above accidentally load this skill in practice, tighten the SKIP rules. If any positive prompt doesn't load it, add the missing trigger term.
