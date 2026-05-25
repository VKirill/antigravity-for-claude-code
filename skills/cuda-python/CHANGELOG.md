# Changelog — cuda-python skill

All notable changes to this skill follow [Keep a Changelog](https://keepachangelog.com/) and [SemVer](https://semver.org/).

## [1.0.0] — 2026-05-16

Initial release.

### Added

- `SKILL.md` — navigator with capability outline, behavioral traits, important constraints, related skills, API reference table
- `references/REFERENCE.md` — library decision matrix (CuPy vs Numba vs PyCUDA vs cuda-python), glossary, quick API map
- `references/setup.md` — install methods (pip wheels, conda-forge, uv), CUDA Toolkit ↔ driver compatibility, multi-CUDA environments, Docker setup
- `references/optional-dep-pattern.md` — **the differentiating artifact**. Complete reusable module template: `xp` namespace, `is_cuda_available()`, `cuda_device_count()`, `to_cpu` / `to_device` helpers, `cuda_required` / `cuda_optional` decorators, env-var guards (`FORCE_CPU`, `CUDA_VISIBLE_DEVICES`), pytest fixture for mocking GPU presence, Numba simulator integration, `pyproject.toml` extras pattern
- `references/cupy-basics.md` — array creation, host↔device transfer, device selection, streams, kernel fusion, ElementwiseKernel, ReductionKernel, RawKernel, RawModule
- `references/numba-cuda.md` — `@cuda.jit` decorator, `cuda.grid` thread positioning, shared memory, atomics, device functions, grid-stride loop, CUDASim (`NUMBA_ENABLE_CUDASIM=1`), interop with CuPy
- `references/pycuda.md` — `pycuda.autoinit`, `SourceModule`, `GPUArray`, manual context management, migration guide to CuPy `RawKernel`
- `references/cuda-python-low-level.md` — NVIDIA official bindings: `cuda.bindings.driver`, `runtime`, `nvrtc`, `nvjitlink`, `nvml`, `cufile`; `cuda.core.experimental` high-level wrapper; error handling pattern; device discovery; NVRTC runtime compile
- `references/memory-management.md` — default `MemoryPool`, pinned memory, unified/managed memory, stream-ordered allocation, OOM diagnosis, `compute-sanitizer`, per-iteration memory profiling, multi-GPU pools
- `references/interop.md` — `__cuda_array_interface__` and DLPack standards, CuPy ↔ PyTorch / Numba / NumPy / Polars / pandas / JAX / TF / RAPIDS round-trips, stream-safe handoff, RMM integration
- `references/troubleshooting.md` — **high-stakes symptom-indexed catalogue**: `ImportError`, `cudaErrorInsufficientDriver`, `no kernel image is available`, `cudaErrorIllegalAddress`, stuck kernels, OOM with free memory, slow first call, multiprocessing-fork crashes, Docker `device_count = 0`, version mismatch, Numba simulator-vs-real divergence; production triage checklist
- `references/recommended-defaults.md` — pool sizes, block/thread heuristics, stream usage, profiling cadence, `CUDA_LAUNCH_BLOCKING`, `NUMBA_ENABLE_CUDASIM`, `CUPY_ACCELERATORS`, multi-GPU defaults, `pyproject.toml` extras template
- `references/wrong-vs-right.md` — 13 anti-pattern/correction pairs covering optional-dep handling, sync discipline, hot-loop allocation, kernel compile caching, toolkit version mixing, shared-memory shape literals, kernel bounds checks
- `references/eval-cases.md` — 20 positive routing prompts, 10 negative prompts, 5 edge cases for cascade decisions

### Design notes

- Frontmatter `risk: high-stakes` per task brief — compute correctness and the optional-dep boundary are both high-impact failure surfaces
- Frontmatter description: ~640 chars (slightly over the 400 sweet spot but density of trigger terms warrants it); routes on `cuda`, `gpu`, `nvidia`, `cupy`, `numba`, `@cuda.jit`, `pycuda`, `cuda-python`, `device detection`, `GPU/CPU fallback`, `torch.cuda.is_available`, `ImportError cuda`, `CUDA toolkit version mismatch`, `illegal memory access`, `multi-GPU`, `kernel fusion`, `RawKernel`
- No hardcoded version numbers in body — defers to STACK_VERSIONS.md + sync_skill_versions.py via the blank line after frontmatter (version block injection point)
- All references files < 500 lines
- Pattern 2 layout — SKILL.md navigates, references/* hold detail; every references file linked from `## API Reference` table

### Verified against

- CuPy stable docs (docs.cupy.dev) — array API, memory pool API, interoperability protocols
- Numba CUDA docs (numba.readthedocs.io) — `@cuda.jit`, `cuda.grid`, `cuda.shared.array`, `cuda.atomic`, CUDASim
- NVIDIA cuda-python docs (nvidia.github.io/cuda-python) — `cuda.bindings.driver` / `runtime` / `nvrtc` / `nvml` module layout, `cuda.core.experimental`
- NVIDIA CUDA Toolkit archive (developer.nvidia.com/cuda-toolkit-archive) — version range
