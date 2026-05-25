# Indexing and Slicing — Copy vs View

Most NumPy bugs come from forgetting whether an indexer returned a **view** (shares memory) or a **copy** (independent buffer). The rule is short but consequential.

## The view/copy rule

| Operation | Returns | Mutation propagates? |
|---|---|---|
| Basic slicing `arr[1:5]`, `arr[::2]`, `arr[..., 0]` | **View** | Yes |
| `arr.T`, `arr.reshape(...)` when stride-compatible | **View** | Yes |
| `arr.ravel()` (if contiguous) | **View** | Yes |
| Integer-array indexing `arr[[0, 2, 4]]` | **Copy** | No |
| Boolean masking `arr[mask]` | **Copy** | No |
| `np.take(arr, [0, 2, 4])` | **Copy** | No |
| `arr.flatten()` | **Copy** | No |
| `arr.astype(...)` (different dtype) | **Copy** | No |
| `np.ascontiguousarray(arr)` (if already contiguous) | View; else copy | Conditional |

Check at runtime: `arr.base is None` → it owns its data (not a view); otherwise it views `arr.base`. `np.shares_memory(a, b)` confirms whether two arrays alias.

## Basic slicing

```python
arr = np.arange(24).reshape(4, 6)

arr[1, 2]              # scalar — returns np.int64(8)
arr[1]                 # row 1 — view, shape (6,)
arr[:, 2]              # column 2 — view, shape (4,)
arr[1:3, ::2]          # rows 1–2, every other column — view
arr[..., 0]            # leading ellipsis — last-axis index 0
arr[None, ...]         # insert axis 0 → shape (1, 4, 6)
arr[:, np.newaxis, :]  # newaxis is None — shape (4, 1, 6)
```

Negative indices and slice steps work as in pure Python.

## Integer-array (fancy) indexing

Returns a **copy** with shape matching the index arrays.

```python
arr = np.arange(10)
arr[[1, 3, 5, 7]]                    # → array([1, 3, 5, 7]) — copy

mat = np.arange(20).reshape(4, 5)
rows = np.array([0, 2])
cols = np.array([1, 3])
mat[rows, cols]                      # → mat[0,1], mat[2,3] — shape (2,)
mat[rows[:, None], cols[None, :]]    # 2D cross-product — shape (2, 2)
```

### `np.ix_` for open-mesh selection

When you want the cross product of independent index arrays:

```python
mat[np.ix_([0, 2], [1, 3])]
# Equivalent to mat[[[0],[2]], [[1,3]]] — shape (2, 2)
```

### `np.take` / `np.put`

```python
np.take(arr, [1, 3, 5], axis=0)            # equivalent to arr[[1,3,5]]
np.put(arr, [0, 2], [100, 200])            # in-place flat assignment
```

`np.take` accepts `mode='clip'` / `'wrap'` / `'raise'` for out-of-bounds handling.

## Boolean indexing

Mask must match the shape of the indexed dimension(s). Returns a **copy** as 1D values.

```python
arr = np.array([1, -2, 3, -4, 5])
mask = arr > 0
arr[mask]                  # → array([1, 3, 5]) — copy
arr[arr > 0]               # same

mat[mat > 5]               # flat 1D copy of all entries > 5

# Two equivalent ways to assign through a mask
arr[arr < 0] = 0           # mutates arr in-place
np.where(arr < 0, 0, arr)  # returns new array
```

## Advanced indexing assignment

Assignment **through** fancy indexing IS in-place on the original even though reading via the same indexer returns a copy.

```python
arr = np.arange(10)
arr[[1, 3, 5]] = -1        # in-place — arr is mutated
print(arr)                 # [0, -1, 2, -1, 4, -1, 6, 7, 8, 9]
```

Repeated indices in the assignment lhs: behavior is unspecified for which value "wins" with buffered assignment. Use `np.add.at` for unbuffered accumulation:

```python
arr = np.zeros(5)
arr[[0, 0, 0, 1]] += 1      # buffered — may not add 3 to arr[0]
arr = np.zeros(5)
np.add.at(arr, [0, 0, 0, 1], 1)   # unbuffered — arr = [3., 1., 0., 0., 0.]
```

## `np.choose`

Select from N arrays per-element by integer index:

```python
choices = [np.full(5, 10), np.full(5, 20), np.full(5, 30)]
selector = np.array([0, 1, 2, 1, 0])
np.choose(selector, choices)   # → array([10, 20, 30, 20, 10])
```

## Ellipsis and newaxis

- `...` (ellipsis) — placeholder for "all remaining axes"
- `None` / `np.newaxis` — insert a new length-1 axis at that position

```python
arr5d = np.zeros((2, 3, 4, 5, 6))
arr5d[..., 0]              # equivalent to arr5d[:, :, :, :, 0]
arr5d[1, ..., 0]           # arr5d[1, :, :, :, 0]
arr5d[:, None, :, :, :, :] # add axis → shape (2, 1, 3, 4, 5, 6)
```

## Common pitfalls

- **Chained indexing**: `mat[mat > 0][0] = -1` does NOT mutate `mat` — the mask returned a copy. Use `mat[mat > 0] = ...` or `np.where`.
- **Writeable views**: `arr.T` is writeable and aliases — mutating the transpose mutates the original.
- **Forgetting `.copy()`**: `subarray = arr[1:3]` is a view; `subarray[0] = 99` changes `arr`. Add `.copy()` if you want an independent buffer.
- **MultiIndex shape surprises**: `mat[[0, 2], [1, 3]]` is shape `(2,)`, NOT `(2, 2)` — pair-wise selection. Use `np.ix_` or broadcasting for cross-product.
