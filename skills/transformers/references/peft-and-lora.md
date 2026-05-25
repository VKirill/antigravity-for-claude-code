# PEFT — LoRA and QLoRA

`peft` is HuggingFace's parameter-efficient fine-tuning library (separate `pip install peft`). LoRA adds low-rank adapters around target linear layers, training ~0.1–1% of the original params. QLoRA = 4-bit quantized base + LoRA adapters.

## LoraConfig

```python
from peft import LoraConfig, get_peft_model

lora = LoraConfig(
    r=16,                            # rank — 8/16/32/64 typical
    lora_alpha=32,                   # scaling — often 2× r
    lora_dropout=0.05,               # 0.0–0.1
    bias="none",                     # "none" | "all" | "lora_only"
    target_modules=["q_proj", "v_proj"],   # architecture-specific
    task_type="CAUSAL_LM",           # CAUSAL_LM | SEQ_CLS | SEQ_2_SEQ_LM | TOKEN_CLS | QUESTION_ANS | FEATURE_EXTRACTION
)

peft_model = get_peft_model(base_model, lora)
peft_model.print_trainable_parameters()
# trainable params: 4,194,304 || all params: 6,738,415,616 || trainable%: 0.062
```

## `target_modules` by architecture

These are the names of `nn.Linear` modules to wrap. Check `print(model)` for exact names:

| Architecture | Common `target_modules` |
|---|---|
| Llama / Qwen / Mistral / Gemma | `["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]` (attention + MLP) |
| Llama / Qwen — attention only | `["q_proj", "v_proj"]` |
| GPT-2 | `["c_attn"]` |
| BERT / RoBERTa / DistilBERT | `["query", "key", "value"]` |
| T5 / Flan-T5 | `["q", "v"]` |
| ViT | `["query", "value"]` |
| Whisper | `["q_proj", "v_proj"]` |

Adding all attention + MLP linear layers gives the highest quality. Attention-only is faster + less VRAM.

## QLoRA recipe

The canonical "fine-tune a 7B+ LLM on one consumer GPU" recipe:

```python
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

ckpt = "meta-llama/Llama-3.1-8B-Instruct"

bnb = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
)
tok = AutoTokenizer.from_pretrained(ckpt)
tok.pad_token = tok.eos_token

base = AutoModelForCausalLM.from_pretrained(
    ckpt,
    quantization_config=bnb,
    device_map="auto",
    attn_implementation="sdpa",
)
base = prepare_model_for_kbit_training(base, use_gradient_checkpointing=True)

lora = LoraConfig(
    r=16, lora_alpha=32, lora_dropout=0.05,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                    "gate_proj", "up_proj", "down_proj"],
    task_type="CAUSAL_LM",
)
model = get_peft_model(base, lora)
model.print_trainable_parameters()
```

Then train with `Trainer` as usual — `bf16=True`, `gradient_checkpointing=True`, small per-device batch + `gradient_accumulation_steps`.

`prepare_model_for_kbit_training` does the wiring for quantized training: enables input embedding gradients, casts norm/head to fp32 for stability, sets `use_cache=False`.

## Saving and loading adapters

Adapters are tiny — checkpoints are typically 10–200 MB regardless of base size:

```python
model.save_pretrained("lora-out/")
tok.save_pretrained("lora-out/")
# Saves only adapter weights + LoraConfig — NOT the base model
```

Loading for inference (base + adapter):

```python
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

base = AutoModelForCausalLM.from_pretrained(ckpt, dtype=torch.bfloat16, device_map="auto")
model = PeftModel.from_pretrained(base, "lora-out/")
tok = AutoTokenizer.from_pretrained("lora-out/")
```

## Merging adapters

For a single deployable checkpoint (no PEFT runtime dep at inference):

```python
merged = model.merge_and_unload()   # fuses LoRA into base weights
merged.save_pretrained("merged-out/")
tok.save_pretrained("merged-out/")
```

> Merging into a 4-bit-quantized base **dequantizes** before merge — the resulting checkpoint is bf16 / fp16. To stay 4-bit, ship base + adapter separately.

## Multiple adapters

`peft` supports loading several adapters and switching between them:

```python
model = PeftModel.from_pretrained(base, "lora-task-a/", adapter_name="task_a")
model.load_adapter("lora-task-b/", adapter_name="task_b")
model.set_adapter("task_a")
# Inference with task_a
model.set_adapter("task_b")
# Inference with task_b
```

## LoRA hyperparameter cheat sheet

| Knob | Range | Effect |
|---|---|---|
| `r` (rank) | 4–64 | higher = more capacity, more VRAM; 16 is a strong default |
| `lora_alpha` | typically `2 × r` | effective scaling = alpha/r |
| `lora_dropout` | 0.0–0.1 | regularization |
| `learning_rate` | 1e-4 to 3e-4 | higher than full fine-tune (5e-5 to 2e-5) |
| `target_modules` | attention only → all linear | broader = better quality, more memory |

## When LoRA is not enough

- Need full base-model updates (e.g., changing vocabulary, language) → full fine-tune
- Need maximum quality and you have the GPUs → full fine-tune with FSDP / DeepSpeed
- Adding new modalities or major architectural changes → train from scratch or use a multimodal base

Otherwise — start with LoRA. It is rare to need more.

## Common PEFT gotchas

- `target_modules` names mismatch the architecture → silent no-op; check `print(model)`
- Forgetting `prepare_model_for_kbit_training` with bitsandbytes → gradients are zero on quantized layers
- Resuming training without `PeftModel.from_pretrained` → loads a base model, no adapter
- `merge_and_unload()` then saving — works only if base was bf16/fp16; 4-bit base dequantizes
- Setting `use_cache=True` during training → conflicts with gradient checkpointing; PEFT helper turns it off
