# Wrong vs Right — NumPy Anti-Patterns

Common mistakes paired with the idiomatic fix. Optimized for an LLM that may have absorbed older 1.x examples.

## 1. Python loop over an array

### ❌ Wrong — Python-level iteration

```python
out = np.empty(len(arr))
for i in range(len(arr)):
    out[i] = arr[i] ** 2 + 3 * arr[i] - 1
```

Cost on a 10M-element array: ~5 seconds (Python interpreter overhead dominates).

### ✅ Right — vectorized expression

```python
out = arr ** 2 + 3 * arr - 1
```

Cost: ~50 ms. **~100× speedup.**

For element-wise branching:

```python
# ❌
out = np.empty_like(arr)
for i, x in enumerate(arr):
    out[i] = 2 * x if x > 0 else 3 * x

# ✅
out = np.where(arr > 0, 2 * arr, 3 * arr)
```

## 2. `np.matrix` (legacy)

### ❌ Wrong — `np.matrix` class

```python
M = np.matrix([[1, 2], [3, 4]])
v = np.matrix([[5], [6]])
result = M * v        # matrix product because * is overloaded on np.matrix
```

`np.matrix` is a legacy class kept only for SciPy sparse compatibility. It will be removed in a future release.

### ✅ Right — `ndarray` with `@`

```python
M = np.array([[1, 2], [3, 4]])
v = np.array([5, 6])
result = M @ v
```

`@` is the matrix-multiplication operator (PEP 465). Element-wise `*` works normally on `ndarray`. No surprising operator overloading.

## 3. `np.random.seed` instead of `default_rng`

### ❌ Wrong — global state

```python
np.random.seed(42)
samples = np.random.randn(1000)
choice = np.random.choice(arr, 10)
```

Mutates a hidden global. Any library code can re-seed silently. Poor statistical properties (Mersenne Twister).

### ✅ Right — explicit Generator

```python
rng = np.random.default_rng(seed=42)
samples = rng.standard_normal(1000)
choice = rng.choice(arr, 10)
```

Local state, reproducible, better statistics (PCG64). Parallel-safe via `SeedSequence.spawn`.

## 4. Removed type aliases

### ❌ Wrong — 1.x aliases

```python
arr = np.array([1, 2, 3], dtype=np.int)        # AttributeError in 2.x
mask = np.array([True, False], dtype=np.bool)  # AttributeError in 2.x
flags = np.array([1.0], dtype=np.float)         # AttributeError in 2.x
```

### ✅ Right — Python builtin or canonical NumPy name

```python
arr = np.array([1, 2, 3], dtype=int)           # Python int
arr = np.array([1, 2, 3], dtype=np.int64)      # NumPy explicit
mask = np.array([True, False], dtype=bool)     # Python bool
flags = np.array([1.0], dtype=np.float64)
```

## 5. `.item()` in a hot loop

### ❌ Wrong — round-trip to Python scalar inside loop

```python
total = 0.0
for x in arr:
    total += x.item()           # .item() unboxes per element
```

`.item()` is expensive — it allocates a Python object. Doing it per element is catastrophic.

### ✅ Right — let NumPy reduce

```python
total = arr.sum()                # returns np.float64 scalar; .item() once at the end if needed
total = float(arr.sum())         # convert once if you need a Python float
```

## 6. `inv()` when `solve()` is appropriate

### ❌ Wrong — explicit inverse

```python
x = np.linalg.inv(A) @ b
```

- Computes the full N×N inverse: O(n^3) per call
- Accumulates more floating-point error than `solve`
- Wasteful even if you have multiple right-hand sides (`solve` handles that natively)

### ✅ Right — `solve`

```python
x = np.linalg.solve(A, b)        # single LU decomposition + backsubstitution

# Multiple RHS at once
X = np.linalg.solve(A, B)        # B: (n, k) → X: (n, k)
```

For positive-definite `A`, even better:

```python
L = np.linalg.cholesky(A)        # half the work of LU
# Or, from SciPy:
from scipy.linalg import cho_factor, cho_solve
c, low = cho_factor(A)
x = cho_solve((c, low), b)
```

## 7. Transposing without considering contiguity

### ❌ Wrong — repeated BLAS work on a non-contiguous transpose

```python
At = A.T                          # view — stride trick
for b in many_rhs:
    x = np.linalg.solve(At, b)    # solve internally copies At every call!
```

`A.T` is a view with swapped strides — NOT C-contiguous. BLAS routines silently copy non-contiguous input to a contiguous buffer.

### ✅ Right — materialize once

```python
At = np.ascontiguousarray(A.T)    # one-time copy
for b in many_rhs:
    x = np.linalg.solve(At, b)     # no internal copies
```

Or just rewrite the math to use `A` directly when possible.

## 8. `np.in1d` (removed in 2.x)

### ❌ Wrong

```python
mask = np.in1d(elements, valid_set)
```

`np.in1d` was deprecated since 1.25 and is removed in 2.4.

### ✅ Right

```python
mask = np.isin(elements, valid_set)
```

Same semantics, current API.

## 9. `np.vectorize` for "performance"

### ❌ Wrong — assuming `np.vectorize` speeds things up

```python
def f(x):
    return x ** 2 + np.sin(x)

vf = np.vectorize(f)
result = vf(arr)                  # Python-level loop under the hood
```

`np.vectorize` is a convenience wrapper, NOT a compiled vectorization.

### ✅ Right — real vectorization

```python
result = arr ** 2 + np.sin(arr)   # single C-level pass
```

If the function is genuinely complex per-element and you can't rewrite, use Numba `@njit`, NOT `np.vectorize`.

## 10. Concatenating in a loop

### ❌ Wrong — repeated allocation

```python
result = np.array([])
for chunk in chunks:
    result = np.concatenate([result, chunk])   # O(N^2) total
```

Each concatenation copies the entire growing array.

### ✅ Right — preallocate or collect-then-concat

```python
# Option A: collect, then concat once
parts = []
for chunk in chunks:
    parts.append(chunk)
result = np.concatenate(parts)

# Option B: preallocate if total size is known
result = np.empty(total_size, dtype=chunks[0].dtype)
offset = 0
for chunk in chunks:
    result[offset:offset + len(chunk)] = chunk
    offset += len(chunk)
```

## 11. `arr == np.nan` for NaN detection

### ❌ Wrong — NaN never equals anything

```python
mask = arr == np.nan              # ALWAYS False — NaN != NaN by IEEE 754
```

### ✅ Right — `np.isnan`

```python
mask = np.isnan(arr)
```

## 12. Chained indexing for assignment

### ❌ Wrong — assigning through a copy

```python
arr[arr > 0][0] = -1              # mask returns a copy; assignment is lost!
```

The boolean-mask indexer returns a copy. Mutating the copy doesn't affect `arr`.

### ✅ Right — single-step assignment

```python
arr[arr > 0] = -1                  # buffered assignment through mask — works
# or, for the first positive only:
idx = np.argmax(arr > 0)
arr[idx] = -1
```

## 13. Reading `np.percentile` `interpolation=` (removed)

### ❌ Wrong — old keyword

```python
np.percentile(arr, 90, interpolation='nearest')   # removed in 2.x
```

### ✅ Right — `method=`

```python
np.percentile(arr, 90, method='nearest')
```

## 14. Mutating a `torch.from_numpy` tensor's source

### ❌ Wrong — surprise mutation across libraries

```python
t = torch.from_numpy(arr)
arr[:] = 0                         # also zeros out `t`!
```

`torch.from_numpy` shares memory with the source on CPU.

### ✅ Right — copy if you need independence

```python
t = torch.from_numpy(arr.copy())
# or use torch.tensor (which copies by default)
t = torch.tensor(arr)
```

## 15. `np.float_` (removed)

### ❌ Wrong

```python
np.float_           # AttributeError in 2.x
np.complex_         # AttributeError
np.string_          # AttributeError (was alias for bytes_)
```

### ✅ Right

```python
np.float64
np.complex128
np.bytes_           # for bytes
np.str_             # for unicode strings
```
