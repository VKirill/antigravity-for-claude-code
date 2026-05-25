# Optional-dependency pattern — CUDA may or may not exist at runtime

The **differentiating artifact** of this skill. CUDA is an optional accelerator: code must run on a laptop without an NVIDIA GPU AND on a production server with eight H100s, from the same package install, with no `try`/`except` boilerplate at every call site.

## Failure modes to handle

A naive `import cupy` and call `cp.array(...)` will crash in **four different ways** depending on host state:

| Host state | What happens on naive import | What happens on naive call |
|---|---|---|
| `cupy` not installed | `ImportError: No module named 'cupy'` | — |
| `cupy` installed, no GPU | Import succeeds | `cupy.cuda.runtime.CUDARuntimeError: cudaErrorNoDevice` |
| `cupy` installed, driver too old | Import succeeds | `CUDARuntimeError: cudaErrorInsufficientDriver` |
| `cupy` installed, wrong toolkit | Import succeeds | `CUDARuntimeError: no kernel image is available for execution` |
| `cupy` installed, GPU healthy | Import succeeds | Works |

All four failures must downgrade to a CPU code path **without** the caller writing any conditional logic.

## The pattern — one module to import everywhere

Drop this file as `your_pkg/gpu.py`. It exposes:

- `xp` — module namespace (CuPy if usable, NumPy otherwise)
- `is_cuda_available()` — cheap, cached boolean
- `cuda_device_count()` — number of usable devices
- `to_cpu(arr)` — uniform device→host transfer
- `to_device(arr)` — uniform host→device transfer (no-op on CPU)
- `cuda_required` / `cuda_optional` decorators — explicit gating
- Honours `FORCE_CPU=1` and `CUDA_VISIBLE_DEVICES=""` env vars for CI

```python
"""your_pkg/gpu.py — optional CUDA dependency, graceful CPU fallback.

Import this module instead of cupy directly. Code stays portable:

    from your_pkg.gpu import xp, is_cuda_available, to_cpu

    a = xp.zeros(1024)                  # CuPy or NumPy depending on host
    b = xp.linalg.norm(a)
    result = to_cpu(b)                  # always returns a NumPy scalar

No import-time crash, no module-not-found, no driver mismatch.
"""
from __future__ import annotations

import os
import functools
import logging
from typing import Any, Callable, TypeVar

import numpy as np

_log = logging.getLogger(__name__)

T = TypeVar("T")

# ---------------------------------------------------------------------------
# Step 1 — try import (lazy and protected)
# ---------------------------------------------------------------------------

_FORCE_CPU = os.environ.get("FORCE_CPU", "").lower() in ("1", "true", "yes")
_CUDA_HIDDEN = os.environ.get("CUDA_VISIBLE_DEVICES", None) == ""

# A sentinel for "we tried to import and it failed". Distinct from None.
_NOT_LOADED = object()
_cupy_module: Any = _NOT_LOADED


def _try_import_cupy() -> Any | None:
    """Attempt import. Returns the module or None. Cached."""
    global _cupy_module
    if _cupy_module is not _NOT_LOADED:
        return _cupy_module

    if _FORCE_CPU or _CUDA_HIDDEN:
        _log.info("CUDA disabled by environment (FORCE_CPU or CUDA_VISIBLE_DEVICES='').")
        _cupy_module = None
        return None

    try:
        import cupy  # type: ignore[import-not-found]
        _cupy_module = cupy
        return cupy
    except ImportError:
        _log.info("cupy not installed; using NumPy CPU fallback.")
        _cupy_module = None
        return None
    except Exception as exc:  # pragma: no cover  # malformed install
        _log.warning("cupy import raised %s; using NumPy CPU fallback.", exc)
        _cupy_module = None
        return None


# ---------------------------------------------------------------------------
# Step 2 — runtime device detection (probe with strict timeout / catch)
# ---------------------------------------------------------------------------

_device_count_cache: int | None = None


def cuda_device_count() -> int:
    """Return the number of usable CUDA devices, or 0. Cached.

    This handles ALL the failure modes: no cupy, no driver, no device,
    insufficient driver version. The caller never has to know which.
    """
    global _device_count_cache
    if _device_count_cache is not None:
        return _device_count_cache

    cupy = _try_import_cupy()
    if cupy is None:
        _device_count_cache = 0
        return 0

    try:
        n = int(cupy.cuda.runtime.getDeviceCount())
    except Exception as exc:
        # CUDARuntimeError, cudaErrorNoDevice, cudaErrorInsufficientDriver,
        # cudaErrorUnknown — all collapse to "no usable device".
        _log.info("cupy.cuda.runtime.getDeviceCount failed (%s); CPU fallback.", exc)
        n = 0

    _device_count_cache = n
    return n


def is_cuda_available() -> bool:
    """True iff at least one device is detected and usable."""
    return cuda_device_count() > 0


# ---------------------------------------------------------------------------
# Step 3 — the unified namespace
# ---------------------------------------------------------------------------

def _resolve_xp() -> Any:
    if is_cuda_available():
        cupy = _try_import_cupy()
        assert cupy is not None  # invariant: is_cuda_available implies imported
        return cupy
    return np


# `xp` is a module-like object — pick a name your codebase prefers
# (`xp` is the convention used by the Array API consortium).
xp = _resolve_xp()


# ---------------------------------------------------------------------------
# Step 4 — transfer helpers
# ---------------------------------------------------------------------------

def to_cpu(arr: Any) -> np.ndarray:
    """Return a NumPy view/copy on host. No-op if already NumPy."""
    if isinstance(arr, np.ndarray):
        return arr
    if hasattr(arr, "get"):
        # cupy.ndarray.get() returns numpy.ndarray
        return arr.get()
    # PyTorch tensor or DLPack-compatible array
    if hasattr(arr, "cpu"):
        return arr.cpu().numpy()
    if hasattr(arr, "__dlpack__"):
        # Anything Array API standard
        return np.from_dlpack(arr)
    return np.asarray(arr)


def to_device(arr: Any) -> Any:
    """Return an xp.ndarray on the current device. No-op if already there."""
    if not is_cuda_available():
        return np.asarray(arr)
    cupy = _try_import_cupy()
    assert cupy is not None
    if isinstance(arr, cupy.ndarray):
        return arr
    return cupy.asarray(arr)


# ---------------------------------------------------------------------------
# Step 5 — gating decorators
# ---------------------------------------------------------------------------

def cuda_required(fn: Callable[..., T]) -> Callable[..., T]:
    """Raise at call time if CUDA isn't available. Use for kernels with no CPU equivalent."""
    @functools.wraps(fn)
    def wrapper(*args: Any, **kwargs: Any) -> T:
        if not is_cuda_available():
            raise RuntimeError(
                f"{fn.__qualname__} requires CUDA but no device is available "
                f"(device_count={cuda_device_count()}, FORCE_CPU={_FORCE_CPU})."
            )
        return fn(*args, **kwargs)
    return wrapper


def cuda_optional(cpu_fallback: Callable[..., T]) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """Decorator factory: dispatch to GPU impl if available, else CPU fallback.

    Usage::

        def _cpu_norm(x): return np.linalg.norm(x)

        @cuda_optional(cpu_fallback=_cpu_norm)
        def gpu_norm(x):
            return cupy.linalg.norm(x).get()
    """
    def decorator(gpu_fn: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(gpu_fn)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            if is_cuda_available():
                return gpu_fn(*args, **kwargs)
            return cpu_fallback(*args, **kwargs)
        return wrapper
    return decorator


# ---------------------------------------------------------------------------
# Step 6 — diagnostics (call once at startup)
# ---------------------------------------------------------------------------

def describe_environment() -> dict[str, Any]:
    """Return a JSON-serializable dict describing the current GPU env. For logs."""
    info: dict[str, Any] = {
        "force_cpu_env": _FORCE_CPU,
        "cuda_visible_devices_hidden": _CUDA_HIDDEN,
        "cupy_imported": _try_import_cupy() is not None,
        "device_count": cuda_device_count(),
        "xp_module": xp.__name__,
    }
    cupy = _try_import_cupy()
    if cupy is not None and is_cuda_available():
        try:
            info["runtime_version"] = cupy.cuda.runtime.runtimeGetVersion()
            info["driver_version"] = cupy.cuda.runtime.driverGetVersion()
            info["devices"] = [
                {
                    "id": i,
                    "name": cupy.cuda.runtime.getDeviceProperties(i)["name"].decode("utf-8"),
                }
                for i in range(cuda_device_count())
            ]
        except Exception as exc:  # pragma: no cover
            info["probe_error"] = repr(exc)
    return info
```

## How to use it at call sites

```python
from your_pkg.gpu import xp, is_cuda_available, to_cpu, cuda_optional
import numpy as np


# Pattern A — uniform xp namespace (works for most array ops)
def normalize(x):
    a = xp.asarray(x)
    return to_cpu(a / xp.linalg.norm(a))


# Pattern B — explicit fallback when GPU impl differs structurally
def _cpu_top_k(x: np.ndarray, k: int) -> np.ndarray:
    return np.partition(x, -k)[-k:]


@cuda_optional(cpu_fallback=_cpu_top_k)
def top_k(x, k: int):
    import cupy as cp  # safe — only runs when is_cuda_available() is True
    return cp.partition(cp.asarray(x), -k)[-k:].get()


# Pattern C — explicit guard
def render_heatmap(pts):
    if is_cuda_available():
        return _gpu_heatmap(pts)
    return _cpu_heatmap(pts)
```

## Pytest fixture — mock GPU presence for tests

Tests need to exercise both branches even on a CI runner with no GPU.

```python
# tests/conftest.py
import pytest
from unittest.mock import patch


@pytest.fixture
def force_cpu(monkeypatch):
    """Force the optional-dep module to behave as if no GPU exists."""
    monkeypatch.setenv("FORCE_CPU", "1")
    # Reset internal caches so the next import re-reads env
    import your_pkg.gpu as gpu_mod
    gpu_mod._cupy_module = gpu_mod._NOT_LOADED
    gpu_mod._device_count_cache = None
    gpu_mod.xp = gpu_mod._resolve_xp()
    yield
    gpu_mod._cupy_module = gpu_mod._NOT_LOADED
    gpu_mod._device_count_cache = None
    gpu_mod.xp = gpu_mod._resolve_xp()


@pytest.fixture
def mock_cuda_present(monkeypatch):
    """Pretend a GPU is present even when none exists. Useful for routing tests
    that don't actually execute kernels."""
    import your_pkg.gpu as gpu_mod
    monkeypatch.setattr(gpu_mod, "cuda_device_count", lambda: 1)
    yield


# Usage
def test_top_k_cpu_path(force_cpu):
    from your_pkg.algos import top_k
    import numpy as np
    out = top_k(np.array([1, 5, 2, 9, 3]), k=2)
    assert sorted(out.tolist()) == [5, 9]


def test_top_k_dispatches_to_gpu(mock_cuda_present):
    from your_pkg.algos import top_k
    # Even though no real GPU exists, the function's GPU branch is taken.
    # Use this to assert dispatch logic, not numeric correctness.
    ...
```

## Numba simulator parallel — for `@cuda.jit` tests

Numba ships a CPU simulator. Combine the simulator with the optional-dep module to test CUDA kernels in CI:

```python
# tests/conftest.py
import os
import pytest


@pytest.fixture(scope="session", autouse=True)
def enable_cuda_sim():
    """Run numba @cuda.jit kernels on the CPU via the simulator."""
    os.environ["NUMBA_ENABLE_CUDASIM"] = "1"
    yield
    os.environ.pop("NUMBA_ENABLE_CUDASIM", None)
```

This must be set **before** `numba.cuda` is imported, hence `autouse=True` at session scope. Note: `numba.cuda.is_available()` returns True under the simulator, so your test framework can exercise kernel logic without a GPU.

## pyproject.toml — declaring it optional

```toml
[project]
name = "your_pkg"
dependencies = [
    "numpy>=2.0",
]

[project.optional-dependencies]
gpu-cu12 = ["cupy-cuda12x>=13,<14"]
gpu-cu13 = ["cupy-cuda13x>=13,<14"]
test = ["pytest>=8", "numpy>=2.0"]
test-gpu = ["pytest>=8", "cupy-cuda13x>=13,<14"]
```

Users on CPU-only hosts run `pip install your_pkg`. GPU users run `pip install 'your_pkg[gpu-cu13]'`. CI runs `pip install 'your_pkg[test]'` for the CPU lane and a separate matrix job installs `[test-gpu]` only on the GPU runner.

## What this pattern is NOT

- **Not** a way to run CUDA C kernels on the CPU. The fallback path uses NumPy/SciPy operations; you write the CPU path explicitly (via the `cuda_optional` decorator or `xp` namespace).
- **Not** a substitute for `@cuda.jit` CUDASim if you wrote a custom kernel — for that case use `NUMBA_ENABLE_CUDASIM=1` as shown above.
- **Not** a performance optimization. It adds a tiny first-call cost (the device probe) and zero per-call cost (caches are read once).

## Why not just `try: import cupy; HAS_CUDA = True; except: HAS_CUDA = False`?

Because that catches only the first failure mode (no install). It happily returns `HAS_CUDA = True` on a host where cupy is installed but the driver is broken or no GPU exists — and then crashes 100ms later when you call `cupy.array(...)`. The pattern above probes the runtime, not just the import.
