# Recommended Defaults

Single source of truth for "what should I set?" Use these unless you have a specific reason to deviate. Other references link here instead of duplicating numbers.

## Loading a model for inference

| Knob | Default | Why |
|---|---|---|
| `dtype` | `torch.bfloat16` (Ampere+/Hopper) or `"auto"` | best speed/quality on modern GPUs; `"auto"` reads model config |
| `device_map` | `"auto"` | accelerate handles placement and CPU offload |
| `attn_implementation` | `"sdpa"` | safe default everywhere; switch to `"flash_attention_2"` on capability ≥ 8.0 with package installed |
| `low_cpu_mem_usage` | `True` (default with `device_map`) | streamed load |
| `use_safetensors` | `True` (default when available) | safer + faster than `.bin` |
| `trust_remote_code` | `False` unless explicitly needed and audited | security boundary |

## Tokenizer for batched generation

| Knob | Default | Why |
|---|---|---|
| `padding_side` | `"left"` | decoder-only attention requires left-pad for batched generate |
| `pad_token` | `tok.eos_token` if `pad_token is None` | many causal LMs lack pad |
| `truncation` | `True` | always paired with `max_length` |
| `max_length` (tokenization) | model max or task-specific (256 cls / 1024 SFT / 4096 RAG) | match context budget |

## Generation defaults

| Knob | Default | When to change |
|---|---|---|
| `max_new_tokens` | task-specific (64 short, 512 chat, 2048 long-form) | always set |
| `do_sample` | `True` for chat, `False` for tests / deterministic eval | greedy for reproducibility |
| `temperature` | `0.7` | lower for factual, higher for creative |
| `top_p` | `0.9` | nucleus default |
| `repetition_penalty` | `1.05` | bump to 1.1 only if you see loops |
| `eos_token_id` | `tok.eos_token_id` (explicit) | model-specific override if needed |
| `pad_token_id` | `tok.pad_token_id` (explicit) | required for batched generate |
| `use_cache` | `True` (default) | leave on for inference |

## Quantization (QLoRA-ready)

| Knob | Default |
|---|---|
| `load_in_4bit` | `True` |
| `bnb_4bit_quant_type` | `"nf4"` |
| `bnb_4bit_compute_dtype` | `torch.bfloat16` |
| `bnb_4bit_use_double_quant` | `True` |

## LoRA defaults (good starting point)

| Knob | Default | Notes |
|---|---|---|
| `r` | `16` | 8 for tiny tasks, 32–64 for hard tasks |
| `lora_alpha` | `32` (= 2 × r) | scaling |
| `lora_dropout` | `0.05` | 0.0 if dataset is large |
| `target_modules` | full set: `["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"]` | for Llama/Qwen/Mistral families |
| `task_type` | `"CAUSAL_LM"` (LLM SFT) | or `"SEQ_CLS"`, etc. |
| `bias` | `"none"` | rarely improves with `"all"` |

## Trainer / TrainingArguments

| Knob | Default | Notes |
|---|---|---|
| `learning_rate` (full FT, LM) | `2e-5` | encoder cls: same; LoRA: `1e-4` to `3e-4` |
| `per_device_train_batch_size` | as large as fits | usually 1–4 for 7B+ on consumer GPUs |
| `gradient_accumulation_steps` | enough to reach effective batch 16–32 | tune up if OOM |
| `num_train_epochs` | `3` for cls / `1` for SFT / `2-3` for LoRA | task-dependent |
| `eval_strategy` | `"epoch"` (small) / `"steps"` with `eval_steps=500` (long runs) | the v5 keyword |
| `save_strategy` | match `eval_strategy` | required for `load_best_model_at_end` |
| `save_total_limit` | `2`–`3` | keep best + latest |
| `bf16` | `True` on Ampere+/Hopper | else `fp16=True` |
| `gradient_checkpointing` | `True` for large models | ~30% slower, big VRAM save |
| `lr_scheduler_type` | `"cosine"` | linear for short runs |
| `warmup_ratio` | `0.03` | classic default |
| `weight_decay` | `0.01` | |
| `max_grad_norm` | `1.0` | default |
| `logging_steps` | `20`–`50` | match dataset size |
| `dataloader_num_workers` | `4` | bump on big datasets |
| `report_to` | `"none"` (dev) / `"wandb"` (real runs) | |

## DataLoader / `datasets` defaults

| Knob | Default | Notes |
|---|---|---|
| `.map(..., batched=True)` | always | per-example is 100x slower |
| `.map(..., num_proc=N)` | match CPU cores for tokenization | skip for GPU stages |
| `remove_unused_columns` | `True` for text-only; `False` for vision/audio | Trainer compatibility |

## Padding policy summary

| Scenario | `padding_side` |
|---|---|
| Batched generation (decoder-only) | `"left"` |
| Batched training (any) | `"right"` (default) |
| Encoder-only (BERT cls / NER) | `"right"` (default) |

## When to deviate

These are starting points. Deviate when:

- Sequence-length distribution is very skewed → fix-length padding may help
- You see overfitting → bump `weight_decay`, drop epochs, add dropout
- Loss plateau → raise LR by 2x, retry
- NaN loss with fp16 → switch to bf16 if hardware allows
- Slow throughput → larger per-device batch, then gradient accumulation, then flash-attn
