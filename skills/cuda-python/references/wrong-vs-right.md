# Wrong vs Right — CUDA Python anti-patterns and corrections

Each pair shows a buggy pattern and its corrected counterpart. Use as a code-review checklist.

---

## 1. Importing CuPy unconditionally crashes CPU-only hosts

### Wrong

```python
# my_module.py
import cupy as cp                          # crashes on any host without cupy installed

def normalize(x):
    return cp.asarray(x) / cp.linalg.norm(cp.asarray(x))
```

A user installing your package on a CPU-only laptop hits `ImportError` at import time. The error happens before any of their code runs.

### Right

```python
# my_module.py
from your_pkg.gpu import xp, to_cpu        # see references/optional-dep-pattern.md

def normalize(x):
    a = xp.asarray(x)
    return to_cpu(a / xp.linalg.norm(a))
```

Now `your_pkg` imports cleanly on any host. GPU is used only when available.

---

## 2. Calling `torch.cuda.<x>` without an availability guard

### Wrong

```python
device = torch.device("cuda")               # raises if no CUDA
model = MyModel().to(device)
```

### Right

```python
if torch.cuda.is_available():
    device = torch.device("cuda")
else:
    device = torch.device("cpu")
model = MyModel().to(device)

# Or the one-liner:
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
```

Same principle for CuPy:

### Wrong

```python
arr = cp.zeros(1024)                        # cudaErrorNoDevice on CPU-only host
```

### Right

```python
if cp.cuda.runtime.getDeviceCount() > 0:    # never raises; returns 0
    arr = cp.zeros(1024)
```

Better: use [optional-dep-pattern.md](optional-dep-pattern.md) — wraps the check, caches it, and falls back to NumPy.

---

## 3. Allocating inside a hot loop

### Wrong

```python
for batch in loader:
    a = cp.asarray(batch)                   # H2D + alloc every iter
    out = cp.zeros_like(a)                  # alloc every iter
    kernel(a, out)
    results.append(out.get())               # D2H + sync every iter
```

Every iteration: allocate, copy, launch, sync, free. The allocator is the bottleneck.

### Right

```python
a = cp.empty(batch_shape, dtype=cp.float32)
out = cp.empty_like(a)
results_host = []

for batch in loader:
    a[...] = cp.asarray(batch)              # reuse existing buffer
    kernel(a, out)
    results_host.append(out.get())          # if you must D2H, do it here

# Or accumulate device-side and transfer once at the end:
results_dev = cp.empty((n_batches, *batch_shape), dtype=cp.float32)
for i, batch in enumerate(loader):
    a[...] = cp.asarray(batch)
    kernel(a, results_dev[i])
results_host = results_dev.get()             # single D2H
```

---

## 4. Calling `.synchronize()` after every op

### Wrong

```python
a = cp.array(host_data)
cp.cuda.Stream.null.synchronize()           # forces wait
b = a * 2
cp.cuda.Stream.null.synchronize()           # forces wait
c = b + 5
cp.cuda.Stream.null.synchronize()           # forces wait
```

Each `synchronize()` kills async overlap and stalls the host. Effective serial execution.

### Right

```python
a = cp.array(host_data)
b = a * 2
c = b + 5
cp.cuda.Stream.null.synchronize()           # one sync at the boundary
result = c.get()                            # implicit sync as part of D2H
```

Sync only when you cross a boundary (transfer to host, timing measurement, logging).

---

## 5. Transferring host↔device inside a hot loop

### Wrong

```python
for i in range(N_ITERS):
    a_dev = cp.asarray(a_host)              # H2D every iter
    out_dev = a_dev ** 2
    out_host = out_dev.get()                # D2H every iter
    process_on_cpu(out_host)
```

PCIe transfer is ~20-30 GB/s; SM compute is ~1000+ GB/s. You're pinned at PCIe speed.

### Right — keep data resident on device

```python
a_dev = cp.asarray(a_host)                  # one H2D
for i in range(N_ITERS):
    out_dev = process_on_device(a_dev)      # everything on GPU
out_host = out_dev.get()                    # one D2H at the end
```

If you really must touch host between iterations, use pinned memory and async transfers on a dedicated stream — at least overlap with compute.

---

## 6. Ignoring `cudaErrorAsyncLaunch` errors / swallowing exceptions

### Wrong

```python
try:
    kernel(a, b, out)
except Exception:
    pass                                    # swallowed; out is garbage now
return out.get()
```

CUDA errors poison the context — every later call will fail too, but you've discarded the diagnostic.

### Right

```python
try:
    kernel(a, b, out)
    cp.cuda.Stream.null.synchronize()       # surface async errors
except cp.cuda.runtime.CUDARuntimeError as exc:
    logger.error("kernel failed: %s (code=%d)", exc, exc.status)
    raise                                   # process is dead anyway; let it die loudly
return out.get()
```

The exit-fast pattern is correct here — a corrupted CUDA context cannot recover. Crash, get scheduled again, healthy state.

---

## 7. Forking after CUDA init

### Wrong

```python
import torch
torch.cuda.init()                           # context created in parent

import multiprocessing as mp                # default start_method='fork' on Linux
with mp.Pool(4) as p:
    p.map(work, items)                      # child workers crash on first cuda call
```

### Right

```python
import multiprocessing as mp
mp.set_start_method("spawn", force=True)    # MUST be before any cuda init

# Or for PyTorch specifically:
import torch.multiprocessing as tmp
tmp.set_start_method("spawn", force=True)

# Now safe to fork
import torch
torch.cuda.init()
```

Or simply: don't init CUDA in the parent if you'll fork. Defer CUDA setup to inside each worker.

---

## 8. Building a `RawKernel` / `SourceModule` inside the call site

### Wrong

```python
def add(a, b):
    kernel = cp.RawKernel(r'''
        extern "C" __global__ void add(...) { ... }
    ''', 'add')                             # NVRTC compile on EVERY call
    out = cp.empty_like(a)
    kernel((blocks,), (threads,), (a, b, out))
    return out
```

NVRTC compile is 100-500 ms. You pay it every call.

### Right

```python
_ADD_KERNEL = cp.RawKernel(r'''
    extern "C" __global__ void add(...) { ... }
''', 'add')                                 # compiled once at import time


def add(a, b):
    out = cp.empty_like(a)
    _ADD_KERNEL((blocks,), (threads,), (a, b, out))
    return out
```

Same for Numba: don't redefine `@cuda.jit`-decorated functions inside hot code paths.

---

## 9. Mixing CUDA Toolkit majors in one env

### Wrong

```bash
pip install cupy-cuda12x
pip install torch --index-url https://download.pytorch.org/whl/cu130
```

Both libraries load `libcudart.so` at runtime. The first one wins; the second uses a mismatched binary interface. Result: undefined behavior, silent corruption, occasional `no kernel image` errors.

### Right

```bash
# Both on CUDA 13
pip install cupy-cuda13x
pip install torch --index-url https://download.pytorch.org/whl/cu130

# Or both on CUDA 12
pip install cupy-cuda12x
pip install torch --index-url https://download.pytorch.org/whl/cu124
```

Document the supported CUDA major in your README and `pyproject.toml`'s optional-dependency extras.

---

## 10. Ignoring driver version in error messages

### Wrong

```
RuntimeError: CUDA error: no kernel image is available for execution on the device
[user immediately blames the kernel code]
```

### Right — diagnose driver/toolkit first

```bash
nvidia-smi                                  # what CUDA does the DRIVER support?
nvcc --version                              # what CUDA is the TOOLKIT?
python -c "import cupy; print(cupy.show_config())"
```

Most "no kernel image" / "insufficient driver" errors are environment mismatches, not code bugs. Save hours by checking the env first.

---

## 11. Allocating shared memory based on a variable

### Wrong (Numba)

```python
@cuda.jit
def kernel(arr, n):
    sm = cuda.shared.array((n, n), dtype=float32)    # n must be literal
    ...
```

The shared-memory shape must be a compile-time constant. Numba accepts this in the simulator but fails when JIT-compiling to PTX.

### Right

```python
TPB = 16                                    # module-level constant

@cuda.jit
def kernel(arr):
    sm = cuda.shared.array((TPB, TPB), dtype=float32)
    ...
```

For dynamic shared-memory size, use the dynamic-shared API: `cuda.shared.array(0, dtype)` and pass size at launch:

```python
kernel[blocks, threads, stream, dyn_shared_bytes](arr)
```

---

## 12. Trusting `nvidia-smi` for working-set size

### Wrong

```
"My script uses 80% of GPU memory according to nvidia-smi → I can't fit more."
```

`nvidia-smi` shows the **pool high-water mark**, not the live working set. The pool caches blocks for reuse.

### Right

```python
import cupy as cp
pool = cp.get_default_memory_pool()
print(f"actually in use: {pool.used_bytes()/1e9:.2f} GB")
print(f"pool cache size: {(pool.total_bytes() - pool.used_bytes())/1e9:.2f} GB")
```

If `used_bytes()` is low but `total_bytes()` is high, you have headroom — the pool is just holding cached blocks. Call `pool.free_all_blocks()` to release back to the driver, or set a `set_limit(...)` to cap growth.

---

## 13. Numba kernel with no bounds check

### Wrong

```python
@cuda.jit
def scale(arr):
    i = cuda.grid(1)
    arr[i] *= 2                             # writes out of bounds on the last block
```

If `arr.size` isn't a multiple of `threads_per_block`, the last block writes past the array → silent corruption or `cudaErrorIllegalAddress`.

### Right

```python
@cuda.jit
def scale(arr):
    i = cuda.grid(1)
    if i < arr.size:
        arr[i] *= 2
```

Always guard kernel writes by the array bound. Every kernel. Every time.
