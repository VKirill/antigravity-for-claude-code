# Arrays and Dtypes

The `ndarray` is a homogeneous, multi-dimensional buffer with a typed view. Everything in NumPy hangs off these properties: data buffer + shape + strides + dtype.

## Creation

```python
import numpy as np

# From data
np.array([1, 2, 3])                      # 1D int array
np.array([[1, 2], [3, 4]], dtype=np.float32)
np.asarray(existing_array)               # no copy if already an ndarray of right dtype
np.asanyarray(x)                         # like asarray but passes subclasses through

# Initialized to a constant
np.zeros((3, 4))                         # float64 by default
np.ones((3, 4), dtype=np.int32)
np.full((3, 4), fill_value=7.5)
np.empty((3, 4))                         # uninitialized — faster, contents are garbage

# Ranges
np.arange(10)                            # 0..9 ints
np.arange(0, 1, 0.1)                     # float — prefer linspace for floats
np.linspace(0, 1, 11)                    # 11 evenly spaced values [0, 1]
np.logspace(0, 3, 4)                     # 10^0 .. 10^3

# Identity / diagonal
np.eye(3)                                # 3x3 identity
np.eye(3, k=1)                           # super-diagonal
np.diag([1, 2, 3])                       # build diagonal matrix
np.diag(M)                               # extract diagonal

# Match another array's shape/dtype
np.zeros_like(x)
np.ones_like(x)
np.empty_like(x)
np.full_like(x, fill_value=0)
```

## Dtypes

| Family | Members | Notes |
|---|---|---|
| Signed int | `int8`, `int16`, `int32`, `int64` | Default platform int is `int64` on 64-bit (including Windows since 2.0) |
| Unsigned int | `uint8`, `uint16`, `uint32`, `uint64` | Wraps on overflow without warning |
| Float | `float16`, `float32`, `float64` | `float64` is default for floats |
| Complex | `complex64` (2× `float32`), `complex128` (2× `float64`) | |
| Boolean | `bool_` | 1 byte, not 1 bit |
| String | `str_` (Unicode), `bytes_` | Fixed-width; use `StringDType` for variable-length in 2.x |
| Object | `object_` | Heterogeneous Python objects, no vectorization speedup |

```python
np.array([1, 2, 3], dtype=np.int32)
np.array([1, 2, 3], dtype='int32')        # string form also works
np.array([1, 2, 3], dtype='<i4')          # little-endian int32 (struct-style)

arr.astype(np.float64)                     # cast, returns a copy
arr.astype(np.int32, casting='safe')       # raise if loss of info
arr.astype(np.int32, copy=False)           # avoid copy if already that dtype
```

### Casting kinds

- `'no'` — no casting allowed
- `'equiv'` — only byte-order swap
- `'safe'` — only casts that preserve values (e.g., int32 → int64)
- `'same_kind'` — within same kind (float → float, int → int) — default for ufuncs
- `'unsafe'` — anything; truncation/overflow silent

## Structured dtypes (record arrays)

```python
dt = np.dtype([('name', 'U16'), ('age', 'i4'), ('weight', 'f8')])
people = np.array(
    [('Alice', 30, 60.5), ('Bob', 25, 70.0)],
    dtype=dt,
)
people['name']     # array(['Alice', 'Bob'])
people['age'].mean()
```

Use structured dtypes for fixed-schema binary records. For analytical work prefer pandas/polars DataFrames.

## Attributes

```python
arr.shape       # tuple of dimensions
arr.ndim        # len(shape)
arr.size        # total element count = product of shape
arr.dtype       # element dtype
arr.itemsize    # bytes per element
arr.nbytes      # itemsize * size
arr.strides     # tuple of bytes to step in each dim
arr.flags       # C_CONTIGUOUS, F_CONTIGUOUS, OWNDATA, WRITEABLE, ALIGNED
arr.base        # if a view, the array it views; None if it owns its data
arr.T           # transpose view (just swaps strides)
```

## Reshape / transpose / view

```python
arr.reshape(2, 6)            # new shape; returns view if possible, else copy
arr.reshape(2, -1)           # -1 = inferred
arr.ravel()                  # 1D view if possible (C-order)
arr.flatten()                # always a copy
arr.T                        # transpose view
arr.swapaxes(0, 1)
arr.transpose(2, 0, 1)
np.moveaxis(arr, source=0, destination=-1)

np.expand_dims(arr, axis=0)  # insert a length-1 axis
np.squeeze(arr)              # drop all length-1 axes
arr[:, None]                 # explicit way to add an axis
```

## Default integer on 64-bit

In NumPy 2.0+ the default platform integer dtype on **all** 64-bit platforms (Linux, macOS, **and Windows**) is `int64`. Before 2.0, Windows used `int32` by default — code crossing OS boundaries needs explicit `dtype=` to avoid surprises.

## Behavioral notes

- `np.array([1, 2.0, 3])` upcasts to `float64` — the rule is the widest input type in the literal
- `np.array([1, 2], dtype=np.int8)` truncates silently on overflow — set `casting='safe'` explicitly with `astype` to catch it
- Object dtype arrays don't release the GIL and are slow — avoid unless you genuinely need heterogeneous data
- For variable-length strings in 2.x, use `np.dtypes.StringDType` (NumPy-native variable-width strings backed by Arrow) rather than `object`
