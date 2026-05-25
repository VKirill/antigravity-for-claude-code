# cuda-python — Index & Decision Map

GPU compute in Python is fragmented. Four libraries cover overlapping ground; choose the right one or pay weeks of integration tax.

## Decision Map — which library?

| You want to... | Use | Why |
|---|---|---|
| Speed up existing NumPy code | **CuPy** | Drop-in replacement; most code works after `import cupy as np` |
| Write a custom kernel in Python syntax | **Numba `@cuda.jit`** | JIT compile, CPU debug via `NUMBA_ENABLE_CUDASIM` |
| Wrap an existing `.cu` source file | **CuPy `RawKernel`** (modern) or **PyCUDA `SourceModule`** (legacy) | Both compile raw CUDA C from a Python string |
| Call the driver / runtime API directly | **`cuda.bindings.driver` / `runtime`** | Official NVIDIA bindings; needed for stream/context plumbing |
| Profile, query memory, manage streams from Python | **`cuda.bindings.nvml`** + **`cuda.core`** | Standard NVIDIA telemetry + Pythonic stream API |
| Deep-learning training | **PyTorch** (not this skill) | Owns autograd, `nn.Module`, mixed precision |
| Optional GPU acceleration with CPU fallback | **CuPy via [optional-dep-pattern.md](optional-dep-pattern.md)** | The differentiating artifact of this skill |

## Library comparison

| Feature | CuPy | Numba `@cuda.jit` | PyCUDA | cuda-python (bindings) |
|---|---|---|---|---|
| Abstraction level | High (array API) | Medium (kernel JIT) | Low (raw C) | Lowest (raw API) |
| API mirrors | NumPy / SciPy | Python with CUDA built-ins | CUDA C in strings | C driver/runtime |
| Custom kernels | `RawKernel`/`ElementwiseKernel` | Native via decorator | `SourceModule` | nvrtc + driver launch |
| CPU debug mode | No (use NumPy fallback) | `NUMBA_ENABLE_CUDASIM=1` | No | No |
| Zero-copy interop | `__cuda_array_interface__`, DLPack | `__cuda_array_interface__` | GPUArray | Raw pointers |
| Memory pool | Built-in default | Via CuPy or manual | Manual | Manual |
| Maintained by | Preferred Networks / NVIDIA-blessed | Anaconda + community | Andreas Klöckner (slower cadence) | NVIDIA official |
| Typical use case | Array math, FFT, linalg | Custom reductions, scans | Legacy `.cu` wrap | Plumbing, telemetry |
| Recommended in 2026 | **Yes — default choice** | **Yes — when CuPy too high-level** | Only for legacy code | When you need driver-level control |

## When to combine

- **CuPy + Numba**: pass `cupy.ndarray` directly into a `@cuda.jit` kernel via `__cuda_array_interface__`. No copy.
- **CuPy + PyTorch**: zero-copy via DLPack (`cupy.from_dlpack(torch_tensor)` / `torch.from_dlpack(cupy_array)`). Same memory.
- **CuPy + cuda-python**: use `cuda.bindings.runtime` for fine stream control, hand the stream to `cupy.cuda.ExternalStream`.

## File index — what to open

| File | Read when |
|---|---|
| [setup.md](setup.md) | First time install, version mismatch error, Docker setup, conda vs pip |
| [optional-dep-pattern.md](optional-dep-pattern.md) | Writing CPU/GPU-portable library code — **the core artifact** |
| [cupy-basics.md](cupy-basics.md) | Day-to-day CuPy usage, kernel fusion, custom kernels |
| [numba-cuda.md](numba-cuda.md) | Writing `@cuda.jit` kernels, CI without GPU via simulator |
| [pycuda.md](pycuda.md) | Wrapping existing `.cu` source files, legacy code |
| [cuda-python-low-level.md](cuda-python-low-level.md) | Direct driver/runtime API access, telemetry via NVML |
| [memory-management.md](memory-management.md) | OOM, memory pools, pinned/unified memory |
| [interop.md](interop.md) | Moving data between CuPy ↔ PyTorch ↔ NumPy ↔ Polars |
| [troubleshooting.md](troubleshooting.md) | Symptom-indexed: error messages, stuck kernels, slow first call |
| [recommended-defaults.md](recommended-defaults.md) | Choosing block/grid sizes, pool sizes, when to use streams |
| [wrong-vs-right.md](wrong-vs-right.md) | Code review checklist — anti-patterns vs corrected versions |
| [eval-cases.md](eval-cases.md) | Routing tests for skill maintenance |

## Glossary

- **Host** — the CPU side (NumPy land).
- **Device** — the GPU.
- **Context** — a per-process state owned by a device (handles, streams, modules).
- **Stream** — an ordered queue of GPU work; default stream synchronizes globally, named streams overlap.
- **Pinned (page-locked) memory** — host RAM that won't be swapped out; required for fast async transfers.
- **Unified / managed memory** — single address space migrated on access between host/device.
- **PTX / cubin** — NVIDIA's intermediate / binary kernel format.
- **Compute Capability** — GPU architecture version (sm_70 = Volta, sm_80 = Ampere, sm_90 = Hopper, sm_100 = Blackwell).
- **Forward Compatibility** — newer driver runs older toolkit; usually safe.
- **Backward Compatibility** — older driver runs newer toolkit; usually broken (needs special package).

## Quick API map

```
cupy                     — array module (cp.array, cp.fft, cp.linalg, cp.random)
cupy.cuda.Device         — device context manager
cupy.cuda.Stream         — async stream
cupy.cuda.runtime        — wraps cudart (getDeviceCount, getDeviceProperties)
cupy.cuda.MemoryPool     — device memory pool
cupy.cuda.PinnedMemoryPool — host pinned pool
cupy.RawKernel           — compile raw CUDA C
cupy.ElementwiseKernel   — declarative element-wise op
cupy.ReductionKernel     — declarative reduction
cupy.fuse                — kernel fusion decorator

numba.cuda.jit           — kernel decorator
numba.cuda.grid          — absolute thread position helper
numba.cuda.shared.array  — shared memory allocator
numba.cuda.atomic        — atomic operations
numba.cuda.synchronize   — block on default stream

cuda.bindings.driver     — driver API (cuInit, cuCtxCreate, ...)
cuda.bindings.runtime    — runtime API (cudaGetDeviceCount, cudaMalloc, ...)
cuda.bindings.nvrtc      — runtime compile of CUDA C
cuda.bindings.nvjitlink  — JIT link cubin/PTX
cuda.bindings.nvml       — telemetry (driver version, util, memory, temperature)
cuda.core.experimental   — high-level Pythonic wrapper
```

The names are sticky; bookmark this section.
