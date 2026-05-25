# Troubleshooting — cuda-python (symptom-indexed)

Find your symptom, follow the diagnose steps, apply the fix. CUDA errors are often reported far from the actual cause because the runtime is asynchronous — the first sync after a bad kernel surfaces it.

---

## `ImportError: No module named 'cupy'`

**Symptoms**
- `import cupy` raises `ImportError`
- Code that gracefully falls back to NumPy on this host crashes anyway

**Diagnose**
```bash
python -c "import sys; print(sys.executable)"
which python
pip list | grep -i cupy
```

**Common causes**
- CuPy not installed in the active environment (different venv than expected)
- Installed wrong wheel variant — `cupy-cuda13x` when host has CUDA 12 → cupy package present but native `.so` won't load
- Code imports `cupy` at module top-level without a try/except (see [optional-dep-pattern.md](optional-dep-pattern.md))

**Fix**
```bash
# Pick the wheel matching the toolkit
pip install cupy-cuda13x          # for CUDA 13.x driver/toolkit
# or
pip install cupy-cuda12x          # for CUDA 12.x driver/toolkit
```

Then refactor the import via [optional-dep-pattern.md](optional-dep-pattern.md) so this failure becomes a graceful CPU fallback.

---

## `CUDARuntimeError: cudaErrorInsufficientDriver`

**Symptoms**
- `cupy.cuda.runtime.getDeviceCount()` raises this error
- `nvidia-smi` works fine and shows a GPU
- Same code worked on another machine

**Diagnose**
```bash
nvidia-smi                                                # shows max CUDA supported by driver
nvcc --version                                            # shows toolkit version
python -c "import cupy; print(cupy.cuda.runtime.runtimeGetVersion())"
```

**Common causes**
- Driver is older than the CUDA Toolkit that the wheel was built against
- Container has newer CUDA than the host driver supports (and no Forward Compat package)

**Fix**
- Upgrade the host driver (best): `apt-get install -y nvidia-driver-XXX`
- Or install matching older `cupy-cuda12x` instead of `cupy-cuda13x`
- Or install `cuda-compat-13-2` in the container

---

## `CUDA error: no kernel image is available for execution on the device`

**Symptoms**
- Kernel launches but immediately errors
- Other kernels in the same process work

**Diagnose**
```bash
nvidia-smi                                                # find compute capability
python -c "import cupy as cp; print(cp.cuda.runtime.getDeviceProperties(0))"
```

**Common causes**
- Pre-compiled kernel (cubin) was built for a different compute capability (e.g., sm_80 binary on an sm_70 device)
- Wheel mismatch — `cupy-cuda13x` is loading a `.so` that targets sm_90+ only
- Custom `RawKernel` compiled for the wrong `--gpu-architecture`

**Fix**
- For pre-compiled custom kernels: re-compile with the correct `-arch=sm_XX` for the target device
- For CuPy: install the wheel variant that includes broad arch support, or build from source on the target machine
- For Numba: `numba` auto-targets the running device; this error should not appear unless an older cached PTX is stale — clear `~/.numba_cache`

---

## `CUDARuntimeError: cudaErrorIllegalAddress`

**Symptoms**
- Sometimes called "illegal memory access was encountered"
- May appear on a `synchronize()` call far from the actual buggy kernel
- Process is now corrupted — no further CUDA call will succeed

**Diagnose**
```bash
compute-sanitizer python your_script.py
# Look at the FIRST line in the trace — that's the real crash site
```

Inside Python, enable synchronous error reporting:
```python
import os
os.environ["CUDA_LAUNCH_BLOCKING"] = "1"   # set BEFORE importing cupy/torch
```

This makes kernel launches synchronous so the error surfaces at the actual call.

**Common causes**
- Kernel writes out of bounds (no `if i < arr.size` guard)
- Pointer to freed memory passed to a kernel
- Mismatched grid/block configuration vs array size
- Use-after-free across streams without proper sync

**Fix**
- Add bounds checks to every kernel
- Re-run under `compute-sanitizer` to find the exact line
- Restart Python — the process state is unrecoverable after this error

---

## Workers stuck / kernel never returns

**Symptoms**
- `cp.cuda.Stream.synchronize()` hangs
- `nvidia-smi` shows GPU at 0% utilization
- No error, no progress

**Diagnose**
```bash
# Check for runaway kernels
nvidia-smi --query-compute-apps=pid,used_memory --format=csv
# Look for your PID; if no GPU work but you're "synchronizing", a kernel deadlocked
```

**Common causes**
- Infinite loop inside a kernel (no termination condition in a while loop)
- `cuda.syncthreads()` in a divergent branch — only some threads reach the barrier
- Deadlock in atomics waiting on a value that never changes

**Fix**
- Kill the process (it cannot recover — CUDA context is locked)
- Re-examine kernel for unbounded loops and unconditional `syncthreads`
- Add a max-iteration cap on any while-loop inside a kernel

---

## OOM but `nvidia-smi` shows plenty free

**Symptoms**
- `cudaErrorMemoryAllocation` or `cupy.cuda.memory.OutOfMemoryError`
- `nvidia-smi` shows e.g. 40 GB free
- Allocation that fails is much smaller than free memory

**Diagnose**
```python
import cupy as cp
pool = cp.get_default_memory_pool()
print(f"pool used:  {pool.used_bytes()/1e9:.2f} GB")
print(f"pool total: {pool.total_bytes()/1e9:.2f} GB")
free, total = cp.cuda.runtime.memGetInfo()
print(f"driver free: {free/1e9:.2f} / {total/1e9:.2f} GB")
```

If pool total is close to total but the largest free contiguous block is small, fragmentation is the cause.

**Common causes**
- Many small allocations that freed in non-LIFO order → fragmentation
- Pinned memory pool blown out by careless `alloc_pinned_memory` use
- A `CUPY_GPU_MEMORY_LIMIT` env var capping below `nvidia-smi`'s number

**Fix**
```python
pool.free_all_blocks()                      # release pool to driver, defrag
```

Long-term: allocate large arrays first (they need contiguous blocks), small later. Or pre-allocate working buffers outside the hot loop.

---

## Slow first call (300ms+ before any work happens)

**Symptoms**
- First kernel launch takes 300ms+
- Subsequent launches are microseconds

**Common causes**
- NVRTC JIT compilation of the kernel
- CUDA context creation
- Numba kernel caching its compiled artifact

**Fix — warm-up pattern**
```python
def warmup():
    a = cp.zeros(1, dtype=cp.float32)
    a += 1
    cp.cuda.Stream.null.synchronize()

warmup()    # call once at process start
# Now timing measurements are steady-state
```

For Numba: the cache lives in `~/.numba_cache`. Pre-populate it in your Docker build step:

```dockerfile
RUN python -c "import my_pkg.kernels; my_pkg.kernels.warmup()"
```

---

## Multiprocessing + CUDA → `cudaErrorInitializationError` in child

**Symptoms**
- Parent process initialized CUDA, then forked workers
- Child crashes on first CUDA call with `cudaErrorInitializationError` or "RuntimeError: Cannot re-initialize CUDA in forked subprocess"

**Common causes**
- Used `multiprocessing.set_start_method('fork')` (default on Linux)
- CUDA contexts are per-process — fork copies the parent's context state, which is then invalid in the child

**Fix**
```python
import multiprocessing as mp
mp.set_start_method("spawn", force=True)    # MUST be at the top, before any CUDA use
```

Or use `multiprocessing.get_context("spawn")` explicitly. PyTorch's `torch.multiprocessing` defaults to `spawn` — prefer it over `multiprocessing`.

For `DataLoader` workers in PyTorch, ensure `num_workers > 0` uses `spawn` or `forkserver`.

---

## Docker container reports `device_count = 0`

**Symptoms**
- Host has a GPU; `nvidia-smi` works on host
- Inside the container, `cupy.cuda.runtime.getDeviceCount()` returns 0

**Diagnose**
```bash
# On host
docker run --rm --gpus all nvidia/cuda:13.2.0-base-ubuntu24.04 nvidia-smi
```

If this fails too, the NVIDIA Container Toolkit isn't installed on the host.

**Fix**
```bash
# Install NVIDIA Container Toolkit on the host
distribution=$(. /etc/os-release; echo $ID$VERSION_ID)
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

Run containers with `--gpus all` (modern) or `--runtime=nvidia` (legacy).

---

## `version mismatch` between toolkit and library

**Symptoms**
- Error mentions a specific library: `libcublas.so.13: cannot open shared object file`
- Or `cublas runtime error: out of memory at` immediately on first cublas call

**Diagnose**
```bash
ldconfig -p | grep cublas
python -c "import cupy; print(cupy.show_config())"
```

**Common causes**
- Multiple CUDA toolkit installs (e.g., `/usr/local/cuda-12.6` and `/usr/local/cuda-13.2`)
- `LD_LIBRARY_PATH` points to the wrong one
- conda env mixed with system CUDA

**Fix**
```bash
# Set LD_LIBRARY_PATH explicitly per env
export LD_LIBRARY_PATH=/usr/local/cuda-13.2/lib64:$LD_LIBRARY_PATH
```

Or use conda-forge `cupy` which bundles its own copies and ignores system CUDA.

---

## Numba kernel works in simulator, fails on GPU

**Symptoms**
- `NUMBA_ENABLE_CUDASIM=1 pytest` passes
- Real GPU run errors or returns wrong values

**Common causes**
- Type mismatch — simulator doesn't enforce types, GPU does
- Used Python `int` where a `numba.int32` was required
- Used a closure variable that the simulator captures but the GPU can't
- Warp-level operation (`cuda.shfl_sync`, etc.) — not supported in simulator, so behavior diverges

**Fix**
- Add type annotations: `def kernel(a: cuda.types.Array(float32, 1, 'C'), ...)`
- Replace Python types with `numba.types`
- For warp ops, you must test on real hardware — no shortcut

---

## Symptom checklist for production triage

```
[ ] nvidia-smi works on host?               → if no, fix driver first
[ ] nvidia-smi works in container?          → if no, fix container toolkit
[ ] python -c 'import cupy' works?          → if no, fix wheel install
[ ] cupy.cuda.runtime.getDeviceCount() > 0? → if no, fix driver/toolkit mismatch
[ ] compute-sanitizer clean?                → if no, fix kernel bugs
[ ] mempool free_all_blocks() helps?        → if yes, fragmentation
[ ] CUDA_LAUNCH_BLOCKING=1 changes errors?  → reveals real crash site
[ ] same code works with start_method=spawn? → if yes, fork-after-init bug
```
