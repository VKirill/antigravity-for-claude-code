# Interop with Other Libraries

NumPy's `ndarray` is the lingua franca of scientific Python. Every adjacent library either is an `ndarray` or knows how to round-trip with one.

## pandas

```python
import numpy as np
import pandas as pd

# NumPy → pandas
df = pd.DataFrame(arr, columns=['a', 'b', 'c'])
s = pd.Series(arr)

# pandas → NumPy
arr = df.to_numpy()                           # preferred — explicit conversion
arr = df['col'].to_numpy()
arr = df.values                                # legacy; still works but ambiguous on mixed dtypes

# Pandas extension arrays (Arrow-backed, nullable Int64, etc.) won't always
# round-trip cleanly. `to_numpy(dtype=...)` forces a specific NumPy dtype.
arr = df.to_numpy(dtype=np.float64, na_value=np.nan)
```

When a pandas DataFrame has columns of different dtypes, `.to_numpy()` returns an `object` dtype array (slow!). Either subset to homogeneous columns first or pass `dtype=` to coerce.

## Polars

```python
import polars as pl

# NumPy → polars
df = pl.from_numpy(arr, schema=['a', 'b', 'c'])
s = pl.Series('name', arr)

# polars → NumPy
arr = df.to_numpy()                            # eager, materializes a copy
arr = df['col'].to_numpy()                     # zero-copy for native types where safe
arr = df['col'].to_numpy(allow_copy=False)     # raise instead of silently copying
```

Polars is Arrow-native, so for numeric columns the underlying memory is already laid out as a contiguous NumPy-compatible buffer. Conversion is usually free.

## PyTorch — **shared memory!**

```python
import torch

# NumPy → PyTorch — SHARES MEMORY with the source ndarray on CPU
t = torch.from_numpy(arr)
t[0] = 999                                    # mutates arr too!
arr[0]                                         # also 999

# PyTorch → NumPy — same: shared memory for CPU tensors
arr = t.numpy()
arr[0] = -1                                   # mutates t too!

# For independence, copy explicitly
t = torch.from_numpy(arr.copy())
arr = t.detach().cpu().numpy().copy()

# GPU tensors cannot share memory with NumPy — explicit move required
t_gpu = t.to('cuda')
arr = t_gpu.cpu().numpy()                     # transfer + numpy view
```

**This is the source of many surprising mutation bugs.** If your code passes a NumPy array to PyTorch and later mutates the NumPy array, you've silently mutated the tensor too. Always `.copy()` if you need separation.

## CuPy (GPU NumPy)

```python
import cupy as cp

# Upload to GPU
arr_gpu = cp.asarray(np_arr)                  # copy host → device

# Download to CPU
arr_cpu = arr_gpu.get()                       # copy device → host
arr_cpu = cp.asnumpy(arr_gpu)                 # same thing

# Most NumPy ops work identically:
result = cp.linalg.solve(arr_gpu, b_gpu)
```

See the `cuda-python` skill for the full GPU workflow.

## Array Protocols

NumPy supports several interop protocols:

### `__array_interface__` (oldest)

A dictionary describing the memory layout that NumPy can wrap zero-copy:

```python
np.asarray(some_obj_with_array_interface)
```

### `__array_function__` (NEP 18)

Allows non-NumPy array libraries to override NumPy functions. When you call `np.sum(some_dask_array)`, Dask intercepts and returns a Dask result. Most libraries (Dask, CuPy, JAX, PyTorch) implement this.

### `__array_namespace__` (Array API standard)

The cross-library standard (Array API). Lets you write code that works for any compliant array library:

```python
from array_api_compat import array_namespace

def my_func(x):
    xp = array_namespace(x)          # numpy, cupy, torch, jax, ...
    return xp.sin(x) ** 2 + xp.cos(x) ** 2
```

NumPy 2.x is Array API compliant out of the box (the experimental `numpy.array_api` submodule was **removed** in 2.0 — the main `numpy` namespace now provides this directly). For strict compliance testing use the separate `array-api-strict` package.

### DLPack

Zero-copy tensor exchange between frameworks. The standard for "share this GPU buffer with another lib":

```python
import torch
import numpy as np

t = torch.randn(1000)
# Convert to DLPack then back as NumPy (CPU only — DLPack supports GPU but np.from_dlpack is CPU)
arr = np.from_dlpack(t)

# The reverse, NumPy → PyTorch via DLPack
t2 = torch.from_dlpack(arr)
```

For CPU-to-CPU, `torch.from_numpy` is simpler. DLPack shines for GPU-to-GPU exchange between PyTorch and CuPy (or JAX), avoiding host round-trips.

## Buffer protocol

Python's lower-level memoryview protocol works with NumPy:

```python
buf = bytearray(1024)
arr = np.frombuffer(buf, dtype=np.float32)    # zero-copy wrap of the bytearray
arr[0] = 3.14                                  # mutates buf
```

Useful for receiving data from sockets, shared memory, or C extensions.

## Type stubs and TypeScript-like typing

```python
import numpy as np
import numpy.typing as npt

def process(arr: npt.NDArray[np.float64]) -> npt.NDArray[np.float64]:
    return arr * 2
```

`npt.NDArray[np.float64]` is the recommended way to type an array of a specific dtype. NumPy 2.4 adds runtime signature introspection for 300+ classes/functions — `inspect.signature(np.array)` now works.

## Best-practice summary

- Use `.to_numpy()` (pandas) and `from_numpy()` (PyTorch) explicitly — never rely on `.values` magic
- Remember `torch.from_numpy` / `.numpy()` **share memory** on CPU — copy if you need independence
- For multi-library code, write against the Array API namespace via `array_api_compat.array_namespace`
- For GPU-to-GPU exchange, DLPack is the standard; avoid host round-trips
- The experimental `numpy.array_api` submodule is gone in 2.x — use the main `numpy` namespace
