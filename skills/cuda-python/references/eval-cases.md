# Eval cases — routing tests for the cuda-python skill

Routing tests check that this skill loads for prompts that genuinely need it, and stays out of prompts that don't. Used during skill maintenance to catch description-drift.

## Positive prompts — should load this skill

1. "How do I make my NumPy code run on GPU?"
2. "My library should optionally use CUDA — how do I detect at runtime?"
3. "What's the difference between CuPy, Numba @cuda.jit, and PyCUDA?"
4. "How do I write a `@cuda.jit` kernel that runs in CI without a GPU?"
5. "torch.cuda.is_available() returns False on my server even though nvidia-smi shows a GPU"
6. "I'm getting 'no kernel image is available for execution on the device' — what's wrong?"
7. "How do I install CuPy alongside PyTorch without breaking either?"
8. "How do I write a custom CUDA kernel and call it from Python?"
9. "What's `cuda.bindings.driver` vs `cuda.bindings.runtime`?"
10. "Why is my first `cp.array()` call so slow?"
11. "How do I free GPU memory cached by CuPy?"
12. "I want to share data between CuPy and PyTorch without copying"
13. "My script OOMs but nvidia-smi shows plenty of free memory"
14. "Set up a Docker container with CUDA Python support"
15. "Multi-GPU vector add example"
16. "How do I detect CUDA without importing cupy?"
17. "What's the right way to write a function that uses GPU if available, CPU otherwise?"
18. "Numba simulator vs real GPU — what's different?"
19. "I'm hitting `cudaErrorIllegalAddress` — how do I find which kernel?"
20. "Fork-related CUDA errors in my multiprocessing code"

## Negative prompts — should NOT load this skill

1. "How do I train a transformer in PyTorch?" → `pytorch`
2. "DataLoader with multiple workers" → `pytorch`
3. "How do I write a fast aggregation in Polars?" → `polars`
4. "Speed up a pandas groupby" → `pandas`
5. "Set up CUDA drivers on Ubuntu 24.04" → `linux-sysadmin`
6. "Provision an A100 instance on AWS" → out of scope (no current skill)
7. "What's a generator expression in Python 3.14?" → `python`
8. "Train a sklearn RandomForest on tabular data" → `scikit-learn`
9. "Fine-tune a Llama model" → `pytorch`
10. "How does CUDA work in a Cloudflare Worker?" → out of scope (no GPU on edge)

## Edge cases — should the skill load? Defensible decision

1. "torch.cuda.is_available() returns False" — **load this skill** for environment diagnostics (it owns the env layer)
2. "PyTorch CUDA OOM during training" — **load pytorch first**, but cascade here for memory-management techniques
3. "How do I use cuDF?" — **don't load**; RAPIDS cuDF is a sibling library, separate skill needed
4. "Can I use CuPy on AMD GPUs?" — **load this skill**, but answer is "experimental ROCm, out of scope"
5. "Build a custom CUDA C extension for PyTorch" — **load pytorch first**; cascade here for NVRTC pattern

## Suggested test harness

```python
# scripts/eval-cuda-python-routing.py
import json
from pathlib import Path

POSITIVE = [...]    # the 20 prompts above
NEGATIVE = [...]
EDGE = [...]

def run_routing_test():
    # Use Claude's skill-loading mechanism to check which skill loads per prompt
    for prompt in POSITIVE:
        loaded = check_loaded_skills(prompt)
        assert "cuda-python" in loaded, f"Should load for: {prompt}"
    for prompt in NEGATIVE:
        loaded = check_loaded_skills(prompt)
        assert "cuda-python" not in loaded, f"Should NOT load for: {prompt}"
```

## When to update this file

- New CUDA library appears (cudf, cugraph, RAPIDS extensions) — add edge cases for cascade routing
- A confusing user prompt routes wrong in practice — copy it into the positive or negative list
- A sibling skill (`pytorch`, `pandas`) gets a new trigger that overlaps — add anti-trigger here

## Quality bar

- Positive list ≥ 15 prompts; negative ≥ 8; edge ≥ 3
- Update after every routing-related description edit
- Run before tagging a new skill version
