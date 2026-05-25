# Setup — install, version compatibility, multi-CUDA environments

The single most common failure in GPU Python is version drift between driver, toolkit, and library wheel. This file is the install checklist.

## Three layers must agree

```
+----------------------------+
| NVIDIA driver (host OS)    |  installed via apt/yum, owns /dev/nvidia*, nvidia-smi
+----------------------------+
| CUDA Toolkit (libs/nvcc)   |  installed via conda or apt, owns libcudart, libcublas, etc.
+----------------------------+
| Python wheel (cupy, etc.)  |  installed via pip, dynamically links libcudart at runtime
+----------------------------+
```

The wheel's CUDA major **must** match the toolkit's CUDA major. The driver's CUDA major **must** be ≥ the toolkit's CUDA major.

Check each:

```bash
nvidia-smi              # shows driver version + the highest CUDA the driver supports
nvcc --version          # shows the installed CUDA Toolkit version
python -c "import cupy; print(cupy.cuda.runtime.runtimeGetVersion())"
```

Mismatch → `CUDA error: no kernel image is available for execution on the device` or `CUDARuntimeError: cudaErrorInsufficientDriver`.

## CuPy wheels — pick by toolkit major

CuPy ships separate wheels per CUDA major:

```bash
# CUDA 12.x toolkit / driver
pip install cupy-cuda12x

# CUDA 13.x toolkit / driver
pip install cupy-cuda13x
```

The trailing `x` is literal — the wheel adapts to any minor (12.0, 12.5, 12.9, ...). **Do not install both wheels** — they share the `cupy` import name and the second one wins silently.

For ROCm (AMD, experimental, out of scope here): `pip install cupy-rocm-5-0`.

## conda-forge — bundled toolkit

```bash
conda install -c conda-forge cupy
```

Resolves an internally consistent `cudatoolkit` (or `cuda-version` metapackage in newer envs) alongside the wheel. Best when you don't have system-level CUDA Toolkit installed.

For Numba on conda-forge with CUDA 12+:

```bash
conda install -c conda-forge numba-cuda cuda-nvcc cuda-nvrtc "cuda-version>=12.0"
```

## numba-cuda (separate package)

The built-in `numba.cuda` target inside the `numba` package has been moved out:

```bash
pip install numba-cuda
# imports remain `from numba import cuda`
```

The migration matters when pinning versions — track `numba-cuda` independently of `numba` core.

## cuda-python (NVIDIA bindings)

```bash
pip install cuda-python              # umbrella metapackage
pip install cuda-bindings            # just the bindings sub-package
pip install cuda-core                # high-level Pythonic wrapper
```

The metapackage pulls all of `cuda-bindings`, `cuda-core`, `cuda-pathfinder`. For minimal installs, depend only on `cuda-bindings`.

## CUDA Forward Compatibility

NVIDIA ships a "Forward Compatibility" package that lets an **older** driver run a **newer** toolkit. Typical scenario: a Docker host with driver 525 running a container that needs CUDA 13.

```bash
# Inside container, install the forward-compat package matching the toolkit
apt-get install cuda-compat-13-2     # provides libcuda.so.1 stub
```

This is the only way to update CUDA inside a container without touching the host driver. **It's not a substitute for keeping the host driver fresh** — it lags real features.

## PyTorch + CuPy together

Both libraries link `libcudart`. For zero-copy interop you **must** use the same CUDA major across both:

```bash
# Both on CUDA 12
pip install torch --index-url https://download.pytorch.org/whl/cu124
pip install cupy-cuda12x

# Both on CUDA 13
pip install torch --index-url https://download.pytorch.org/whl/cu130
pip install cupy-cuda13x
```

Mismatch silently corrupts shared tensors. The crash is delayed and far from the cause — invest in version pinning upfront.

## Multi-CUDA environments — conda preferred, uv possible

When you need CUDA 12 for one project and CUDA 13 for another on the same machine:

**conda** — one env per CUDA major:

```bash
conda create -n cu12 python=3.14
conda activate cu12
conda install -c conda-forge cupy "cuda-version=12.6"

conda create -n cu13 python=3.14
conda activate cu13
conda install -c conda-forge cupy "cuda-version=13.2"
```

**uv** — works if the host has the right `libcuda.so` and you pin wheels:

```bash
uv venv .venv-cu13
source .venv-cu13/bin/activate
uv pip install "cupy-cuda13x" "torch --index-url=https://download.pytorch.org/whl/cu130"
```

uv can't manage the system CUDA Toolkit — only the Python wheels. For a complete swap, prefer conda.

## pyproject.toml — pinning policy

```toml
[project]
dependencies = [
    "numpy>=2.0",
    # GPU acceleration is OPTIONAL
]

[project.optional-dependencies]
gpu-cu12 = ["cupy-cuda12x>=13,<14"]
gpu-cu13 = ["cupy-cuda13x>=13,<14"]
gpu-numba = ["numba-cuda>=0.4"]
```

Pin the wheel by major (`-cuda12x` vs `-cuda13x`); pin the version range by the CuPy major. Document the supported CUDA Toolkit range in README so users on older drivers know they need an older extra.

## Container / Docker setup

Use NVIDIA's base image and the NVIDIA Container Toolkit (formerly `nvidia-docker2`):

```dockerfile
FROM nvidia/cuda:13.2.0-cudnn-runtime-ubuntu24.04
RUN apt-get update && apt-get install -y python3.14 python3-pip
RUN pip install cupy-cuda13x numba-cuda
```

Run with:

```bash
docker run --gpus all -it <image>
# or older syntax
docker run --runtime=nvidia -it <image>
```

`--gpus all` requires the NVIDIA Container Toolkit installed on the host. Without it, `cupy.cuda.runtime.getDeviceCount()` returns 0 inside the container even though the host has a GPU. This is the most common Docker-CUDA pitfall.

## Verification one-liner

```bash
python -c "
import cupy as cp
print('cupy version :', cp.__version__)
print('runtime ver  :', cp.cuda.runtime.runtimeGetVersion())
print('driver ver   :', cp.cuda.runtime.driverGetVersion())
print('device count :', cp.cuda.runtime.getDeviceCount())
print('device 0     :', cp.cuda.runtime.getDeviceProperties(0)['name'])
"
```

If this prints cleanly, your install is sound. Save the script as `scripts/check-cuda.py` in every GPU project.
