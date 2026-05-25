---
name: pytorch
description: "PyTorch deep learning framework — tensor compute, autograd, nn.Module training loops, DataLoader, mixed precision (torch.amp), torch.compile, GPU/MPS device handling, distributed (DDP/FSDP2), TorchScript/ONNX export. Use when: pytorch, torch, deep learning, nn.Module, autograd, requires_grad, DataLoader, Dataset, optimizer, training loop, torch.cuda, MPS, Apple Silicon, mixed precision, autocast, GradScaler, bfloat16, torch.compile, fullgraph, DDP, DistributedDataParallel, torchrun, FSDP, fully_shard, TorchScript, ONNX, GPU training, tensor, .to(device), .cuda(), CUDA OOM, NaN loss. SKIP: classical ML (→scikit-learn), GPU compute without DL (→cuda-python), tabular data prep (→pandas/polars), serving APIs (→fastapi)."
stacks:
  - pytorch
  - python
tags:
  - pytorch
  - deep-learning
  - gpu
  - ml
  - training
  - inference
packages:
  - torch
  - torchvision
  - torchaudio
manifests:
  - pyproject.toml
  - requirements.txt
source: vechkasov-global-skills
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- PyTorch: `2.12.x`
- Python: `3.14.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Use this skill when

- Training neural networks (CNNs, transformers, MLPs) from scratch or fine-tuning pretrained models
- Writing custom `nn.Module` layers, losses, or model heads
- Building training loops with `DataLoader`, optimizer step, lr schedulers, checkpoints
- Optimizing throughput with mixed precision (`torch.amp.autocast` + `GradScaler`) or `torch.compile`
- Distributed training with `DistributedDataParallel` or FSDP2 (`fully_shard`)
- Running inference on GPU/CPU/MPS, exporting to ONNX or `torch.export`
- Debugging CUDA OOM, NaN losses, slow `DataLoader`, autograd errors

## Do not use this skill when

- Classical (non-DL) ML — use `scikit-learn` instead
- Raw GPU compute without neural-net structure — use `cuda-python` instead
- Tabular feature engineering and EDA — use `pandas` / `polars`
- Serving a trained model behind an HTTP API — use `fastapi` (PyTorch handles the model; serving is separate)
- Authoring an LLM pipeline with HuggingFace abstractions — use the `transformers` skill cascade (when present)
- Native CUDA C++ kernels — out of scope; use `cuda-python` or write a custom extension

## Purpose

PyTorch is the dominant research-to-production deep learning framework. It exposes a NumPy-like tensor library with a tape-based autograd engine, an extensible `nn.Module` system, eager execution by default, and JIT compilation through `torch.compile`. Production codebases use it for training (single-GPU, multi-GPU DDP, multi-node FSDP), fine-tuning, and inference across CUDA, ROCm, CPU, and Apple Metal (MPS).

This skill codifies the patterns that actually matter in real training jobs: device-agnostic code, mixed precision without NaNs, gradient accumulation, checkpointing, `torch.compile` with sensible fallbacks, and the operational gotchas (`.item()` in hot loops, forgotten `model.eval()`, leaked autograd graph, OOM on the third epoch). It is opinionated toward modern PyTorch 2.x — `torch.amp.autocast` over the deprecated `torch.cuda.amp.autocast`, `fully_shard` (FSDP2) over the original FSDP wrapper, `torch.inference_mode()` over `torch.no_grad()` for pure inference, and `torch.export` over TorchScript.

## Capabilities

### Install and environment

Choose the right wheel for the right accelerator. CPU wheels work everywhere; CUDA wheels require the right driver; ROCm wheels are AMD-only; macOS ships with MPS support in the default wheel. Pip from `download.pytorch.org/whl/<compute>` is the canonical install path. See [references/setup.md](references/setup.md).

### Tensor and autograd basics

`torch.Tensor` is the core type. Operations build an autograd graph when any input has `requires_grad=True`. `.backward()` populates `.grad`; `.detach()` snips the graph; `.clone()` copies the tensor and keeps gradients flowing. View ops (`.view`, `.reshape`, `.permute`) share storage — be careful with in-place mutations that can corrupt the backward pass. See [references/tensors.md](references/tensors.md).

### nn.Module and model construction

Subclass `nn.Module`, register children as attributes (auto-tracked), use `register_buffer` for non-trainable state (BN running mean, position tables) and `register_parameter` for trainable. Toggle `model.train()` / `model.eval()` to control dropout and batchnorm behavior. See [references/nn-modules.md](references/nn-modules.md).

### Training loop boilerplate

The loop is: `zero_grad → forward → loss → backward → step → scheduler.step`. Add gradient accumulation by skipping `zero_grad` and dividing loss by accumulation steps. Add gradient clipping with `torch.nn.utils.clip_grad_norm_`. Checkpoint `model.state_dict()`, `optimizer.state_dict()`, `scaler.state_dict()`, and epoch/step counters together. See [references/training-loop.md](references/training-loop.md).

### Device handling: CUDA, MPS, CPU

Write device-agnostic code with a single `device` variable selected from `torch.cuda.is_available()` / `torch.backends.mps.is_available()`. Move model and data with `.to(device)` once (not per batch). Apple Silicon MPS supports most ops but a few fall back to CPU — set `PYTORCH_ENABLE_MPS_FALLBACK=1` during development. See [references/device-and-cuda.md](references/device-and-cuda.md).

### Mixed precision (AMP)

Use `torch.amp.autocast(device_type="cuda", dtype=torch.bfloat16)` on Ampere+ / Hopper GPUs — bf16 has no scaling requirement and rarely produces NaNs. For older GPUs, use `dtype=torch.float16` with `torch.amp.GradScaler`. Never call `.half()` on the model when using autocast. See [references/mixed-precision.md](references/mixed-precision.md).

### torch.compile

`torch.compile(model)` JIT-traces with TorchDynamo and lowers to Inductor. Sensible defaults: `mode="default"` for most cases, `mode="reduce-overhead"` for small models with stable shapes, `mode="max-autotune"` for long-running training. Use `dynamic=True` to avoid recompilation on shape changes; `fullgraph=True` to fail loudly on graph breaks during debugging. See [references/torch-compile.md](references/torch-compile.md).

### Distributed training

`DistributedDataParallel` for multi-GPU same-host or multi-node. Launch with `torchrun --nproc_per_node=N`. For models that don't fit on one GPU, use FSDP2's `fully_shard(model, mesh=...)` to shard parameters/grads/optimizer state. Initialize the process group, wrap the model, use `DistributedSampler` on the dataloader. See [references/distributed.md](references/distributed.md).

### Inference and export

Always `model.eval()` and wrap inference in `torch.inference_mode()` (faster than `no_grad`). For deployment, export with `torch.export` (modern) or ONNX (`torch.onnx.export` / `torch.onnx.dynamo_export`). TorchScript is deprecated — don't start new projects with it. See [references/inference-and-export.md](references/inference-and-export.md).

### Datasets and data loading

`Dataset` for random-access; `IterableDataset` for streaming/large data. `DataLoader` with `num_workers > 0`, `pin_memory=True` (CUDA only), `persistent_workers=True` to avoid re-spawning each epoch, `prefetch_factor=2..4`. Provide `collate_fn` for variable-length batches. See [references/datasets-and-data.md](references/datasets-and-data.md).

### Troubleshooting

CUDA OOM → reduce batch, enable gradient accumulation, use `torch.cuda.empty_cache()` between phases, check for tensor leaks via cached graph. NaN loss → check learning rate, mixed-precision scaler, division by zero, exploding gradients (clip them). Slow `DataLoader` → bump `num_workers`, pin memory, profile with `torch.profiler`. See [references/troubleshooting.md](references/troubleshooting.md).

## Behavioral Traits

- Always call `model.eval()` before inference; switch back to `model.train()` before training resumes
- Always wrap inference in `torch.inference_mode()` (not `torch.no_grad()`) for new code
- Always check `torch.cuda.is_available()` / `torch.backends.mps.is_available()` before assuming a device — never hardcode `.cuda()`
- Always normalize the loss by accumulation steps when doing gradient accumulation
- Always pair `optimizer.zero_grad()` with each logical step (or `set_to_none=True` for marginal speedup)
- Always `.to(device, non_blocking=True)` with `pin_memory=True` on the loader for overlap
- Prefer `torch.amp.autocast(device_type=..., dtype=torch.bfloat16)` over fp16+GradScaler on Ampere/Hopper
- Save the full training state (`model`, `optimizer`, `scaler`, `scheduler`, `epoch`, `step`, `rng`) — not just weights
- When using `DataLoader` workers, set `persistent_workers=True` to skip re-spawn cost each epoch
- When debugging `torch.compile`, run once with `fullgraph=True` to surface graph breaks; relax in production
- In DDP, only rank 0 writes checkpoints, prints, and runs validation; use `dist.barrier()` to sync

## Important Constraints

- NEVER call `.item()`, `.cpu()`, or `.numpy()` inside a tight training loop — they force a CUDA sync and stall the GPU. Accumulate on-device and convert once per epoch.
- NEVER skip `optimizer.zero_grad()` (or `set_to_none=True`) — gradients accumulate by default and silently corrupt training
- NEVER mix tensors on different devices in one op — produces `RuntimeError: Expected all tensors to be on the same device`
- NEVER call `.detach()` on a tensor that is needed for the backward pass — the gradient flow is cut and you'll see zero/missing grads
- NEVER mutate a tensor in-place if it is part of the autograd graph (`x.add_(1)` is fine only if `x` is a leaf with no graph dependency or if it has no `requires_grad`)
- NEVER call `.half()` or `.bfloat16()` on the model when using `torch.amp.autocast` — autocast handles the casting internally
- NEVER pass `num_workers > 0` to `DataLoader` from a CUDA-using process started with `fork` on Linux — initialize CUDA after fork, or use `spawn`/`forkserver` start method
- NEVER mutate the model between `torch.compile` and inference if you expect the compiled graph to remain valid — recompilation costs are real
- ALWAYS guard `if __name__ == "__main__":` in training scripts on Windows / macOS spawn — multiprocessing in `DataLoader` needs it
- ALWAYS seed `torch.manual_seed`, `torch.cuda.manual_seed_all`, `numpy.random.seed`, and `random.seed` together for reproducibility

## Related Skills

### Parent
- `python` — language baseline (this skill assumes Python 3.11+ comfort)

### Sibling — GPU and numeric stack
- `cuda-python` — raw GPU compute, custom CUDA kernels, no neural-net structure

### Data prep upstream
- `pandas` — tabular feature engineering before tensor conversion
- `polars` — high-perf alternative to pandas for large frames
- `scikit-learn` — classical ML and preprocessing utilities (pipelines, scalers, splits)

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Index, decision map, when-to-use which doc | [references/REFERENCE.md](references/REFERENCE.md) |
| Install matrix: CPU/CUDA/ROCm/MPS, pip vs conda vs uv, nightly vs stable | [references/setup.md](references/setup.md) |
| Tensor creation, dtypes, device placement, autograd, view vs reshape, detach/clone | [references/tensors.md](references/tensors.md) |
| `nn.Module` pattern, buffer vs parameter, train/eval, common layers, custom layer pattern | [references/nn-modules.md](references/nn-modules.md) |
| Training loop boilerplate, gradient accumulation/clipping, schedulers, checkpoints | [references/training-loop.md](references/training-loop.md) |
| Device-agnostic code, CUDA/MPS/CPU, multi-GPU, CUDA memory management | [references/device-and-cuda.md](references/device-and-cuda.md) |
| Mixed precision: `torch.amp.autocast`, `GradScaler`, bf16 vs fp16, pitfalls | [references/mixed-precision.md](references/mixed-precision.md) |
| `torch.compile` — modes, dynamic shapes, `fullgraph`, graph breaks, profiling | [references/torch-compile.md](references/torch-compile.md) |
| Distributed: DDP, `torchrun`, FSDP2 (`fully_shard`), multi-node patterns | [references/distributed.md](references/distributed.md) |
| Inference: `model.eval()`, `inference_mode`, ONNX, `torch.export`, serving | [references/inference-and-export.md](references/inference-and-export.md) |
| `Dataset` / `IterableDataset` / `DataLoader`: workers, prefetch, collate, samplers | [references/datasets-and-data.md](references/datasets-and-data.md) |
| Troubleshooting: CUDA OOM, NaN loss, slow loader, compile graph breaks, fork+CUDA | [references/troubleshooting.md](references/troubleshooting.md) |
| Recommended defaults: batch size, clipping, lr scheduler, num_workers heuristic | [references/recommended-defaults.md](references/recommended-defaults.md) |
| Wrong vs right code pairs — common training-loop anti-patterns and their fixes | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases — routing prompts to verify this skill loads on the right tasks | [references/eval-cases.md](references/eval-cases.md) |

**How to use**: open the specific topic file. Don't read all references — load only what the active task needs.
