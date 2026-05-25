# PyTorch Reference Index

Decision map. Open the specific file you need.

## I want to...

| Task | Open |
|---|---|
| Install PyTorch for my GPU/OS combo | [setup.md](setup.md) |
| Understand tensors, dtypes, autograd basics | [tensors.md](tensors.md) |
| Write a custom `nn.Module` | [nn-modules.md](nn-modules.md) |
| Build a standard training loop with checkpoints | [training-loop.md](training-loop.md) |
| Make code work on CUDA / MPS / CPU | [device-and-cuda.md](device-and-cuda.md) |
| Speed up training with bf16/fp16 | [mixed-precision.md](mixed-precision.md) |
| Compile a model with `torch.compile` | [torch-compile.md](torch-compile.md) |
| Run multi-GPU or multi-node training | [distributed.md](distributed.md) |
| Deploy a trained model for inference | [inference-and-export.md](inference-and-export.md) |
| Set up `Dataset` / `DataLoader` | [datasets-and-data.md](datasets-and-data.md) |
| Diagnose OOM / NaN / slow training | [troubleshooting.md](troubleshooting.md) |
| Pick defaults for batch size / clipping / lr / workers | [recommended-defaults.md](recommended-defaults.md) |
| See common mistakes and their corrections | [wrong-vs-right.md](wrong-vs-right.md) |
| Verify skill routing | [eval-cases.md](eval-cases.md) |

## Reading order for new projects

1. `setup.md` → install
2. `tensors.md` + `nn-modules.md` → model code
3. `datasets-and-data.md` → input pipeline
4. `training-loop.md` → wire it together
5. `device-and-cuda.md` + `mixed-precision.md` → make it fast
6. `torch-compile.md` → if throughput still matters
7. `distributed.md` → if one GPU isn't enough
8. `inference-and-export.md` → ship it

## High-leverage gotchas

If you only read one file: [troubleshooting.md](troubleshooting.md) catches 80% of real-world failures (OOM, NaN, slow loader, fork+CUDA, `.item()` in loop).
