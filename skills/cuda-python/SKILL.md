---
name: cuda-python
description: GPU compute in Python with NVIDIA's cuda-python bindings, CuPy (drop-in NumPy on GPU), Numba @cuda.jit, and PyCUDA. Specializes in the optional-dependency pattern — runtime CUDA detection with graceful CPU fallback so code runs on machines without GPU. Use when cuda, gpu, nvidia, cupy, numba, @cuda.jit, pycuda, cuda-python, cuBLAS, cuDNN, device detection, GPU/CPU fallback, optional GPU acceleration, torch.cuda.is_available, ImportError cuda, CUDA toolkit version mismatch, illegal memory access, multi-GPU, kernel fusion, RawKernel.
stacks:
  - cuda-python
  - Python
tags:
  - cuda
  - gpu
  - nvidia
  - hpc
packages:
  - cuda-python
  - cupy
  - numba
  - pycuda
manifests:
  - pyproject.toml
  - requirements.txt
  - environment.yml
risk: high-stakes
source: vechkasov-global-skills
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- cuda-python: `13.2.x (NVIDIA Python bindings: CUDA Core + cudart + cuBLAS + cuDNN; verify driver compatibility)`
- Python: `3.14.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->


## Usage

Loaded automatically when its description matches the active task. This skill is the source of truth for **CUDA environment setup** and the **optional-dependency pattern** — other Python skills (pandas, polars, pytorch) that may opt into GPU acceleration delegate the routing/fallback logic here.

## Use this skill when

- Numerical compute on GPU from Python — array math, linear algebra, custom kernels
- Drop-in NumPy speedup with CuPy (`cp.asarray(...)` instead of `np.asarray(...)`)
- Writing custom CUDA kernels with `@cuda.jit` or `cupy.RawKernel`
- **Optional GPU acceleration with CPU fallback** — code must run with or without CUDA installed
- Multi-GPU workflows (`cupy.cuda.Device(n)`, `cuda.select_device(n)`)
- Direct CUDA driver/runtime API access via `cuda.bindings.driver` / `cuda.bindings.runtime`
- Diagnosing CUDA environment issues — toolkit vs driver vs library version mismatch
- Memory management problems — out-of-memory, fragmentation, pinned vs pageable transfer
- Interop between CuPy, PyTorch, NumPy, DLPack consumers (Polars/Arrow, JAX, TensorFlow)
- CI without GPU — running CUDA tests via `NUMBA_ENABLE_CUDASIM=1` or mocked detection

## Do not use this skill when

- Deep learning model training/inference workflows — use `pytorch` (but route **here** for `torch.cuda` environment diagnostics, driver issues, container CUDA setup)
- Building ML pipelines, optimizers, losses — use `pytorch`
- Pure CPU-only numerical code with no GPU concern — use `python` / `pandas` / `polars` directly
- Picking a GPU cloud instance or provisioning the host — use `linux-sysadmin`
- AMD/ROCm acceleration — out of scope (CuPy ROCm is experimental, not covered here)

## Purpose

GPU compute in Python is fragmented across four libraries with different abstraction levels — `cupy` (high-level drop-in NumPy), `numba.cuda` (JIT-compiled Python kernels), `pycuda` (raw CUDA C), and `cuda-python` (NVIDIA's official low-level bindings). Picking the wrong one wastes weeks. **This skill exists to make the routing obvious and the optional-dep pattern bulletproof.**

The differentiating artifact is `references/optional-dep-pattern.md` — a complete reusable module that detects CUDA at runtime, exposes a uniform `xp` namespace (CuPy if available, NumPy otherwise), and never crashes on import in a CPU-only environment. Every Python skill that touches GPU code should import this pattern instead of re-implementing `try: import cupy; except: ...`.

Secondary purpose: act as the **CUDA environment expert** for sibling skills. When `pytorch` users hit `CUDA error: no kernel image is available for execution on the device`, this skill owns the diagnosis path (driver vs toolkit vs library compatibility, container setup, multi-CUDA environments via uv/conda).

## Capabilities

### Library decision matrix

Four libraries cover the same space at different levels. Choosing wrong is the most common mistake:

- **CuPy** — Drop-in NumPy/SciPy replacement. Pick this 80% of the time. Most array math, FFT, linear algebra, ufuncs work unchanged via `cp.asarray()`. Custom kernels via `RawKernel`/`ElementwiseKernel`/`ReductionKernel` when needed.
- **Numba `@cuda.jit`** — JIT-compile Python functions to CUDA kernels. Pick when you need a custom kernel but want to stay in Python syntax. Excellent for prototyping and `NUMBA_ENABLE_CUDASIM` lets you debug on CPU.
- **PyCUDA** — Low-level, raw CUDA C via `SourceModule`. Pick only when you have existing `.cu` source you must wrap. Mostly legacy now — CuPy `RawKernel` covers the same need with less ceremony.
- **cuda-python (NVIDIA official)** — Direct bindings to driver/runtime/nvrtc/nvjitlink/nvml APIs. Pick when you need control over streams, contexts, primary context attach/detach, or library-version diagnostics from Python. Not for everyday compute.

Full decision matrix with code-shape examples: [references/REFERENCE.md](references/REFERENCE.md).

### Optional-dependency pattern (the core artifact)

A complete reusable module that exposes:

```python
from your_pkg.gpu import xp, is_cuda_available, cuda_device_count, to_cpu

if is_cuda_available():
    x = xp.zeros(N)        # CuPy if GPU present
else:
    x = xp.zeros(N)        # NumPy fallback
result = to_cpu(x)         # uniform device→host transfer
```

The pattern handles: `ImportError` (cupy not installed), `RuntimeError` (cupy installed but driver mismatch), `cupy.cuda.runtime.getDeviceCount() == 0` (no GPU on host), env-var override `FORCE_CPU=1` for CI/testing. See [references/optional-dep-pattern.md](references/optional-dep-pattern.md) for the full module + decorator pattern + pytest fixture for mocking GPU presence.

### CuPy basics

- Array creation: `cp.array`, `cp.asarray`, `cp.zeros`, `cp.empty_like`
- Host↔device: `cp.asarray(np_arr)` → device; `cp.asnumpy(cp_arr)` or `cp_arr.get()` → host
- Device selection: `with cp.cuda.Device(1): ...`
- Streams for overlap: `with cp.cuda.Stream(non_blocking=True): ...`
- Kernel fusion: `@cp.fuse()` decorator, `ElementwiseKernel`, `ReductionKernel`, `RawKernel`

See [references/cupy-basics.md](references/cupy-basics.md).

### Numba CUDA JIT

- `@cuda.jit` decorator marks a function as a kernel
- Launch syntax: `kernel[blocks_per_grid, threads_per_block](args)`
- Thread position: `cuda.grid(1)` / `cuda.grid(2)` (preferred over manual `threadIdx.x + blockIdx.x * blockDim.x`)
- Shared memory: `cuda.shared.array(shape, dtype)`
- Atomics: `cuda.atomic.add(arr, idx, value)`
- Device functions: `@cuda.jit(device=True)`
- CPU debugging: `NUMBA_ENABLE_CUDASIM=1` runs kernels in pure Python — essential for CI

See [references/numba-cuda.md](references/numba-cuda.md).

### PyCUDA (legacy)

- `pycuda.autoinit` for context setup
- `pycuda.gpuarray.GPUArray` analogous to `cupy.ndarray`
- `pycuda.compiler.SourceModule(""" __global__ void ... """)` for raw CUDA C
- Mostly superseded by CuPy `RawKernel` — use only when wrapping existing `.cu` source

See [references/pycuda.md](references/pycuda.md).

### cuda-python low-level bindings

- `cuda.bindings.driver` — driver API (`cuInit`, `cuDeviceGet`, `cuCtxCreate`)
- `cuda.bindings.runtime` — runtime API (`cudaGetDeviceCount`, `cudaMalloc`, `cudaMemcpy`)
- `cuda.bindings.nvrtc` — runtime compilation of CUDA C
- `cuda.bindings.nvjitlink` — JIT link of cubin/PTX
- `cuda.bindings.nvml` — management/monitoring (driver version, memory usage, temperature)
- `cuda.core.experimental` — higher-level Pythonic wrapper (stream, event, launch config)

See [references/cuda-python-low-level.md](references/cuda-python-low-level.md).

### Memory management

- Device memory pool: `cupy.get_default_memory_pool()` — cached blocks for reuse
- Pinned (page-locked) memory: `cupy.get_default_pinned_memory_pool()` — fast async transfers
- Unified/managed memory: `cupy.cuda.malloc_managed(nbytes)`
- Limit/free: `mempool.set_limit(size=...)`, `mempool.free_all_blocks()`
- Env var: `CUPY_GPU_MEMORY_LIMIT`
- Diagnosis: `nvidia-smi`, `compute-sanitizer`, `mempool.used_bytes()`

See [references/memory-management.md](references/memory-management.md).

### Interop

- `__cuda_array_interface__` — zero-copy between CuPy ↔ PyTorch ↔ Numba device arrays
- `DLPack` — `cupy.from_dlpack(t)` / `torch.from_dlpack(cp_arr)` — preferred standard
- CuPy ↔ NumPy: `cp.asarray(np_arr)` (host→device), `cp.asnumpy(cp_arr)` (device→host)
- Polars/pandas: round-trip via Arrow IPC or zero-copy via DLPack where supported
- Stream interop: `cupy.cuda.ExternalStream` wraps a PyTorch CUDA stream

See [references/interop.md](references/interop.md).

### Setup, install, version compatibility

- Wheel naming: `cupy-cuda12x`, `cupy-cuda13x` — must match installed CUDA Toolkit major
- Conda-forge bundles toolkit: `conda install -c conda-forge cupy` resolves toolkit deps
- Numba uses separate package: `pip install numba-cuda` (built-in `numba.cuda` is deprecated)
- CUDA Forward Compatibility: newer driver runs older toolkit; older driver may not run newer toolkit
- Multi-CUDA environments via `conda` envs or `uv` venvs — never mix toolkit majors in one venv

See [references/setup.md](references/setup.md).

### Troubleshooting (symptom-indexed)

Out-of-memory, version mismatch, illegal memory access, no kernel image, slow first call (JIT compile cost), multiprocessing+CUDA fork errors, container Docker NVIDIA toolkit issues. See [references/troubleshooting.md](references/troubleshooting.md).

### Recommended defaults

Memory pool config, block/grid sizing rules of thumb, when streams help vs hurt, profiling intervals, when to set `CUPY_ACCELERATORS`. See [references/recommended-defaults.md](references/recommended-defaults.md).

## Behavioral Traits

- Always calls `cupy.cuda.runtime.getDeviceCount()` or equivalent **inside a try/except** before any CuPy operation — never assumes the device is present
- Always provides a CPU fallback path when GPU is described as "optional acceleration"
- Imports CuPy lazily (inside a function or `try` block at module top) — never at the top of a module that must import on CPU-only hosts
- Pins `cupy-cudaXxx` to match the installed CUDA Toolkit major; documents the supported range in `pyproject.toml`
- Uses the `xp` namespace pattern (`xp = cupy if has_cuda else numpy`) to keep call sites identical
- For Numba, ships tests that run under `NUMBA_ENABLE_CUDASIM=1` so CI without GPU can exercise kernel logic
- Reads `nvidia-smi` and `nvcc --version` before debugging — driver and toolkit version drift is the #1 root cause
- Uses `mempool.free_all_blocks()` between major phases of long-running scripts to surface real memory needs
- Prefers DLPack over `__cuda_array_interface__` when both sides support it — DLPack handles stream safety and lifetime

## Important Constraints

- **NEVER** assume a GPU exists. Always guard with `cuda_is_available()` before any `cupy`/`torch.cuda`/`numba.cuda` call
- **NEVER** import `cupy`, `pycuda`, or `numba.cuda` at the top of a module that must run on CPU-only hosts — use lazy import inside the optional-dep wrapper
- **NEVER** call `torch.cuda.<anything>` or `cupy.<op>` without an `is_available` guard — they raise `RuntimeError` (not `ImportError`) when driver is broken
- **NEVER** mix CUDA Toolkit majors in one environment. `cupy-cuda12x` + a CUDA 13 PyTorch wheel = silent corruption or `no kernel image` errors
- **ALWAYS** document the supported CUDA Toolkit version range in `pyproject.toml` (e.g., `cupy-cuda12x>=13.0,<14`) and in README
- **NEVER** allocate inside a hot loop. Pre-allocate outputs with `cp.empty(shape)` outside the loop and pass them in
- **NEVER** transfer host↔device inside a hot loop — batch transfers, keep data resident on device
- **NEVER** call `cp.cuda.Stream.synchronize()` after every op — it kills async benefits; use only at output boundaries
- **NEVER** swallow `cupy.cuda.runtime.CUDARuntimeError` — surface it with the original error code; the code is the diagnostic key
- **ALWAYS** check `nvidia-smi` shows the GPU before debugging Python — if driver is missing, no Python code can fix it
- **NEVER** use `multiprocessing.fork()` after initializing a CUDA context — fork-after-init corrupts the child's context; use `spawn` instead

## Related Skills

### Python stack (siblings — opt-into GPU through this skill's optional-dep pattern)
- ✓ `python` — base Python 3.14 tooling, packaging via `uv`, `pyproject.toml`
- ✓ `pytorch` — deep learning framework, owns `torch.cuda.is_available()`; route **here** for environment diagnostics
- ✓ `pandas` — CPU DataFrames; cudf is a separate sibling out of scope here
- ✓ `polars` — fast DataFrames; can consume CuPy via DLPack/Arrow
- ✓ `scikit-learn` — classical ML; route here for GPU-accelerated inference fallback patterns

### Environment & ops
- ✓ `linux-sysadmin` — driver install, NVIDIA Container Toolkit, `nvidia-smi` monitoring
- ✓ `nodejs` — referenced for the optional-dep idiom (parallel to TypeScript's `Try<T>`)

### Discipline
- ✓ `karpathy-guidelines` — keeps the optional-dep pattern minimal and surgical
- ✓ `vitest` / `pytest` — testing patterns; this skill's `references/optional-dep-pattern.md` ships a pytest fixture for mocking GPU presence

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Index, decision map, library comparison (CuPy vs Numba vs PyCUDA vs cuda-python) | [references/REFERENCE.md](references/REFERENCE.md) |
| Install (pip wheels, conda, uv), CUDA Toolkit ↔ driver ↔ wheel compatibility, multi-CUDA envs | [references/setup.md](references/setup.md) |
| **Optional-dep pattern** — complete reusable module, `xp` namespace, env-var guards, pytest fixture | [references/optional-dep-pattern.md](references/optional-dep-pattern.md) |
| CuPy basics — array, asarray, transfer, device context, streams, kernel fusion, RawKernel | [references/cupy-basics.md](references/cupy-basics.md) |
| Numba CUDA JIT — @cuda.jit, grid, shared memory, atomics, device functions, CUDASim | [references/numba-cuda.md](references/numba-cuda.md) |
| PyCUDA — `pycuda.driver`, `pycuda.autoinit`, GPUArray, SourceModule (legacy/wrap `.cu`) | [references/pycuda.md](references/pycuda.md) |
| cuda-python low-level — `cuda.bindings.driver`, `runtime`, `nvrtc`, `nvjitlink`, `nvml`, `cuda.core` | [references/cuda-python-low-level.md](references/cuda-python-low-level.md) |
| Memory — pools, pinned, unified/managed, limits, OOM diagnosis, `compute-sanitizer` | [references/memory-management.md](references/memory-management.md) |
| Interop — `__cuda_array_interface__`, DLPack, PyTorch/Numba/NumPy/Polars/Arrow round-trips | [references/interop.md](references/interop.md) |
| **Troubleshooting (high-stakes)** — symptom-indexed: OOM, version mismatch, illegal mem, fork issues | [references/troubleshooting.md](references/troubleshooting.md) |
| **Recommended defaults** — pool sizes, block/grid heuristics, stream usage, profiling cadence | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Wrong vs Right** — sync errors, transfers in hot loop, alloc in loop, missing is_available guard | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases — routing tests (positive + negative prompts) | [references/eval-cases.md](references/eval-cases.md) |

**How to use**: open the specific topic file. The optional-dep-pattern is the differentiating artifact — read it first if your job is to write CPU/GPU-portable code.
