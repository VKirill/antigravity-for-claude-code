# cuda-python — NVIDIA's official low-level Python bindings

The `cuda-python` family is NVIDIA's first-party bindings. Where CuPy is a NumPy-like wrapper and Numba is a Python-to-PTX compiler, `cuda-python` is a direct mirror of the C-level CUDA APIs. Use it when you need control no higher-level library exposes — context manipulation, NVRTC compilation, NVML telemetry, JIT-link of cubin/PTX.

## Package layout

The `cuda-python` umbrella metapackage pulls in three independently-versioned sub-packages:

```
cuda-python                  # metapackage — pulls everything
├── cuda-bindings           # low-level direct bindings (driver, runtime, nvrtc, ...)
├── cuda-core               # higher-level Pythonic wrapper (stream, event, launch)
└── cuda-pathfinder         # helps locate CUDA shared libs at runtime
```

Install whichever subset you need:

```bash
pip install cuda-python              # all three
pip install cuda-bindings            # just the bindings
pip install cuda-core                # just the high-level wrapper
```

## Module map — `cuda.bindings`

| Module | Wraps | Use when |
|---|---|---|
| `cuda.bindings.driver` | CUDA Driver API (`cuInit`, `cuCtxCreate`, ...) | Context/stream/module plumbing |
| `cuda.bindings.runtime` | CUDA Runtime API (`cudaMalloc`, `cudaMemcpy`, ...) | Allocation/copy without context boilerplate |
| `cuda.bindings.nvrtc` | NVRTC — runtime compile CUDA C → PTX/cubin | Compile kernels at runtime |
| `cuda.bindings.nvjitlink` | NVJitLink — link PTX/cubin → executable | Combine multiple PTX modules |
| `cuda.bindings.nvvm` | NVVM IR compilation | Custom toolchains |
| `cuda.bindings.nvml` | NVIDIA Management Library | Telemetry (memory, util, temperature) |
| `cuda.bindings.cufile` | GPUDirect Storage (cuFile) | High-throughput I/O to GPU |

There is also `cuda.bindings.cudart` — an older alias for `cuda.bindings.runtime`. Prefer `runtime` for new code.

## Error handling pattern

Every binding call returns `(error_code, *outputs)`. The idiomatic check:

```python
from cuda.bindings import runtime as cudart


def checked(fn_result):
    err, *rest = fn_result if isinstance(fn_result, tuple) else (fn_result,)
    if err != cudart.cudaError_t.cudaSuccess:
        name = cudart.cudaGetErrorName(err)[1].decode("utf-8")
        msg = cudart.cudaGetErrorString(err)[1].decode("utf-8")
        raise RuntimeError(f"{name}: {msg}")
    return rest[0] if len(rest) == 1 else tuple(rest) if rest else None


count = checked(cudart.cudaGetDeviceCount())
print(f"{count} CUDA devices")
```

The double-decode on `cudaGetErrorName` / `cudaGetErrorString` is correct — they return `(err, bytes)`.

## Device discovery & properties

```python
from cuda.bindings import runtime as cudart

err, count = cudart.cudaGetDeviceCount()
for i in range(count):
    err, props = cudart.cudaGetDeviceProperties(i)
    print(f"Device {i}: {props.name.decode('utf-8')}")
    print(f"  Compute capability: {props.major}.{props.minor}")
    print(f"  Total memory: {props.totalGlobalMem / 1e9:.2f} GB")
```

## Allocate / free / copy with the runtime API

```python
from cuda.bindings import runtime as cudart
import numpy as np

N = 1024 * 1024
host = np.random.standard_normal(N).astype(np.float32)
nbytes = host.nbytes

err, d_ptr = cudart.cudaMalloc(nbytes)
err, = cudart.cudaMemcpy(
    d_ptr, host.ctypes.data, nbytes,
    cudart.cudaMemcpyKind.cudaMemcpyHostToDevice,
)

# ... use d_ptr in a kernel launch ...

out = np.empty_like(host)
err, = cudart.cudaMemcpy(
    out.ctypes.data, d_ptr, nbytes,
    cudart.cudaMemcpyKind.cudaMemcpyDeviceToHost,
)
err, = cudart.cudaFree(d_ptr)
```

For everyday allocation, prefer CuPy — it manages the pool, handles errors, and has nicer ergonomics. Drop to this level when you need control CuPy doesn't expose (peer access, page-locked alloc flags, custom memory types).

## NVRTC — compile a kernel at runtime

```python
from cuda.bindings import nvrtc, driver

src = b'''
extern "C" __global__ void add(const float* a, const float* b, float* c, int n) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) c[i] = a[i] + b[i];
}
'''

err, prog = nvrtc.nvrtcCreateProgram(src, b"add.cu", 0, [], [])
err, = nvrtc.nvrtcCompileProgram(prog, 0, [])
err, size = nvrtc.nvrtcGetPTXSize(prog)
ptx = b" " * size
err, = nvrtc.nvrtcGetPTX(prog, ptx)
```

The resulting `ptx` is bytes you load with `driver.cuModuleLoadData(ptx)` and then `cuModuleGetFunction` to get a callable.

## NVML — telemetry

```python
from cuda.bindings import nvml

err = nvml.nvmlInit()
err, count = nvml.nvmlDeviceGetCount()

for i in range(count):
    err, handle = nvml.nvmlDeviceGetHandleByIndex(i)
    err, name = nvml.nvmlDeviceGetName(handle)
    err, mem = nvml.nvmlDeviceGetMemoryInfo(handle)
    err, util = nvml.nvmlDeviceGetUtilizationRates(handle)
    err, temp = nvml.nvmlDeviceGetTemperature(handle, nvml.NVML_TEMPERATURE_GPU)
    print(f"GPU {i} {name.decode('utf-8')}: "
          f"mem {mem.used/1e9:.1f}/{mem.total/1e9:.1f} GB, "
          f"util {util.gpu}%, temp {temp}°C")

err = nvml.nvmlShutdown()
```

Use NVML for monitoring loops, dashboards, alerts. It's the same data `nvidia-smi` shows — programmatic access without shelling out.

## `cuda.core.experimental` — the Pythonic wrapper

`cuda-core` (the higher-level package) provides a Pythonic abstraction over the bindings:

```python
from cuda.core.experimental import Device, Stream, LaunchConfig, Program

dev = Device(0)
dev.set_current()
stream = dev.create_stream()

prog = Program(src, code_type="c++")
ker = prog.compile("cubin", name_expressions=["add"]).get_kernel("add")

config = LaunchConfig(grid=(blocks, 1, 1), block=(256, 1, 1), stream=stream)
ker(config, d_a, d_b, d_out, n)
```

This is still labelled experimental; the API surface may shift. Use bindings directly if you need stability.

## When to reach for `cuda-python` instead of CuPy

| Need | Tool |
|---|---|
| GPU array math, FFT, linalg | CuPy |
| Custom kernel in Python | Numba `@cuda.jit` |
| Custom kernel in raw CUDA C | CuPy `RawKernel` |
| Just compile PTX, load into context, manage modules | `cuda.bindings.nvrtc` + `driver` |
| Telemetry / monitoring | `cuda.bindings.nvml` |
| Peer-to-peer transfers between GPUs | `cuda.bindings.driver.cuMemcpyPeer` |
| GPUDirect Storage | `cuda.bindings.cufile` |
| Implementing your own array library | `cuda.bindings.runtime` |
| Debugging a CUDA env that CuPy can't initialize | `cuda.bindings.driver.cuInit` to isolate the failure |

## Diagnostic snippet — driver/runtime versions

```python
from cuda.bindings import driver, runtime

err, = driver.cuInit(0)
err, drv_ver = driver.cuDriverGetVersion()
err, rt_ver = runtime.cudaRuntimeGetVersion()
print(f"Driver supports CUDA {drv_ver // 1000}.{(drv_ver % 1000) // 10}")
print(f"Runtime is CUDA      {rt_ver // 1000}.{(rt_ver % 1000) // 10}")
```

If `drv_ver < rt_ver`, the driver is too old for the toolkit — common root cause of `cudaErrorInsufficientDriver`.
