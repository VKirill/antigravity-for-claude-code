# Changelog

All notable changes to the `pytorch` skill.

## v1.0.0 — initial release

First version of the PyTorch skill, targeting modern PyTorch 2.x.

### Highlights

- Pattern 2 structure: slim SKILL.md navigator + 14 domain references
- Modern API focus: `torch.amp.autocast` (not deprecated `torch.cuda.amp.autocast`), FSDP2 `fully_shard` (not original FSDP wrapper), `torch.inference_mode` (preferred over `torch.no_grad`), `torch.export` (TorchScript noted as deprecated)
- Reflects PyTorch 2.12 release content: improved `torch.compile` (CUDA Graph control flow, `torch.accelerator.Graph` API), fused Adagrad joining Adam/AdamW/SGD, batched eigendecomposition cuSolver speedup, MX quantization in `torch.export`, FlightRecorder distributed diagnostics, Apple MPS Metal-4 ahead-of-time shader compilation, TorchScript fully deprecated
- Python 3.10–3.14 supported; recommended pin tracks the central STACK_VERSIONS.md registry

### References shipped

- `REFERENCE.md` — decision map / index
- `setup.md` — install matrix (CPU/CUDA/ROCm/MPS), pip vs uv vs conda, nightly vs stable
- `tensors.md` — tensor creation, dtypes, autograd basics, view vs reshape, detach vs clone, inference_mode
- `nn-modules.md` — Module pattern, buffer vs parameter, train/eval, common layers, init, freezing
- `training-loop.md` — full loop with AMP + accumulation + clipping + scheduler + checkpoints
- `device-and-cuda.md` — CUDA/MPS/CPU patterns, memory management, expandable segments, multi-process+CUDA
- `mixed-precision.md` — bf16 vs fp16, GradScaler, common pitfalls (.half on model), CPU/MPS autocast
- `torch-compile.md` — modes, dynamic shapes, fullgraph, graph breaks, profiling, DDP/FSDP integration
- `distributed.md` — DDP canonical pattern, torchrun launch, FSDP2 fully_shard with MixedPrecisionPolicy, env knobs
- `inference-and-export.md` — eval/inference_mode, ONNX (dynamo + legacy), torch.export, ExecuTorch pointer, serving patterns
- `datasets-and-data.md` — Dataset / IterableDataset, DataLoader knobs, collate_fn, samplers, fork+CUDA pitfall
- `troubleshooting.md` — OOM, NaN, slow loader, graph breaks, DDP hangs, in-place autograd errors
- `recommended-defaults.md` — batch size, lr, scheduler, clipping, num_workers, optimizer choice, weight decay
- `wrong-vs-right.md` — 16 paired anti-patterns with corrections
- `eval-cases.md` — routing test prompts (positive, negative, ambiguous)

### Behavioral and constraint highlights

- Always `model.eval()` and `torch.inference_mode()` for inference
- Never `.item()` in a hot loop (one sync per batch kills throughput)
- Never `.half()` the model when using autocast
- Prefer `torch.bfloat16` autocast on Ampere+ — no `GradScaler` needed
- Always check device availability; never hardcode `.cuda()`
- Always save full training state (model + optimizer + scheduler + scaler + RNG)
