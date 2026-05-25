# Memory management — pools, pinned, unified, OOM diagnosis

GPU memory is small (8–80 GB), fragmentable, and slow to allocate via `cudaMalloc`. CuPy and PyTorch both ship caching pools. Understanding the pool is the difference between "OOM at 80% utilization" and "smooth at 95%."

## Default memory pool — what CuPy gives you for free

CuPy installs a process-wide caching `MemoryPool` on first allocation. Behavior:

- `cp.zeros(N)` first asks the pool for a block; on miss, calls `cudaMalloc`.
- `del arr` (or going out of scope) returns the block to the pool — **does not call `cudaFree`**.
- Subsequent allocations of the same size reuse the cached block (microsecond).
- `nvidia-smi` shows the pool's high-water mark, not the live working-set. This confuses everyone the first time.

```python
import cupy as cp

mempool = cp.get_default_memory_pool()
pinned = cp.get_default_pinned_memory_pool()

a = cp.zeros(10**8, dtype=cp.float32)   # ~400 MB
print(mempool.used_bytes())             # ~400 MB
print(mempool.total_bytes())            # ~400 MB

del a
print(mempool.used_bytes())             # 0 — but block is still cached
print(mempool.total_bytes())            # still ~400 MB

mempool.free_all_blocks()
print(mempool.total_bytes())            # 0 — pool released to driver
```

Call `free_all_blocks()` between major phases of a long script to surface real memory needs.

## Memory limit

Two ways to cap pool size:

```python
mempool.set_limit(size=8 * 1024**3)     # 8 GB
mempool.set_limit(fraction=0.75)        # 75% of device memory
```

Or via env:

```bash
export CUPY_GPU_MEMORY_LIMIT=8589934592      # bytes
export CUPY_GPU_MEMORY_LIMIT=75%             # percent
```

When the limit is hit, allocation fails with `OutOfMemoryError` even if `cudaMalloc` would have succeeded. Use this to bound a process you're sharing a GPU with.

## Pinned (page-locked) host memory

Pageable host memory must be staged through a driver-managed pinned bounce buffer for H2D transfer. Allocating directly in pinned memory skips that stage:

```python
pinned_mempool = cp.get_default_pinned_memory_pool()
host_arr = cp.cuda.alloc_pinned_memory(N * 4)   # raw bytes
# Wrap as numpy view
import numpy as np
host_view = np.frombuffer(host_arr, dtype=np.float32, count=N)
host_view[:] = my_data

# Now H2D is async and faster
d_arr = cp.asarray(host_view)
```

Pinned memory is **scarce** — kernel won't run if you exhaust it. Use only for tight async pipelines. Free with `pinned_mempool.free_all_blocks()`.

## Unified / managed memory

Single address space; pages migrate between host and device on access. Useful for prototypes and oversubscription scenarios:

```python
ptr = cp.cuda.malloc_managed(N * 4)
arr = cp.ndarray((N,), dtype=cp.float32, memptr=cp.cuda.MemoryPointer(ptr, 0))
```

Performance is **worse** than explicit transfers when access patterns are dense — the migration overhead dominates. Use only when access is sparse / oversubscription is unavoidable. For ML workloads, stay with explicit `to_device`.

## Stream-ordered memory (CUDA 11.2+)

For overlap-heavy workloads, use stream-ordered allocators that bind allocations to a stream's order:

```python
# CuPy uses the default pool which is stream-aware in recent versions.
# For explicit control, use cuda-python bindings:
from cuda.bindings import runtime as cudart

err, mempool = cudart.cudaDeviceGetDefaultMemPool(0)
err, ptr = cudart.cudaMallocAsync(nbytes, stream)
# ... use ...
err, = cudart.cudaFreeAsync(ptr, stream)
```

`MallocAsync` returns immediately; the actual reservation happens when the stream reaches the call. Improves overlap when many streams allocate concurrently.

## Out-of-memory diagnosis — checklist

```bash
nvidia-smi                              # what's using GPU memory NOW?
nvidia-smi --query-compute-apps=pid,used_memory --format=csv
```

In Python:

```python
import cupy as cp
mempool = cp.get_default_memory_pool()
print(f"pool used:  {mempool.used_bytes() / 1e9:.2f} GB")
print(f"pool total: {mempool.total_bytes() / 1e9:.2f} GB")
# Free device memory (driver view)
free, total = cp.cuda.runtime.memGetInfo()
print(f"free / total: {free/1e9:.2f} / {total/1e9:.2f} GB")
```

Symptoms vs causes:

| Symptom | Likely cause |
|---|---|
| OOM but `nvidia-smi` shows plenty free | Fragmentation; call `mempool.free_all_blocks()` |
| `nvidia-smi` shows another process | Shared GPU; set `CUPY_GPU_MEMORY_LIMIT` to coexist |
| `nvidia-smi` shows your process at 100% | Real working set too large; reduce batch / chunk |
| OOM in a loop after N iterations | Leaking — keeping refs to old arrays; profile with `mempool.used_bytes()` per iter |
| OOM immediately on first batch | Pool grew, but a single allocation request exceeds free | Reduce batch size |

## compute-sanitizer — catch memory bugs

NVIDIA's successor to `cuda-memcheck`. Runs your Python script under instrumentation:

```bash
compute-sanitizer python my_script.py
compute-sanitizer --tool=racecheck python my_script.py
compute-sanitizer --tool=initcheck python my_script.py
```

Tools:
- `memcheck` (default) — out-of-bounds, misaligned, leaked memory
- `racecheck` — shared-memory race conditions in kernels
- `initcheck` — reads from uninitialized memory
- `synccheck` — illegal use of `syncthreads`

Run before every release. Catches kernel bugs that pass functional tests but corrupt output silently.

## Profiling per-iteration memory

A simple loop instrumentation:

```python
import cupy as cp


def memstat(label: str) -> None:
    pool = cp.get_default_memory_pool()
    free, total = cp.cuda.runtime.memGetInfo()
    print(
        f"{label}: pool_used={pool.used_bytes()/1e9:.2f}GB "
        f"pool_total={pool.total_bytes()/1e9:.2f}GB "
        f"free={free/1e9:.2f}GB"
    )


for i, batch in enumerate(loader):
    if i % 50 == 0:
        memstat(f"iter {i:5d}")
    out = step(batch)
```

If `pool_used` is flat but `pool_total` is rising → fragmentation. If both rise → leak. If `free` keeps falling → external process or memory pinning.

## Working with multiple GPUs

Each device has its own pool:

```python
for d in range(cp.cuda.runtime.getDeviceCount()):
    with cp.cuda.Device(d):
        pool = cp.get_default_memory_pool()
        pool.set_limit(fraction=0.75)
```

Set limits per device. Cross-device copies require enabling peer access:

```python
cp.cuda.runtime.deviceEnablePeerAccess(target_device, 0)
```

Otherwise the copy goes through host memory — slow.
