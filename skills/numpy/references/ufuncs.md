# Ufuncs — Universal Functions

A ufunc is a function that operates element-wise on `ndarray`s in compiled C, releasing the GIL on numeric work. They are the engine of vectorized NumPy code.

## Basic usage

```python
np.add(a, b)         # element-wise; equivalent to a + b
np.subtract(a, b)    # a - b
np.multiply(a, b)    # a * b
np.divide(a, b)      # a / b — true division
np.floor_divide(a, b) # a // b
np.power(a, b)       # a ** b
np.mod(a, b)         # a % b

np.sin(a), np.cos(a), np.tan(a)
np.exp(a), np.log(a), np.log2(a), np.log10(a), np.log1p(a)
np.sqrt(a), np.square(a), np.abs(a)
np.minimum(a, b), np.maximum(a, b)
np.greater(a, b), np.less_equal(a, b), np.isclose(a, b)
np.logical_and(a, b), np.logical_or(a, b), np.logical_not(a)
```

## Ufunc parameters

Every ufunc accepts a uniform set of keyword arguments:

### `out=` — write into an existing buffer (no allocation)

```python
out = np.empty_like(a)
np.add(a, b, out=out)       # writes result into `out`, returns it

# Multiple outputs (e.g. divmod)
q = np.empty_like(a)
r = np.empty_like(a)
np.divmod(a, b, out=(q, r))
```

Use `out=` in hot loops to avoid per-iteration allocation. The output buffer must already have the correct shape and a compatible dtype.

### `where=` — selective evaluation

Apply the ufunc only where a mask is True; leave the rest of `out` untouched.

```python
out = a.copy()
np.divide(a, b, out=out, where=(b != 0))   # don't divide where b == 0
```

NumPy 2.4 emits a warning if you pass `where=` without an explicit `out=` — the unset positions in the freshly-allocated result are uninitialized and contain garbage.

### `dtype=` and `casting=`

Force the computation/result dtype. `casting=` controls how aggressively the inputs may be coerced:

- `'no'`, `'equiv'`, `'safe'`, `'same_kind'` (default), `'unsafe'`
- New in 2.4: `'same_value'` — only allow casts that don't change any value at runtime (raises otherwise)

```python
np.add(a, b, dtype=np.float64, casting='safe')
```

## ufunc methods

For binary ufuncs (`add`, `multiply`, `minimum`, etc.):

### `.reduce(arr, axis=...)` — fold along an axis

```python
np.add.reduce(a)              # equivalent to a.sum() — sum along axis 0
np.add.reduce(a, axis=None)   # full reduction over all elements
np.multiply.reduce(a)         # equivalent to a.prod()
np.minimum.reduce(a, axis=0)  # equivalent to a.min(axis=0)
np.logical_or.reduce(mask)    # is anything True?
```

`np.add.reduce` is what `np.sum` calls under the hood. Use the ufunc method directly when you want a less-common reducer (e.g. `np.bitwise_or.reduce`).

### `.accumulate(arr, axis=...)` — like reduce but keeps intermediate values

```python
np.add.accumulate(a)          # equivalent to a.cumsum()
np.multiply.accumulate(a)     # equivalent to a.cumprod()
np.maximum.accumulate(a)      # running max
```

### `.reduceat(arr, indices, axis=...)` — segmented reduce

Reduce groups of indices in one pass. Useful for variable-size bins.

```python
a = np.arange(10)
# Sum [0:3], [3:5], [5:10]
np.add.reduceat(a, [0, 3, 5])  # → array([3, 7, 35])
```

### `.at(arr, indices, value)` — unbuffered in-place

Standard fancy-index assignment is **buffered**: with duplicate indices, only one update is reflected. `.at` is unbuffered — every duplicate index is applied.

```python
arr = np.zeros(5)
arr[[0, 0, 0, 1]] += 1               # buffered — may leave arr[0] == 1 (not 3)

arr = np.zeros(5)
np.add.at(arr, [0, 0, 0, 1], 1)      # unbuffered — arr[0] == 3 reliably
```

Use `np.add.at` (and similar) for histogram-like accumulation by integer index.

### `.outer(a, b)` — outer product

```python
np.multiply.outer([1, 2, 3], [10, 20])  # shape (3, 2)
np.add.outer([1, 2], [10, 20])          # outer sum
```

## When NOT to use `np.vectorize`

`np.vectorize` makes a Python function accept array inputs, but **it is a Python loop under the hood** — it does NOT speed things up. It exists for convenience, not performance. If your function is pure-Python scalar math, vectorize doesn't help; rewrite the function in terms of array ops.

```python
# Wrong — np.vectorize is slow
def f(x): return x * 2 if x > 0 else x * 3
vf = np.vectorize(f)
result = vf(arr)         # iterates element-by-element in Python

# Right — vectorized
result = np.where(arr > 0, arr * 2, arr * 3)
```

The only legitimate uses of `np.vectorize` are (1) broadcasting a function that's already implemented as a scalar Python op you can't rewrite, and (2) getting auto-broadcast semantics for free in tests.

## Performance tips

- Pre-allocate the `out=` buffer when looping over batches
- Combine multiple ops into one expression — NumPy doesn't fuse, but fewer Python-level calls mean less interpreter overhead
- For complex per-element logic, `np.where(cond, a, b)` beats branching loops; nested where works for multi-way
- For non-trivial scalar-on-array ops (rare numerical functions), write a Numba `@njit` function — that genuinely compiles
