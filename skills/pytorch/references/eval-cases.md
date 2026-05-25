# Eval cases — skill routing tests

Prompts to verify this skill loads when it should and doesn't load when it shouldn't.

## Should load (positive cases)

These prompts should trigger the `pytorch` skill:

1. "Write a training loop in PyTorch for a small ResNet on CIFAR-10."
2. "I'm getting CUDA out of memory at epoch 3 of training. How do I diagnose?"
3. "What's the difference between `torch.no_grad()` and `torch.inference_mode()`?"
4. "How do I use mixed precision with `torch.amp.autocast`?"
5. "My DataLoader is slow on Linux. Best practices?"
6. "Set up DDP training on 4 GPUs with torchrun."
7. "Compile a transformer with `torch.compile` and avoid graph breaks."
8. "How do I export a PyTorch model to ONNX with dynamic batch dim?"
9. "Write a custom `nn.Module` with a buffer for running statistics."
10. "What's the right way to do gradient accumulation in PyTorch?"
11. "Loss is NaN after a few steps. fp16 with GradScaler. How do I fix?"
12. "MPS on Mac M3 — how do I run a model on Apple Silicon GPU?"
13. "FSDP2 fully_shard example for a 7B-parameter model."
14. "Why is `.item()` inside a training loop bad?"
15. "Properly save and resume a PyTorch training run."

## Should NOT load (negative cases — disambiguation)

These prompts should route to other skills, not pytorch:

1. "Train a random forest on this CSV." → `scikit-learn` (cascade)
2. "Pandas: group by column, aggregate sum." → `pandas`
3. "CuPy: matrix multiply on GPU." → `cuda-python`
4. "Write a custom CUDA kernel for a fused operation." → `cuda-python`
5. "FastAPI endpoint that calls my model and returns JSON." → `fastapi` (cascade) — model code may use pytorch, but the endpoint structure is fastapi's job
6. "Polars: filter rows lazily on a large parquet." → `polars`
7. "Train a logistic regression with sklearn." → `scikit-learn` (cascade)
8. "How do I install CUDA toolkit?" → `linux-sysadmin` or `cuda-python`

## Ambiguous — should load pytorch if the prompt mentions both

- "Wrap a PyTorch model in FastAPI." → both (pytorch for model loading/inference patterns; fastapi for the endpoint). Pytorch should still load for the inference idioms (`model.eval()`, `inference_mode`, batching).
- "Load a parquet with polars and convert to tensors." → pytorch handles tensor side, polars handles the read. Both relevant.

## Trigger terms that should match

This skill's description includes:

- Direct API names: `nn.Module`, `autograd`, `DataLoader`, `optimizer`, `torch.cuda`, `torch.amp`, `torch.compile`, `DDP`, `DistributedDataParallel`, `FSDP`, `fully_shard`, `GradScaler`, `bfloat16`, `inference_mode`, `model.eval()`, `requires_grad`, `.to(device)`, `.cuda()`
- Concepts: deep learning, training loop, mixed precision, GPU training, MPS, Apple Silicon
- Failure modes: CUDA OOM, NaN loss
- Library names: pytorch, torch
- Export formats: TorchScript (deprecated mention), ONNX

Any prompt mentioning one of these should consider loading this skill.

## Anti-trigger terms (SKIP rules)

The description's `SKIP:` clause routes away from pytorch when the user asks about:

- Classical ML (no neural nets) → scikit-learn
- GPU compute without DL structure → cuda-python
- Tabular data prep alone → pandas / polars
- Pure serving APIs → fastapi

## How to evaluate this skill manually

1. Pick 5 positive prompts; run them; confirm pytorch loads
2. Pick 3 negative prompts; run them; confirm pytorch does NOT load (other skill takes over)
3. Pick 2 ambiguous prompts; check that pytorch loads alongside the other relevant skill

If a positive case doesn't trigger, the description is missing a key term. Add it. If a negative case incorrectly triggers pytorch, add an explicit SKIP rule.
