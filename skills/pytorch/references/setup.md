# Install matrix

PyTorch is shipped as platform-specific wheels. Pick the right one for your accelerator. Wheel name encodes the compute platform (`cpu`, `cu126`, `cu128`, `rocm6.3`).

## Decision tree

```
Have an NVIDIA GPU?
  Yes → check `nvidia-smi`; pick CUDA wheel matching CUDA runtime (host driver supports >= wheel CUDA)
  No  → AMD GPU?
          Yes → ROCm wheel (Linux only)
          No  → macOS Apple Silicon? → default wheel (ships with MPS)
                 No → CPU wheel
```

## pip — canonical install

PyTorch publishes its own wheel index at `https://download.pytorch.org/whl/<compute>`.

```bash
# Linux/Windows CPU
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

# Linux/Windows CUDA 12.6
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126

# Linux/Windows CUDA 12.8
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128

# Linux ROCm 6.3
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/rocm6.3

# macOS (Apple Silicon and Intel) — default wheel includes MPS support
pip install torch torchvision torchaudio
```

Check available compute platforms at the official selector: <https://pytorch.org/get-started/locally/>.

## uv — modern Python project manager

`uv` understands PyTorch's index layout via `[tool.uv.sources]`. Pin in `pyproject.toml`:

```toml
[project]
dependencies = [
  "torch>=2.12,<2.13",
  "torchvision",
  "torchaudio",
]

[tool.uv.sources]
torch = { index = "pytorch-cu126" }
torchvision = { index = "pytorch-cu126" }
torchaudio = { index = "pytorch-cu126" }

[[tool.uv.index]]
name = "pytorch-cu126"
url = "https://download.pytorch.org/whl/cu126"
explicit = true
```

Then `uv sync`. The `explicit = true` keeps the index out of normal resolution and only used for the named packages.

## conda — still supported, less canonical

```bash
# CUDA 12.6
conda install pytorch torchvision torchaudio pytorch-cuda=12.6 -c pytorch -c nvidia

# CPU
conda install pytorch torchvision torchaudio cpuonly -c pytorch
```

The PyTorch team has shifted recommended install to pip. Conda channels lag pip wheels.

## Nightly vs stable

Nightly publishes daily from `main`. Useful for early access to new ops or compiler fixes. The index URL is `https://download.pytorch.org/whl/nightly/<compute>`:

```bash
pip install --pre torch torchvision torchaudio --index-url https://download.pytorch.org/whl/nightly/cu126
```

Don't use nightly for production. APIs can change without notice.

## Choosing the right CUDA combo

The CUDA in the wheel name (`cu126`) is the CUDA the wheel was built against. The host needs an NVIDIA driver that supports **at least** that CUDA. Driver-CUDA compatibility table: <https://docs.nvidia.com/cuda/cuda-toolkit-release-notes/>.

Rules of thumb:

- New driver works with old CUDA wheels (forward compatible)
- Old driver does NOT work with new CUDA wheels
- The CUDA toolkit installed on the host is **not used by the wheel** — wheels bundle their own CUDA libraries

Verify install:

```python
import torch
print(torch.__version__)
print(torch.cuda.is_available(), torch.cuda.device_count())
print(torch.version.cuda)  # CUDA version the wheel was built with
print(torch.backends.cudnn.version())
```

## Apple Silicon — MPS

macOS arm64 wheels include MPS backend automatically. No separate install. Check availability:

```python
import torch
print(torch.backends.mps.is_available())     # True on Apple Silicon
print(torch.backends.mps.is_built())         # True if wheel includes MPS
```

A handful of ops are not implemented on MPS yet. For development, set the env var before launching Python:

```bash
export PYTORCH_ENABLE_MPS_FALLBACK=1
```

This silently falls back to CPU for unsupported ops — slower but unblocks dev. Do not rely on it in production benchmarks.

## Verifying the install

```python
import torch

x = torch.randn(2, 3)
print("CPU tensor OK:", x.sum().item())

if torch.cuda.is_available():
    y = torch.randn(2, 3, device="cuda")
    print("CUDA tensor OK:", y.sum().item())
    print("GPU:", torch.cuda.get_device_name(0))

if torch.backends.mps.is_available():
    z = torch.randn(2, 3, device="mps")
    print("MPS tensor OK:", z.sum().item())
```

## Companion libraries

| Library | When |
|---|---|
| `torchvision` | image datasets, transforms, pretrained CV models |
| `torchaudio` | audio I/O, transforms, pretrained ASR models |
| `torchtext` | text utilities — note: largely deprecated, prefer HuggingFace `tokenizers`/`datasets` |
| `accelerate` (HF) | thin distributed-training launcher; nice for DDP boilerplate |
| `lightning` | training-loop framework on top of PyTorch — use if your team already has it |
