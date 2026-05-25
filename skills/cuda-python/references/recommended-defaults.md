# Recommended defaults — pool sizes, block/grid, streams, profiling

Single source of truth for the operational knobs in this skill. Don't duplicate these numbers in other files — link here.

## Memory pool

| Knob | Recommended default | Rationale |
|---|---|---|
| `mempool.set_limit(fraction=...)` | `0.75` on a shared GPU; unset on a dedicated one | Leave 25% headroom for other processes; on dedicated boxes, let the pool grow |
| `CUPY_GPU_MEMORY_LIMIT` env | Same as `fraction` | Sets the same cap without code changes |
| `mempool.free_all_blocks()` | Call once per major phase | Releases cached blocks; defragments |
| Pinned memory size | Allocate at startup, reuse | Pinned alloc is slow and exhausts host pool |

## Block / thread heuristics

| Use case | Threads per block | Blocks per grid |
|---|---|---|
| 1D element-wise on big array | `256` | `(N + 255) // 256` |
| 1D with grid-stride loop | `256` | A fixed `~ 4 * sm_count` (lets kernel scale to any N) |
| 2D matrix op (no shared mem) | `(16, 16)` = 256 | `(ceil(M/16), ceil(N/16))` |
| 2D matrix op with shared-mem tiling | `(TPB, TPB)` where `TPB ∈ {16, 32}` | Match tile shape |
| Reduction | `256` or `512` | A few thousand at most; let one thread sum across stride |
| Sparse / irregular access | `128` | Smaller blocks help cache locality |

Avoid `threads_per_block > 1024` (CUDA hard cap on most arches). Avoid `< 32` (less than one warp wastes the SM).

Rule: `threads_per_block` should be a multiple of 32 (warp size). The compiler doesn't enforce it; performance suffers if you ignore it.

## Streams

| Scenario | Use default stream | Use named streams |
|---|---|---|
| Single-threaded, single-kernel pipeline | ✓ | — |
| Overlapping H2D ↔ compute ↔ D2H | — | ✓ (one stream per phase) |
| Per-batch async submission | — | ✓ (pool of 4–8 streams) |
| Many tiny ops (< 100 µs each) | ✓ | — (overhead > benefit) |

The default stream synchronizes globally — it forces every other stream to wait at its boundary. Used naively, streams hurt more than they help. Profile before adding them.

## Profiling cadence

| When | How |
|---|---|
| First-time benchmark of a new kernel | `cupy.prof.time_range` or `cudaProfilerStart/Stop` around 10+ warm calls |
| Production tail-latency monitoring | NVML poll every 1–5 s; aggregate to histograms |
| Memory leak hunt | Log `mempool.used_bytes()` every N iters |
| Multi-GPU utilization | NVML `nvmlDeviceGetUtilizationRates` per device every 1 s |

Don't profile every iteration — the overhead skews results. Warm up first (≥ 10 iters), then time a steady-state block.

## CUPY_ACCELERATORS

CuPy can route specific ops to cuTENSOR / cuDNN backends:

```bash
export CUPY_ACCELERATORS=cutensor,cub
```

Recommended defaults:
- `cub` — fast reductions; enable by default
- `cutensor` — fast tensor contractions; enable if you use `cp.einsum` or `cp.tensordot` heavily
- `cudnn` — for `cp.cudnn` directly; rarely needed since most users go through PyTorch

## Allocation discipline

| Rule | Why |
|---|---|
| Pre-allocate output buffers outside the loop | Allocation in a hot loop costs 10-100 µs per call |
| Reuse buffers across iterations with `out=` arg | `cp.add(a, b, out=c)` writes into existing `c` |
| Avoid `cp.array(np_arr)` per iter; use pinned host buffer + `asarray` | Pageable H2D is 2–3x slower than pinned |
| Avoid `.get()` per iter for logging | Each call is a sync + D2H; aggregate then transfer |

## CUDA_LAUNCH_BLOCKING — when to set

Set `CUDA_LAUNCH_BLOCKING=1` only during debugging. In production:
- It serializes every kernel launch → 5-20% slowdown
- It eliminates async overlap

Keep it unset in production. Set it temporarily when diagnosing `cudaErrorIllegalAddress`-style bugs (see [troubleshooting.md](troubleshooting.md)).

## NUMBA_ENABLE_CUDASIM — when to set

Set it for unit tests, never for production. In CI:

```yaml
# .github/workflows/test.yml
- name: Run CPU tests with CUDA sim
  env:
    NUMBA_ENABLE_CUDASIM: "1"
  run: pytest tests/unit
```

Run real-GPU tests in a separate GPU-runner job.

## pyproject.toml — version pinning template

```toml
[project]
name = "your_pkg"
dependencies = [
    "numpy>=2.0,<3",
]

[project.optional-dependencies]
gpu-cu12 = ["cupy-cuda12x>=13,<14"]
gpu-cu13 = ["cupy-cuda13x>=13,<14"]
gpu-numba = ["numba-cuda>=0.4,<1.0"]
```

Pin CuPy by major; pin wheel variant by CUDA major. Both pieces drift independently.

## Multi-GPU launch defaults

| Setting | Default |
|---|---|
| Devices used | `cp.cuda.runtime.getDeviceCount()` — auto-discover |
| `CUDA_VISIBLE_DEVICES` | Set explicitly in deployment to gate per-process access |
| Peer access | Enable once at startup, not per-call |
| Shard strategy | Data-parallel for embarrassingly parallel; model-parallel only if a single GPU can't fit |

```python
import cupy as cp

NUM_GPUS = cp.cuda.runtime.getDeviceCount()
for d in range(NUM_GPUS):
    with cp.cuda.Device(d):
        # warm-up, set pool limit
        cp.get_default_memory_pool().set_limit(fraction=0.75)
        warmup()
```

## Summary table

| Setting | Default | When to change |
|---|---|---|
| Pool fraction | 0.75 (shared) / unset (dedicated) | Shared GPU contention |
| Threads/block | 256 (1D), (16,16) (2D) | Profiling shows worse occupancy |
| Streams | Default stream | When async overlap measurably helps |
| CUDA_LAUNCH_BLOCKING | unset | While debugging only |
| NUMBA_ENABLE_CUDASIM | unset | CI unit tests |
| CUPY_ACCELERATORS | `cub` | Heavy einsum → add `cutensor` |
