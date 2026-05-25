# Broadcasting

Broadcasting is the rule that lets NumPy operate on arrays of different shapes without explicit looping. Mastering it removes most "shape mismatch" errors.

## The rules

When operating on two arrays NumPy compares shapes element-wise, **starting from the trailing (rightmost) dimensions**:

1. If the arrays have different numbers of dimensions, prepend 1s to the shorter shape until they match in length.
2. Two dimensions are **compatible** when they are equal OR one of them is 1.
3. If any dimension pair fails both tests, raise `ValueError: operands could not be broadcast together`.
4. The result shape is the element-wise max of the two shapes after step 1.
5. A dimension of size 1 is **stretched** (without copying — it's stride-trick magic) to match the other.

## Worked examples

```python
import numpy as np

# Same shape — trivially compatible
a = np.zeros((3, 4))
b = np.zeros((3, 4))
(a + b).shape       # (3, 4)

# Scalar broadcast over array
a + 5               # shape (3, 4) — scalar treated as shape ()

# Row vector + 2D matrix
row = np.arange(4)              # shape (4,)
mat = np.zeros((3, 4))          # shape (3, 4)
(mat + row).shape   # (3, 4)    — (4,) prepended to (1, 4), then (1, 4) stretches to (3, 4)

# Column vector + row vector → outer product shape
col = np.arange(3).reshape(3, 1)  # (3, 1)
row = np.arange(4)                # (4,) → treated as (1, 4)
(col + row).shape   # (3, 4)

# Higher-D
A = np.zeros((8, 1, 6, 1))
B = np.zeros((   7, 1, 5))
(A + B).shape       # (8, 7, 6, 5)
```

## Common broadcast failure

```
ValueError: operands could not be broadcast together with shapes (3,4) (4,3)
```

Read it: rightmost dims `4` vs `3` are not equal and neither is 1 → fail. The fix is usually a `.T`, a `.reshape`, or a `[:, None]` to inject the missing axis.

## Adding axes intentionally

```python
arr.reshape(-1, 1)     # 1D → column vector
arr[:, None]           # same thing, more idiomatic
arr[None, :]           # 1D → row vector
np.expand_dims(arr, axis=-1)
```

## Materializing broadcast

Usually broadcasting is "virtual" — no memory is allocated. To explicitly materialize:

```python
np.broadcast_to(arr, (3, 4))      # read-only view, broadcast to shape (3, 4)
np.broadcast_shapes((3, 1), (1, 4))  # compute result shape without arrays → (3, 4)
np.broadcast_arrays(a, b)         # materialize broadcast versions of both
```

Note: `broadcast_to` returns a **read-only view** with zero-stride along stretched dims — writing fails. Use `np.broadcast_to(...).copy()` if you need a writeable buffer.

## Silent performance traps

Broadcasting can allocate huge intermediates if you're not careful:

```python
# WRONG — allocates an N x N matrix you don't actually want
a = np.arange(1_000_000)              # shape (N,)
diff = a[:, None] - a[None, :]        # shape (N, N) — 1 TB if N=1e6!
result = np.abs(diff).sum(axis=1)

# RIGHT — same answer in O(N)
result = ...  # use einsum or a direct formula instead
```

A telltale sign: you're computing pairwise something but only need a diagonal or a 1D summary. Reach for `np.einsum`, a closed-form expression, or pairwise distance functions from `scipy.spatial.distance` for those cases.

## Broadcasting and assignment

You can broadcast on the right-hand side of an assignment to a slice — the RHS shape must be broadcastable to the LHS shape:

```python
mat = np.zeros((3, 4))
mat[:] = np.arange(4)           # broadcasts (4,) to (3, 4) — all rows get [0,1,2,3]
mat[:, 0] = np.arange(3)        # (3,) into shape (3,) — fine
mat[:] = 7                      # scalar broadcast to (3, 4)
```

If the RHS is the **same shape after broadcast** as the LHS slice, assignment is well-defined. If not, raise.

## Reading errors

> `ValueError: operands could not be broadcast together with shapes (3,4,5) (3,5)`

Right-align:

```
(3, 4, 5)
   (3, 5)
```

Trailing: 5 vs 5 ✓; middle: 4 vs 3 ✗ (neither is 1). Fix by adding an axis: `b[:, None, :]` makes b `(3, 1, 5)` which broadcasts.

## When you want explicit "no broadcast"

Use `np.equal`, `np.add`, etc. with `casting='no'` and check shapes manually — or assert the shape before the op:

```python
assert a.shape == b.shape, f"shape mismatch: {a.shape} vs {b.shape}"
result = a + b
```

This is the cheapest way to catch unintended broadcasting in production code.
