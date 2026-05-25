# Quantization — fit big models on small GPUs

Quantization shrinks the weight tensors (and sometimes activations) to fewer bits — typical recipe is 4-bit NF4 with bf16 compute. This unlocks 7B–13B models on a single 24 GB consumer GPU and 70B on a single A100/H100.

## When to quantize

| Goal | Recommendation |
|---|---|
| Inference on consumer GPU (RTX 3090, 4090) | 4-bit NF4 via bitsandbytes |
| QLoRA fine-tuning | 4-bit NF4 base + LoRA adapters in bf16 |
| Throughput-optimized inference server | pre-quantized GPTQ / AWQ / `quanto` |
| Maximum accuracy | skip quantization; use full bf16 |
| CPU-only / Apple Silicon | bitsandbytes unsupported; try `quanto` or pre-quantized GGUF via `llama.cpp` |

## bitsandbytes — 4-bit NF4 (QLoRA-ready)

```python
import torch
from transformers import AutoModelForCausalLM, BitsAndBytesConfig

bnb = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",                  # NF4 (4-bit NormalFloat)
    bnb_4bit_compute_dtype=torch.bfloat16,      # activations stay in bf16
    bnb_4bit_use_double_quant=True,             # also quantize the quant constants
)

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B-Instruct",
    quantization_config=bnb,
    device_map="auto",
)
```

- `quant_type="nf4"` — NormalFloat-4, the QLoRA default; better than fp4 for LLMs
- `compute_dtype=torch.bfloat16` — keep math precision high; only weights are 4-bit
- `use_double_quant=True` — saves ~0.4 bits/param extra

## bitsandbytes — 8-bit

```python
bnb8 = BitsAndBytesConfig(load_in_8bit=True)
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B-Instruct",
    quantization_config=bnb8,
    device_map="auto",
)
```

8-bit is roughly half the memory of bf16, ~2x slower than bf16, but more accurate than 4-bit. Use when accuracy matters more than VRAM.

## Memory math (rough)

For a model with N parameters:

| Precision | Bytes/param | VRAM for 7B | VRAM for 70B |
|---|---|---|---|
| fp32 | 4 | 28 GB | 280 GB |
| bf16 / fp16 | 2 | 14 GB | 140 GB |
| 8-bit | 1 | 7 GB | 70 GB |
| 4-bit NF4 | ~0.55 | ~4 GB | ~40 GB |

Add ~20% overhead for activations, KV cache, optimizer states (training only).

## GPTQ — pre-quantized inference

For models already published with GPTQ quantization:

```python
from transformers import AutoModelForCausalLM

# GPTQ weights are stored in the checkpoint; transformers auto-detects via config
model = AutoModelForCausalLM.from_pretrained(
    "TheBloke/Llama-2-7B-Chat-GPTQ",
    device_map="auto",
)
```

GPTQ requires `optimum` + `auto-gptq` or `gptqmodel` packages.

## AWQ — activation-aware quantization

```python
model = AutoModelForCausalLM.from_pretrained(
    "some-org/some-model-AWQ",
    device_map="auto",
)
```

Requires `autoawq`. AWQ typically matches bf16 perplexity within 1% on most LLMs and is faster than GPTQ on Ampere+.

## quanto — torch-native quantization

```python
from transformers import AutoModelForCausalLM, QuantoConfig

quanto_cfg = QuantoConfig(weights="int4")
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B-Instruct",
    quantization_config=quanto_cfg,
    device_map="auto",
)
```

`quanto` is HuggingFace's pure-Python/PyTorch quantization library. Works on CPU + MPS + CUDA, unlike bitsandbytes. Slower than bitsandbytes on CUDA.

## Picking a quantization method

```
                      ┌── CUDA + training → bitsandbytes NF4 + LoRA (QLoRA)
                      ├── CUDA + inference → AWQ or GPTQ if available, else bitsandbytes
Need quantization? ───┼── Apple Silicon / CPU → quanto (or llama.cpp / GGUF)
                      └── Highest throughput → AWQ + vLLM / TGI server
```

## Common pitfalls

- `bitsandbytes` installs but errors at runtime → not on CUDA; switch to `quanto`
- Loading a GPTQ checkpoint without `auto-gptq` → ImportError; install the matching backend
- Quantizing + calling `.to("cuda")` manually → conflict with `device_map`; let accelerate place the model
- Quantizing then `.half()` on the model → corrupts quantized layers
- Quantizing the model used for training without LoRA → gradients can't flow through 4-bit weights; you need adapters (see [peft-and-lora.md](peft-and-lora.md))
- Forgetting `bnb_4bit_compute_dtype=torch.bfloat16` → defaults to fp32, halving speed
