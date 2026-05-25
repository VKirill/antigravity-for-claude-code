# Setup — install, environment, authentication

## Core install

`transformers` requires a DL backend. PyTorch is the canonical choice.

```bash
# CPU-only baseline
pip install "transformers" "torch"

# CUDA (pick the cu-tag matching your driver via pytorch.org)
pip install "transformers" "torch" --index-url https://download.pytorch.org/whl/cu124

# uv equivalent
uv add transformers torch
```

## Companion packages

```bash
# Almost always:
pip install datasets accelerate

# Quantization (CUDA only):
pip install bitsandbytes

# Parameter-efficient fine-tuning:
pip install peft

# Metric computation in Trainer:
pip install evaluate

# Some tokenizers (Llama, Gemma forks):
pip install sentencepiece protobuf

# Optional: faster attention on Ampere+/Hopper
pip install flash-attn --no-build-isolation
```

## Verify the install

```python
import torch
import transformers
print("transformers", transformers.__version__)
print("torch", torch.__version__, "cuda", torch.cuda.is_available())
```

## Cache location — `HF_HOME`

By default HuggingFace caches downloads to `~/.cache/huggingface/`. Override:

```bash
export HF_HOME=/path/to/big/disk/hf_cache
# or per-resource:
export HF_DATASETS_CACHE=/path/to/datasets
export TRANSFORMERS_CACHE=/path/to/models   # legacy name, HF_HOME preferred
```

On shared servers, point `HF_HOME` to a project-owned directory so cache survives between users and CI runs.

## Authentication — `hf auth login`

Required for **gated** models (Llama, Gemma, Mistral-Instruct, Qwen-VL gated variants):

```bash
hf auth login                        # interactive — paste a User Access Token
# or via env var for CI:
export HF_TOKEN=hf_xxxxxxxxxxxxx
```

Generate a token at `https://huggingface.co/settings/tokens` with `read` scope. Accept the model's license on its Hub page once per account before downloading.

> The CLI used to be called `huggingface-cli` and that name still works; new code should prefer the shorter `hf` entry point.

## GPU sanity check

```python
import torch
assert torch.cuda.is_available(), "CUDA build of torch required"
print("device:", torch.cuda.get_device_name(0))
print("compute capability:", torch.cuda.get_device_capability(0))
# capability >= (8, 0) → bf16 native + flash-attn-2 supported
```

| Capability | Generation | bf16 | flash-attn-2 |
|---|---|---|---|
| (7, 5) | Turing — T4, RTX 2080 | emulated | no |
| (8, 0) | Ampere — A100 | native | yes |
| (8, 6) | Ampere — RTX 30-series | native | yes |
| (8, 9) | Ada — RTX 40-series | native | yes |
| (9, 0) | Hopper — H100 | native | yes |

## Minimal smoke test

```python
from transformers import pipeline

clf = pipeline("sentiment-analysis")  # downloads default model + tokenizer
print(clf("HuggingFace is great"))
# [{'label': 'POSITIVE', 'score': 0.99...}]
```

If this works, the install is healthy. If you hit `OSError: Cannot connect to huggingface.co`, set `HF_HUB_OFFLINE=1` after pre-downloading, or check proxy / VPN.

## Common install gotchas

- `bitsandbytes` requires CUDA — `pip install bitsandbytes` on a CPU-only box will install but fail at runtime
- `flash-attn` build requires CUDA toolkit headers; the `--no-build-isolation` flag is needed because the build wheel imports `torch` to read its CUDA version
- On macOS, `torch` ships with MPS; `bitsandbytes` and `flash-attn` are not supported — stick to `attn_implementation="sdpa"` and skip 4-bit
- `accelerate config` writes `~/.cache/huggingface/accelerate/default_config.yaml`; for non-interactive setups (CI) skip this and pass flags directly to `accelerate launch`
