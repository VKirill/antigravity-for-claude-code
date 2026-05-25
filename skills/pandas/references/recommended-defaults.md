# Recommended Defaults

Single source of truth for sensible pandas 3.0 production defaults. Other reference files link here instead of duplicating the numbers.

## Storage and IO

| Concern | Default | Reason |
|---|---|---|
| Storage format | **Parquet** (snappy or zstd) | Typed, compressed, columnar, ~10× smaller than CSV |
| Compression codec | `zstd` for archival, `snappy` for hot reads | zstd compresses 20–40% better; snappy reads slightly faster |
| Partitioning | By cheap high-selectivity key (date, region) | Enables predicate pushdown; skip files entirely |
| CSV dtype | **Always explicit** `dtype={...}` | Inference is slow and lossy |
| CSV chunk size | `100_000` rows when file > RAM / 5 | Balances throughput vs memory |
| Excel | Avoid; export to CSV/Parquet for handoff | Slow parsers, type fidelity issues |
| Pickle | Local cache only; never untrusted input | Arbitrary code execution risk |
| `read_csv` bad lines | `on_bad_lines='warn'` (`'error'` in strict pipelines) | Don't silently drop |

## dtypes

| Concern | Default | Reason |
|---|---|---|
| Strings | **`str`** (default in 3.0, PyArrow-backed) | Memory + speed + type safety |
| Missing-int columns | **`Int64`** (nullable) | No float coercion |
| Backend on read | `dtype_backend='pyarrow'` if downstream is pandas/polars; else `'numpy_nullable'` | Zero-copy with Arrow |
| Low-cardinality strings on big frames | `'category'` | 5–30× memory savings; groupby speedup |
| Datetime resolution | `datetime64[us]` (3.0 default for string parsing) | Microsecond precision, half the bytes of ns |
| Timezone | UTC for storage; localize at display | DST-safe; mergeable |

## Pipeline style

| Concern | Default | Reason |
|---|---|---|
| Mutation | `.pipe(fn)` + return new frame | Composable, CoW-friendly, testable |
| In-place ops | **Avoid** `inplace=True` | Breaks chains, no longer guarantees speed in 3.0 |
| Chained assignment | **Never** — `df.loc[mask, 'col'] = x` | CoW makes chained assignment a silent no-op |
| Function inputs | Functions get logical copies under CoW; explicit `.copy()` not needed unless you do in-place ops | 3.0 default |
| Type inference | Coerce on read, never silently mid-pipeline | Reproducibility |

## GroupBy

| Concern | Default | Reason |
|---|---|---|
| Aggregation syntax | **Named aggregations** (`name=('col', 'agg')`) | Explicit output names, dict-syntax is deprecated |
| Categorical group keys | `observed=True` | Avoid Cartesian product of unseen categories |
| Multi-key groupby | `as_index=False` for downstream concat | Flat columns, no `reset_index()` needed |
| Iteration speed | String aggfunc (`'sum'`, `'mean'`) over lambdas | String dispatches to Cython |
| Sort order | `sort=False` if you don't need sorted groups | Faster |

## Merge

| Concern | Default | Reason |
|---|---|---|
| `validate=` | **Always set** — typically `'many_to_one'` or `'one_to_one'` | Catches data quality bugs |
| `indicator=` | `True` in dev / ETL | Shows match status; remove from production output |
| Suffixes | Explicit `suffixes=('_left', '_right')` | Avoid `_x` / `_y` confusion |
| Anti-join | `how='left_anti'` (3.0) | Cleaner than `indicator=True` + filter |
| Big joins | Sort by key first if you'll join repeatedly | One-time cost, repeated benefit |

## String operations

| Concern | Default | Reason |
|---|---|---|
| `str.contains`, `str.startswith`, etc. | **Always** `na=False` (or `na=True`) | NaN propagates to boolean mask and breaks indexing |
| Regex flag | Explicit `regex=True` / `regex=False` | Avoid surprises when pattern looks regexy |
| Case sensitivity | Explicit `case=False` when intended | Default is True |

## Time series

| Concern | Default | Reason |
|---|---|---|
| Storage tz | **UTC** | Universal; localize at display |
| Parsing | Explicit `format='%Y-%m-%d ...'` | Auto-inference is slow and silently mismatches |
| DST-sensitive arithmetic | `Timedelta(hours=24)` for fixed; `pd.offsets.Day()` for calendar | 3.0 changed Day to calendar |
| Resample | `resample('1D', origin='start_day').sum()` for daily | Aligned buckets |
| Rolling | `min_periods=window` to avoid partial windows | Cleaner output |
| Index | `df.set_index('ts').sort_index()` before time-aware ops | Required for `merge_asof`, `rolling('7D')` |

## Performance choices

| Concern | Default | Reason |
|---|---|---|
| Row iteration | **Never** `iterrows` — vectorize → `np.where` → `map` → `itertuples` | Row boxing is 50–500× slower than vectorized |
| `apply(axis=1)` | Avoid — vectorize or use `.eval()` / `np.select` | Python-level loop |
| Big single-machine job > 1 GB | Profile against **polars** | Often 5–10× faster, 3–5× less memory |
| GPU-resident | Hand off to CuPy via `df.to_numpy()` | pandas itself is CPU-only |
| ML | sklearn `Pipeline` with `set_output(transform='pandas')` | Type-preserving |

## Validation

| Concern | Default | Reason |
|---|---|---|
| Required columns | Assert at function boundary | Fail fast |
| Row count expectation | Assert after merge/groupby | Detect silent fanout |
| Dtype expectation | Assert before write | Detect drift |
| Schema-level | Use `pandera` for production data contracts | Static schema, runtime validation |

## When defaults don't apply

These defaults assume **production analytical pipelines** (financial reporting, ML feature prep, ETL). Adjust for:

- **Notebook EDA**: Skip explicit dtypes, use defaults, iterate fast
- **Single-pass scripts**: Pickle is fine for local caches; skip parquet ceremony
- **Adversarial input (web API)**: Validate dtypes via pandera or Pydantic before pandas
- **Real-time / streaming**: pandas is the wrong tool — use polars streaming or duckdb
