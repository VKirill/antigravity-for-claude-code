# Changelog — `numpy` skill

## v1.0.0 — initial release

- Pattern 2 skill for NumPy 2.x (currently 2.4-line). Routing-optimized description with trigger terms covering ndarray creation, broadcasting, ufuncs, linalg, random Generator API, NEP 50, and 2.0 migration markers (removed `np.int`/`np.bool`/`np.float` aliases, `np.in1d` → `np.isin`).
- Fourteen domain references under `references/`:
  - `REFERENCE.md` — index and decision map
  - `arrays-and-dtypes.md` — creation, dtypes, attributes, structured dtypes
  - `indexing-slicing.md` — copy-vs-view rules, fancy indexing, boolean masking, `np.ix_`, `.at`
  - `broadcasting.md` — rules, materialization, silent perf traps
  - `ufuncs.md` — element-wise ops, `out=`/`where=`/`casting=`, `.reduce`/`.accumulate`/`.reduceat`/`.at`, why `np.vectorize` is slow
  - `aggregations.md` — `axis=`/`keepdims=`, NaN-aware variants, `percentile`/`quantile` `method=`, `unique_*`
  - `linalg.md` — `solve` over `inv`, `lstsq`, `eigh` over `eig`, SVD, QR, Cholesky, norms, `einsum` + `einsum_path`
  - `random.md` — `default_rng()` Generator API, parallel-safe `SeedSequence.spawn`, BitGenerators, legacy migration
  - `io.md` — `.npy`/`.npz`, `loadtxt` vs `genfromtxt`, `np.memmap`, delegation to pandas/polars parquet
  - `performance.md` — vectorization, contiguity, `einsum`, profiling, GIL release in C ops
  - `interop.md` — pandas / polars / PyTorch (shared memory!) / CuPy, `__array_function__`, Array API, DLPack
  - `v2-migration.md` — full 2.0/2.4 removal/rename tables, NEP 50, scalar repr, string truthiness, Windows int64 default
  - `troubleshooting.md` — broadcasting errors, NEP 50 surprises, view/copy bugs, NaN propagation, LinAlgError, slow code triage
  - `recommended-defaults.md` — knob/idiom defaults for new code
  - `wrong-vs-right.md` — fifteen anti-pattern pairs (Python loops, `np.matrix`, `np.random.seed`, removed aliases, `.item()` in hot loop, `inv` over `solve`, transpose without contiguity, `np.in1d`, `np.vectorize`, concat in loop, `== np.nan`, chained-index assignment, removed `interpolation=`, torch shared-memory mutation, removed `np.float_`)
  - `eval-cases.md` — twenty-five positive routing prompts, nineteen negative (siblings: pandas/polars/scikit-learn/pytorch/cuda-python/python/postgresql)
- Sibling/parent skill links: parent **python**; downstream consumers **pandas**, **polars**, **scikit-learn**, **pytorch**; GPU upgrade path **cuda-python**.
- Risk level: `medium-stakes`. Heavy emphasis on the 2.0 breaking-change surface (removed aliases, NEP 50 promotion, `np.in1d` → `np.isin`) because many users still anchor on 1.x examples.
