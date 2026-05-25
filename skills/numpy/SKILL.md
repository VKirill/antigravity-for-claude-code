---
name: numpy
description: "NumPy — N-dimensional arrays, broadcasting, ufuncs, linalg, random Generator API for Python scientific computing. Foundation for pandas, polars, scikit-learn, PyTorch. Use when: numpy, np, ndarray, dtype, broadcasting, ufunc, np.linalg.solve, np.linalg.eig, np.linalg.svd, einsum, np.random.default_rng, Generator, np.zeros, np.array, vectorization, matrix multiplication, NEP 50, numpy 2.0 migration, np.float removed, np.int removed, np.in1d removed, np.isin, array indexing, fancy indexing, structured dtype, memmap, copy vs view. SKIP: DataFrames with labels (→pandas/polars), GPU arrays (→cuda-python), autograd tensors (→pytorch), ML estimators (→scikit-learn)."
stacks:
  - numpy
  - python
packages:
  - numpy
tags:
  - numpy
  - numerical
  - foundation
  - scientific-python
manifests:
  - pyproject.toml
  - requirements.txt
source: vechkasov-global-skills
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- NumPy: `2.4.x`
- Python: `3.14.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->


## Usage

Loaded when description matches the task. SKILL.md is the navigator — open only the reference file matching the sub-domain (broadcasting, linalg, random, v2-migration, etc.).

## Use this skill when

- Working directly with `ndarray` — creation, reshaping, indexing, slicing, type conversion
- Element-wise numeric computation — ufuncs, vectorization, replacing Python loops over arrays
- Broadcasting between arrays of different shapes — debugging `ValueError: operands could not be broadcast`
- Linear algebra — `solve`, `lstsq`, `eig`/`eigh`, `svd`, `qr`, `cholesky`, `det`, `norm`, `einsum`
- Random number generation — `np.random.default_rng()`, distributions, reproducible streams, parallel-safe seeding via `SeedSequence`
- Migrating code from NumPy 1.x to 2.x — removed `np.int`/`np.bool`/`np.float` aliases, `np.in1d` → `np.isin`, NEP 50 promotion, scalar repr changes
- Performance work — vectorization, contiguous memory, `np.einsum` contractions, views vs copies, releasing the GIL via C ops
- Interop — exchanging arrays with pandas / polars / PyTorch / CuPy via zero-copy buffers, DLPack, `__array_interface__`
- File IO of numeric data — `.npy` / `.npz`, `np.memmap`, structured arrays

## Do not use this skill when

- Working with labeled tabular data (named columns, joins, groupby) — use **pandas** or **polars**
- Building ML estimators / pipelines / cross-validation — use **scikit-learn** (it consumes NumPy)
- Training neural nets with autograd, optimizers, GPU/MPS — use **pytorch** (`torch.from_numpy` for bridge)
- GPU-resident arrays as primary store — use **cuda-python** / CuPy (`cupy.asarray(numpy_array)` to upload)
- Pure Python language questions (type hints, asyncio, packaging) — use **python**
- Pure SQL aggregation already runnable database-side — use **postgresql**

## Purpose

NumPy is the foundational array library for scientific Python — `ndarray` plus a C-level ufunc machinery, broadcasting rules, linear algebra, FFT, and a modern random Generator API. Everything in the scientific Python stack (pandas, polars, scikit-learn, PyTorch, JAX, CuPy, SciPy) either is a NumPy array under the hood or has zero-copy interop with one. This skill covers the direct-`ndarray` surface — the layer below DataFrames and tensors.

The NumPy 2.x line introduced significant breaking changes from 1.x: removed Python-typed aliases (`np.int`, `np.bool`, `np.float`, `np.object`, `np.str`), a cleaner main namespace (many functions moved or removed — `np.in1d`, `np.cumproduct`, `np.alltrue`, `np.sometrue`, `np.round_`, `np.product`, `np.trapz`, `np.row_stack`), NEP 50 dtype promotion (strictly dtype-based, not value-based), new scalar repr (`np.float64(3.0)` instead of `3.0`), and string truthiness matching Python. Code written against 1.x mental models breaks loudly — see [v2-migration.md](references/v2-migration.md).

## Capabilities

### Array creation and dtypes

`np.array`, `np.zeros`, `np.ones`, `np.empty`, `np.full`, `np.arange`, `np.linspace`, `np.eye`. Dtypes: `int8/16/32/64`, `uint8/16/32/64`, `float16/32/64`, `complex64/128`, `bool_`, `str_`, `bytes_`, `object_`, structured dtypes. Attributes: `shape`, `ndim`, `dtype`, `itemsize`, `nbytes`, `strides`, `flags`. Default integer is `int64` on 64-bit platforms (including Windows since 2.0).

See [references/arrays-and-dtypes.md](references/arrays-and-dtypes.md).

### Indexing, slicing, copy vs view

Basic slicing returns a **view** (shares memory). Integer-array (fancy) indexing and boolean masking return a **copy**. `np.ix_` constructs open-mesh indices. `...` (ellipsis) and `np.newaxis` (`None`) shape selectors. Use `arr.base` to detect views. Mutating a view propagates; mutating a copy doesn't — the source of most silent NumPy bugs.

See [references/indexing-slicing.md](references/indexing-slicing.md).

### Broadcasting

Dimensions matched right-to-left. Missing trailing dims treated as 1. Mismatched non-1 dims raise. `np.broadcast_to`, `np.broadcast_shapes`, `np.broadcast_arrays` to materialize. Broadcasting can silently allocate huge intermediates — watch for `(N, 1) * (1, N)` when only the diagonal is needed (use `np.einsum` or `np.diag` patterns).

See [references/broadcasting.md](references/broadcasting.md).

### Ufuncs

Element-wise functions (`np.add`, `np.sin`, `np.exp`, ...) with `out=`, `where=`, `dtype=`, `casting=` parameters. `.reduce`, `.accumulate`, `.reduceat`, and `.at` (unbuffered in-place). `np.vectorize` is a convenience wrapper, NOT a speedup — it's a Python-level loop. True vectorization means a single ufunc call over whole arrays.

See [references/ufuncs.md](references/ufuncs.md).

### Aggregations and reductions

`sum`, `mean`, `std`, `var`, `min`, `max`, `argmin`, `argmax`, `prod`, `cumsum`, `cumprod` — all accept `axis=` and `keepdims=`. NaN-aware variants: `nansum`, `nanmean`, `nanstd`, `nanmax`. `percentile` / `quantile` with `method=` (the old `interpolation=` kwarg is removed in 2.x). `np.unique` (`return_counts`, `return_inverse`, `return_index`).

See [references/aggregations.md](references/aggregations.md).

### Linear algebra

`np.linalg.solve(A, b)` for `Ax = b` — always prefer over `inv(A) @ b` (faster, more accurate). `lstsq` for over/underdetermined systems. `eig` (general), `eigh` (Hermitian/symmetric — faster, real eigenvalues). `svd`, `qr`, `cholesky`. `det`, `matrix_rank`, `norm`, `pinv`. `@` operator and `np.matmul` for matrix multiplication. `np.einsum` for arbitrary tensor contractions with `einsum_path` for optimization.

See [references/linalg.md](references/linalg.md).

### Random Generator API

`np.random.default_rng(seed)` returns a `Generator`. Methods: `random`, `integers`, `normal`, `standard_normal`, `uniform`, `choice`, `permutation`, `shuffle`. Parallel-safe streams via `SeedSequence.spawn(n)`. The legacy global functions (`np.random.seed`, `np.random.rand`, `np.random.randn`, `np.random.randint`) still exist but should not be used in new code — `Generator` has better statistical properties and an explicit state.

See [references/random.md](references/random.md).

### IO

`np.save` / `np.load` for `.npy` (single array, fast, typed). `np.savez` / `np.savez_compressed` for `.npz` (multi-array archive). `np.loadtxt` is fast for clean numeric text; `np.genfromtxt` handles missing values, names, mixed dtypes (slower). For real tabular data — delegate to **pandas** / **polars** parquet IO. `np.memmap` for arrays larger than RAM (file-backed, lazy paging).

See [references/io.md](references/io.md).

### Performance

Vectorize: replace Python `for` loops with whole-array ufuncs. Ensure contiguity: `np.ascontiguousarray(arr)` before BLAS-heavy work — non-contiguous strides force copies in C extensions. Use `out=` to avoid allocations in hot loops. `np.einsum` with `optimize='optimal'` for multi-tensor contractions. NumPy ufuncs and BLAS calls release the GIL — threading speeds up CPU-bound NumPy work despite the GIL. Profile with `cProfile` for call costs, `line_profiler` for line-level, `memory_profiler` for allocations.

See [references/performance.md](references/performance.md).

### Interop with other libraries

pandas: `df.to_numpy()` / `pd.DataFrame(arr)`. Polars: `df.to_numpy()` / `pl.from_numpy(arr)`. PyTorch: `torch.from_numpy(arr)` shares memory bidirectionally with `Tensor.numpy()` — mutate one, see it in the other. CuPy: `cp.asarray(np_arr)` uploads, `cp_arr.get()` downloads. Standard protocols: `__array_interface__`, `__array_function__` (NEP 18), `__array_namespace__` (Array API), DLPack via `np.from_dlpack`.

See [references/interop.md](references/interop.md).

### NumPy 2.x migration

Removed: `np.int`, `np.bool`, `np.float`, `np.object`, `np.str`, `np.long`, `np.float_`, `np.complex_`, `np.string_`, `np.unicode_`, `np.NaN`, `np.Inf`, `np.in1d`, `np.cumproduct`, `np.alltrue`, `np.sometrue`, `np.round_`, `np.product`, `np.trapz`, `np.row_stack`, `np.msort`, `np.cast`, `np.source`, `np.lookfor`, `np.find_common_type`, `np.asfarray`, `np.recfromcsv`, `numpy.array_api` submodule. Renamed: `np.in1d` → `np.isin`, `np.trapz` → `np.trapezoid`, `np.row_stack` → `np.vstack`. NEP 50 changes dtype promotion to be value-independent. Scalar repr now includes type. Windows default int is `int64`.

See [references/v2-migration.md](references/v2-migration.md).

## Behavioral Traits

- Always use `np.random.default_rng(seed)` for new code — never `np.random.seed` / `np.random.rand` / `np.random.randint`
- Always use `np.linalg.solve(A, b)` instead of `np.linalg.inv(A) @ b` — same answer, faster, more numerically stable
- Always specify `dtype=` explicitly in production array creation — implicit promotion to `float64` doubles memory unexpectedly
- Always prefer vectorized whole-array operations over Python `for` loops — typical speedup 50–500×
- Always call `.copy()` after fancy indexing if you'll mutate the result and need to preserve the source semantically
- Always use `np.einsum` with `optimize=True` for multi-tensor contractions — picks an order with orders-of-magnitude lower cost
- Always use `np.isin(a, b)` — never `np.in1d` (removed in 2.x)
- Always reach for `np.ascontiguousarray(arr)` before heavy BLAS / external-C calls — forces a contiguous layout if needed
- Prefer `eigh` over `eig` for symmetric/Hermitian matrices — guaranteed real eigenvalues, faster
- Prefer `.npy` / `.npz` over pickle for array persistence — typed, no arbitrary code execution

## Important Constraints

- NEVER use removed aliases `np.int`, `np.bool`, `np.float`, `np.object`, `np.str` — use Python builtins (`int`, `bool`, `float`, `object`, `str`) or canonical NumPy dtypes (`np.int64`, `np.bool_`, `np.float64`)
- NEVER use `np.in1d` — replaced by `np.isin` (removed in 2.x)
- NEVER call `np.random.seed()` for new code — use `np.random.default_rng(seed)` Generator
- NEVER use `np.matrix` — legacy class kept only for SciPy sparse compat; use `ndarray` with `@` operator
- NEVER assume basic slicing returns a copy — it returns a **view**; mutations propagate to the source
- NEVER assume fancy indexing returns a view — it returns a **copy**; mutations to the result don't propagate
- NEVER call `inv(A) @ b` when `solve(A, b)` works — slower and accumulates more numerical error
- NEVER use `np.vectorize` expecting a speedup — it's a Python-level loop, not a true vectorization
- NEVER concatenate arrays inside a loop — preallocate the output and assign by slice
- NEVER mix `np.float64` and lower-precision dtypes silently in production — NEP 50 promotion is strict and can surprise
- NEVER trust pickle for cross-version NumPy persistence — use `.npy` / `.npz` for portability

## Related Skills

### Parent — Python runtime
- ✓ `python` — language, type hints, packaging, asyncio, pyproject.toml

### Downstream consumers (built on NumPy)
- ✓ `pandas` — DataFrame on top of NumPy/Arrow; `df.to_numpy()` is the bridge
- ✓ `polars` — Arrow-native DataFrame; `df.to_numpy()` / `pl.from_numpy(arr)` for exchange
- ✓ `scikit-learn` — classical ML; estimators accept/return NumPy arrays
- ✓ `pytorch` — deep learning; `torch.from_numpy(arr)` shares memory bidirectionally

### Adjacent — GPU / accelerated arrays
- ✓ `cuda-python` — GPU compute (CuPy is the NumPy-API GPU array; `cp.asarray` / `.get` for transfer)

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Index, decision map, when to open which doc | [references/REFERENCE.md](references/REFERENCE.md) |
| Array creation (`np.array`, zeros/ones/empty/full, arange, linspace), dtypes (int/uint/float/complex/bool/str/bytes/object, structured), attributes (shape/ndim/dtype/itemsize/nbytes) | [references/arrays-and-dtypes.md](references/arrays-and-dtypes.md) |
| Basic slicing copy-vs-view rules, integer-array indexing, boolean masking, `np.ix_`, ellipsis, `np.newaxis`, `np.take`/`np.put`/`np.choose`, advanced indexing assignment | [references/indexing-slicing.md](references/indexing-slicing.md) |
| Broadcasting rules (right-to-left dim match), `np.broadcast_to`, `np.broadcast_shapes`, common broadcasting errors and how to read them, silent-blow-up patterns | [references/broadcasting.md](references/broadcasting.md) |
| Element-wise ufuncs, `out=` / `where=` / `casting=` params, `.reduce` / `.accumulate` / `.reduceat`, `ufunc.at` unbuffered in-place, why `np.vectorize` is slow | [references/ufuncs.md](references/ufuncs.md) |
| `sum`/`mean`/`std`/`var` with `axis=` and `keepdims=`, `min`/`max`/`argmin`/`argmax`, `cumsum`/`cumprod`, `nansum`/`nanmean`, `percentile`/`quantile`, `unique` family | [references/aggregations.md](references/aggregations.md) |
| `np.linalg.solve` vs `inv`, `lstsq` for over/underdetermined, `eig`/`eigh`, `svd`, `qr`, `cholesky`, `det`, `matrix_rank`, `norm`, `einsum` + `einsum_path`, `@` vs `dot` vs `matmul` | [references/linalg.md](references/linalg.md) |
| `np.random.default_rng()` Generator API, distributions, `choice`/`permutation`, parallel-safe streams via `SeedSequence.spawn`, legacy `np.random.*` migration | [references/random.md](references/random.md) |
| `np.load`/`np.save` `.npy`, `savez`/`savez_compressed` `.npz`, `loadtxt` vs `genfromtxt`, when to delegate to pandas/polars parquet, `np.memmap` for out-of-core | [references/io.md](references/io.md) |
| Vectorization principle, contiguity via `ascontiguousarray`, views vs copies for perf, `np.einsum` `optimize=True`, profiling (cProfile / line_profiler), GIL release in C ops | [references/performance.md](references/performance.md) |
| NumPy ↔ pandas / polars / PyTorch (memory shared!) / CuPy, `__array_interface__`, `__array_function__`, `__array_namespace__`, DLPack via `np.from_dlpack` | [references/interop.md](references/interop.md) |
| NumPy 2.0/2.x migration — removed aliases (`np.int`/`np.bool`/`np.float`/...), `np.in1d` → `np.isin`, NEP 50 promotion, scalar repr changes, removed `numpy.array_api`, Windows int64 default | [references/v2-migration.md](references/v2-migration.md) |
| Troubleshooting — broadcasting shape errors, NEP 50 promotion surprises, copy-vs-view silent bugs, NaN propagation, float precision, deprecation warnings, slow Python loops | [references/troubleshooting.md](references/troubleshooting.md) |
| Recommended defaults — `default_rng()` over legacy, explicit dtypes, `solve` over `inv`, `ascontiguousarray` for perf, `einsum` for non-trivial contractions | [references/recommended-defaults.md](references/recommended-defaults.md) |
| Wrong vs right — Python loops over arrays, `np.matrix`, `np.random.seed`, removed aliases, `.item()` in hot loop, `inv()` instead of `solve()`, transposing without contiguity | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases — positive and negative routing prompts | [references/eval-cases.md](references/eval-cases.md) |

**How to use**: open the specific topic file. SKILL.md is the navigator — don't read the whole references/ directory.
