# NumPy Reference Index

Slim navigator for the NumPy skill. Open the specific file matching your sub-domain instead of reading the whole references/ directory.

## Decision map

| If you need... | Open |
|---|---|
| Create arrays, learn dtypes, see `shape`/`ndim`/`itemsize`/`strides` | [arrays-and-dtypes.md](arrays-and-dtypes.md) |
| Understand when slicing returns a view vs copy | [indexing-slicing.md](indexing-slicing.md) |
| Debug `ValueError: operands could not be broadcast` | [broadcasting.md](broadcasting.md) |
| Write element-wise math, use `out=` / `where=` / `.reduce` / `.at` | [ufuncs.md](ufuncs.md) |
| Compute sums/means/percentiles along axes, handle NaN-aware reductions | [aggregations.md](aggregations.md) |
| Solve linear systems, eigendecomposition, SVD, einsum | [linalg.md](linalg.md) |
| Generate reproducible random numbers, parallel streams | [random.md](random.md) |
| Save/load arrays, memory-map large files | [io.md](io.md) |
| Speed up slow NumPy code — vectorization, contiguity, profiling | [performance.md](performance.md) |
| Exchange arrays with pandas / polars / PyTorch / CuPy | [interop.md](interop.md) |
| Port 1.x code to 2.x — removed aliases, NEP 50, scalar repr | [v2-migration.md](v2-migration.md) |
| Diagnose a NumPy bug, deprecation warning, or surprising result | [troubleshooting.md](troubleshooting.md) |
| Look up the recommended idiom for a knob (seed, dtype, contiguity, solve) | [recommended-defaults.md](recommended-defaults.md) |
| Pattern: side-by-side "❌ wrong / ✅ right" for common anti-patterns | [wrong-vs-right.md](wrong-vs-right.md) |
| See routing eval prompts | [eval-cases.md](eval-cases.md) |

## Quick orientation

NumPy 2.x is the current line. The single biggest 1.x → 2.x gotcha is that **type aliases are gone**: `np.int`, `np.bool`, `np.float`, `np.object`, `np.str` all raise `AttributeError`. Use Python builtins (`int`, `bool`, `float`) or canonical NumPy dtypes (`np.int64`, `np.bool_`, `np.float64`). The second biggest is **NEP 50 promotion** — dtype-only promotion, value-independent. The third is the **new scalar repr** — `np.float64(3.0)` instead of `3.0`.

For new code use:

- `np.random.default_rng(seed)` (never `np.random.seed` / `np.random.rand` / `np.random.randint`)
- `np.linalg.solve(A, b)` (never `np.linalg.inv(A) @ b`)
- `np.isin(a, b)` (never `np.in1d`)
- `np.trapezoid(...)` (never `np.trapz`)
- `np.vstack(...)` (never `np.row_stack`)

## Sibling skills

- **pandas** — DataFrame layer above NumPy/Arrow. `df.to_numpy()` is the bridge down.
- **polars** — Arrow-native DataFrame. Use `pl.from_numpy(arr)` / `df.to_numpy()` for exchange.
- **scikit-learn** — ML estimators consuming NumPy arrays.
- **pytorch** — `torch.from_numpy(arr)` shares memory bidirectionally.
- **cuda-python** — GPU compute via CuPy (NumPy-compatible API on GPU).
