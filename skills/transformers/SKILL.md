---
name: transformers
description: "HuggingFace Transformers — pretrained model hub, pipelines, AutoModel/AutoTokenizer, .generate() for LLMs/VLMs, Trainer fine-tuning, PEFT/LoRA/QLoRA, bitsandbytes quantization, multimodal processors, datasets library, accelerate. Use when: transformers, huggingface, hf, hub, AutoTokenizer, AutoModel, AutoModelForCausalLM, AutoModelForSequenceClassification, AutoProcessor, pipeline, text-generation, image-text-to-text, automatic-speech-recognition, .generate, max_new_tokens, GenerationConfig, TextIteratorStreamer, apply_chat_template, fine-tuning, Trainer, TrainingArguments, eval_strategy, peft, LoraConfig, lora, qlora, bitsandbytes, BitsAndBytesConfig, 4-bit, 8-bit, sdpa, flash_attention_2, datasets library, load_dataset, accelerate, push_to_hub, hf-cli. SKIP: classical ML (→scikit-learn), raw PyTorch training without HF (→pytorch), LangChain orchestration (→langchain), serving-only TGI/vLLM deployment (use referenced links), GPU compute without DL (→cuda-python)."
stacks:
  - transformers
  - pytorch
  - python
tags:
  - ai
  - llm
  - huggingface
  - deep-learning
  - nlp
  - multimodal
packages:
  - transformers
  - datasets
  - accelerate
  - peft
  - bitsandbytes
manifests:
  - pyproject.toml
  - requirements.txt
source: vechkasov-global-skills
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Transformers (HF): `5.x`
- PyTorch: `2.12.x`
- Python: `3.14.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->


<!-- versions:placeholder — populated by sync_skill_versions.py -->

## Use this skill when

- Loading a pretrained model from the HuggingFace Hub via `AutoModelFor*` + `AutoTokenizer` / `AutoProcessor`
- Running quick inference with `pipeline("task-name", model=..., device_map="auto")` for text, vision, audio, or multimodal
- Generating text or chat completions with `model.generate(...)` — sampling, beam search, streaming
- Applying chat templates to messages via `tokenizer.apply_chat_template(...)` before generation
- Fine-tuning a model with `Trainer` + `TrainingArguments`, optionally with `push_to_hub=True`
- Parameter-efficient fine-tuning via `peft.LoraConfig` + `get_peft_model`, including the QLoRA recipe
- Quantizing models for memory savings with `BitsAndBytesConfig` (4-bit NF4 / 8-bit)
- Selecting attention kernels — `attn_implementation="sdpa"` / `"flash_attention_2"` / `"eager"`
- Working with the `datasets` library — `load_dataset`, `.map()` for tokenization, streaming, push to hub
- Building a minimal inference server around an HF model (FastAPI + streaming) before reaching for TGI / vLLM

## Do not use this skill when

- Writing custom PyTorch training loops without HF abstractions — use the `pytorch` skill
- Classical (non-DL) ML or tabular pipelines — use `scikit-learn`
- LLM application orchestration (chains, agents, retrievers) — use `langchain`
- Pure GPU kernel / numeric compute without neural-net structure — use `cuda-python`
- Production deployment of LLMs at high throughput — TGI / vLLM / SGLang are dedicated servers; this skill covers the model side, not serving infra
- Provider-API code (`openai`, `anthropic`) that doesn't import `transformers` — use the relevant SDK skill instead

## Purpose

HuggingFace Transformers is the model-definition framework for state-of-the-art text, vision, audio, and multimodal models. It exposes a unified `from_pretrained` loading API, the `pipeline()` quick-inference helper, `AutoModelFor*` task heads, `Trainer` for fine-tuning, and `generate()` for autoregressive decoding. Over a million model checkpoints on the Hub use the Transformers model definition, which downstream frameworks (vLLM, TGI, SGLang, Axolotl, Unsloth, DeepSpeed, FSDP, llama.cpp, mlx) read directly.

This skill codifies the patterns that matter for HF in production: device-aware loading (`device_map="auto"`, `dtype="auto"`), attention-kernel selection (`sdpa` default, `flash_attention_2` on supported GPUs), generation hygiene (`max_new_tokens`, `padding_side="left"` for batch generation, `eos_token_id`, streaming via `TextIteratorStreamer`), quantization recipes (bitsandbytes 4-bit NF4 + double-quant for QLoRA), PEFT/LoRA wiring with `target_modules` matched to the architecture, and `Trainer` configuration with the v5 names (`eval_strategy`, not `evaluation_strategy`; `processing_class=tokenizer`, not the legacy `tokenizer=` keyword).

## Capabilities

### Install and environment

Install `transformers` plus a backend (`torch` is canonical) and optional companions: `datasets` for data loading, `accelerate` for multi-GPU and quantization plumbing, `peft` for LoRA, `bitsandbytes` for 4/8-bit quantization on CUDA. Configure `HF_HOME` to control cache location; `hf` CLI (`hf auth login`) authenticates for gated models like Llama and Gemma. See [references/setup.md](references/setup.md).

### Pipelines — quick inference

`pipeline("task-name", model=..., device_map="auto", dtype="auto")` is the fastest path from checkpoint to predictions. Task names cover `text-generation`, `text-classification`, `token-classification` (NER), `summarization`, `translation`, `image-classification`, `audio-classification`, `automatic-speech-recognition`, `image-text-to-text`, and many more. Pipelines accept batches as lists and support `batch_size` for throughput. See [references/pipelines.md](references/pipelines.md).

### Tokenizers and chat templates

`AutoTokenizer.from_pretrained(...)` loads the matching tokenizer. Fast tokenizers (Rust-backed) are default; pass `use_fast=False` only if you need a Python-pure tokenizer. For batched encoding, pass `padding=True, truncation=True, max_length=...`. For chat models, `tokenizer.apply_chat_template(messages, add_generation_prompt=True, return_tensors="pt")` is the canonical way to build the prompt — never hand-format role tokens. See [references/tokenizers.md](references/tokenizers.md).

### Models — AutoModel families

`AutoModelForCausalLM` for LLMs, `AutoModelForSequenceClassification` for text classification, `AutoModelForTokenClassification` for NER, `AutoModelForSeq2SeqLM` for encoder-decoder (T5, BART), `AutoModelForSpeechSeq2Seq` for Whisper, `AutoModelForImageTextToText` for VLMs. Load with `dtype=torch.bfloat16` (or `"auto"`), `device_map="auto"`, `attn_implementation="sdpa"`. See [references/models.md](references/models.md).

### Generation — `.generate()` API

The decoding entry point. Key kwargs: `max_new_tokens` (always set — `max_length` includes prompt), `do_sample`, `temperature`, `top_p`, `top_k`, `repetition_penalty`, `num_beams`, `eos_token_id`, `pad_token_id`. Wrap reusable configs in `GenerationConfig`. For batch generation set `tokenizer.padding_side = "left"`. Stream tokens with `TextIteratorStreamer` running `model.generate` on a background thread. See [references/generation.md](references/generation.md).

### Quantization

`BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.bfloat16, bnb_4bit_use_double_quant=True)` is the QLoRA-ready recipe. Pass via `from_pretrained(..., quantization_config=...)`. GPTQ, AWQ, and quanto are alternatives for inference-only deployment. See [references/quantization.md](references/quantization.md).

### Fine-tuning with Trainer

`Trainer(model, args, train_dataset, eval_dataset, processing_class=tokenizer, data_collator=..., compute_metrics=...)` runs the whole loop. `TrainingArguments` keys you will set: `output_dir`, `per_device_train_batch_size`, `gradient_accumulation_steps`, `learning_rate`, `num_train_epochs`, `eval_strategy`, `save_strategy`, `logging_steps`, `bf16=True`, `gradient_checkpointing=True`, `push_to_hub=True`. Distributed via `fsdp="full_shard"` or `deepspeed="ds_config.json"`. See [references/fine-tuning-trainer.md](references/fine-tuning-trainer.md).

### PEFT — LoRA and QLoRA

`peft` is a separate package. `LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, target_modules=["q_proj","v_proj"], task_type="CAUSAL_LM")` + `get_peft_model(base_model, config)` returns a wrapped model with ~1% trainable params. QLoRA = bitsandbytes 4-bit base + LoRA adapters on top. After training, `merge_and_unload()` produces a single deployable checkpoint. See [references/peft-and-lora.md](references/peft-and-lora.md).

### Datasets

`from datasets import load_dataset; ds = load_dataset("squad")`. Tokenize via `ds.map(tokenize_fn, batched=True, remove_columns=...)`. Use `streaming=True` for datasets larger than disk. `train_test_split`, `filter`, `select`, `shuffle`, and `push_to_hub` round out the surface. See [references/datasets.md](references/datasets.md).

### Multimodal — vision and audio

Image-text models (LLaVA, Idefics3, Qwen-VL, InternVL) use `AutoProcessor` for unified text+image preprocessing and `AutoModelForImageTextToText` for inference. Pass images as PIL, URL, or local path inside the chat message structure. Audio: Whisper via `automatic-speech-recognition` pipeline, or `AutoModelForSpeechSeq2Seq` + `AutoProcessor` for finer control. See [references/multimodal.md](references/multimodal.md).

### Inference servers

For high-throughput LLM serving, TGI (HuggingFace) and vLLM are the standard choices — both read Transformers model definitions. For a minimal in-process server, wire `AutoModelForCausalLM` behind FastAPI with `StreamingResponse` and `TextIteratorStreamer`. See [references/inference-server.md](references/inference-server.md).

### Troubleshooting

CUDA OOM during `.generate()` — reduce batch, quantize to 4-bit, ensure `use_cache=True`, drop `attn_implementation` from `eager` to `sdpa`. Tokenizer padding error — set `tokenizer.pad_token = tokenizer.eos_token`. Slow generation — switch to `sdpa` or `flash_attention_2`. Gated-model 403 — `hf auth login` and accept terms. `trust_remote_code=True` warning — only enable for checkpoints you trust. See [references/troubleshooting.md](references/troubleshooting.md).

## Behavioral Traits

- Always load model and tokenizer from the **same checkpoint string** in the same code block — mismatched vocab silently produces garbage
- Always set `max_new_tokens` on `.generate()` calls — never rely on `max_length` (which includes prompt) for new code
- Always call `tokenizer.apply_chat_template(messages, add_generation_prompt=True, ...)` for chat-tuned models — never concatenate role tokens manually
- Always set `tokenizer.padding_side = "left"` before batched generation; decoder-only models attend right-to-left, right-padding corrupts output
- Always pass `device_map="auto"` and `dtype="auto"` (or an explicit `torch.bfloat16`) on first load — let accelerate place tensors
- Prefer `attn_implementation="sdpa"` as the safe default; opt into `"flash_attention_2"` only on Ampere/Hopper with the package installed
- Prefer `eval_strategy="steps"` with a small `eval_steps` for long runs so you see loss curves early
- Prefer LoRA over full fine-tune when target task fits — orders of magnitude less VRAM, comparable quality
- When debugging generation, run once with `do_sample=False` (greedy) — sampling masks systematic prompt-format bugs
- When training is OOM, the first knob is `gradient_accumulation_steps`, second is `gradient_checkpointing=True`, third is quantization + LoRA
- In Trainer code, pass the tokenizer/processor as `processing_class=...` — the legacy `tokenizer=` keyword still works but is deprecated

## Important Constraints

- NEVER pad on the right when generating with a decoder-only LLM — set `tokenizer.padding_side = "left"`
- NEVER call `.generate()` inside an autograd context — wrap in `torch.inference_mode()` or `torch.no_grad()` to avoid leaking the graph
- NEVER mix the model's dtype with manual `.half()` / `.bfloat16()` calls when `dtype=...` and `device_map="auto"` are already set — accelerate already placed and cast the modules
- NEVER pass `trust_remote_code=True` to a checkpoint you do not control or have not audited — it executes arbitrary Python on import
- NEVER use `max_length` to bound new tokens — it includes the prompt; use `max_new_tokens`
- NEVER assume the tokenizer has a `pad_token` — many causal LMs ship without one; set `tokenizer.pad_token = tokenizer.eos_token` before batching
- NEVER use the legacy `torch_dtype=` kwarg in new code — the supported keyword in current Transformers is `dtype=`
- NEVER use the legacy `evaluation_strategy=` kwarg in `TrainingArguments` — it is `eval_strategy=`
- NEVER full-fine-tune a 7B+ model on a single consumer GPU — use QLoRA (4-bit base + LoRA adapters) instead
- ALWAYS log in with `hf auth login` before loading gated checkpoints (Llama, Gemma, Mistral-Instruct) or pre-fetch them in CI with `HF_TOKEN`
- ALWAYS save the tokenizer alongside the model when checkpointing — `tokenizer.save_pretrained(out_dir)` next to `model.save_pretrained(out_dir)`

## Related Skills

### Parent
- `python` — language baseline (this skill assumes Python 3.11+ comfort with type hints and venv)

### Foundation
- `pytorch` — DL backend; Transformers is built on top of `torch.nn.Module` and reuses tensor / autograd / AMP primitives

### GPU environment
- `cuda-python` — CUDA driver/runtime, device detection, GPU/CPU fallback patterns referenced when configuring `bitsandbytes` and `flash_attention_2`

### Adjacent
- `pydantic` — typed structured outputs from LLM generations; pair with `apply_chat_template` and a JSON-schema-constrained decoder
- `pytest` — unit tests for tokenization, prompt construction, and generation determinism (set `do_sample=False`, fixed `seed`)

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Index, decision map — task → model class → pipeline → reference file | [references/REFERENCE.md](references/REFERENCE.md) |
| Install `transformers`, torch backend selection, `accelerate`, `bitsandbytes`, `HF_HOME`, `hf auth login` | [references/setup.md](references/setup.md) |
| `pipeline()` — all task names, `device_map`, `dtype`, batching, message format for chat tasks | [references/pipelines.md](references/pipelines.md) |
| `AutoTokenizer`, fast vs slow, padding/truncation, `apply_chat_template`, special tokens, decoding | [references/tokenizers.md](references/tokenizers.md) |
| `AutoModelFor*` families, `from_pretrained` kwargs, `attn_implementation`, `dtype`, `device_map` | [references/models.md](references/models.md) |
| `.generate()` — sampling/beam params, `GenerationConfig`, batched generation, `TextIteratorStreamer` | [references/generation.md](references/generation.md) |
| `BitsAndBytesConfig` 4/8-bit, GPTQ / AWQ / quanto, accuracy trade-offs, integration with `device_map` | [references/quantization.md](references/quantization.md) |
| `Trainer` + `TrainingArguments` — all key params, distributed (FSDP, DeepSpeed), `push_to_hub` | [references/fine-tuning-trainer.md](references/fine-tuning-trainer.md) |
| `peft.LoraConfig`, `get_peft_model`, `target_modules` per architecture, `merge_and_unload`, QLoRA recipe | [references/peft-and-lora.md](references/peft-and-lora.md) |
| `datasets` — `load_dataset`, `.map()`, `.filter()`, `train_test_split`, streaming, `push_to_hub` | [references/datasets.md](references/datasets.md) |
| Vision-text models (LLaVA, Idefics3, Qwen-VL), `AutoProcessor`, image inputs; audio (Whisper) | [references/multimodal.md](references/multimodal.md) |
| TGI / vLLM overview, minimal FastAPI + `AutoModelForCausalLM` + streaming server pattern | [references/inference-server.md](references/inference-server.md) |
| Troubleshooting — CUDA OOM, padding errors, slow generation, gated access, `trust_remote_code` | [references/troubleshooting.md](references/troubleshooting.md) |
| Recommended defaults — `device_map`, `dtype`, attention impl, `padding_side`, Trainer hyperparams | [references/recommended-defaults.md](references/recommended-defaults.md) |
| Wrong vs right — common HF anti-patterns and their fixes | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases — routing prompts to verify this skill loads on the right tasks | [references/eval-cases.md](references/eval-cases.md) |

**How to use**: open the specific topic file. Don't read every reference — load only what the active task needs.
