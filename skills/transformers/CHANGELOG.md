# Changelog

All notable changes to the `transformers` skill follow SemVer at the skill level.

## [1.0.0]

Initial release. Targets HuggingFace Transformers 5.x on PyTorch 2.12 + Python 3.14.

### Added
- `SKILL.md` navigator with frontmatter `risk: medium-stakes`, `## Use this skill when`, `## Do not use this skill when`, `## Purpose`, `## Capabilities`, `## Behavioral Traits`, `## Important Constraints`, `## Related Skills`, `## API Reference`.
- `references/REFERENCE.md` — capability map (task → AutoModel class → pipeline name → topic file).
- `references/setup.md` — install matrix, companion libs (datasets / accelerate / peft / bitsandbytes), `HF_HOME` cache, `hf auth login` for gated checkpoints, GPU sanity check.
- `references/pipelines.md` — full task-name catalogue, `device_map`, `dtype`, batching, VLM/ASR pipelines, message format.
- `references/tokenizers.md` — `AutoTokenizer`, fast vs slow, padding rules, `apply_chat_template`, special tokens, decoding, the `pad_token` workaround.
- `references/models.md` — every `AutoModelFor*` family with task mapping, `from_pretrained` kwargs reference, attention-implementation comparison.
- `references/generation.md` — `.generate()` kwargs (length, decoding strategy, sampling, stopping, caching), `GenerationConfig`, batched generation with `padding_side="left"`, `TextIteratorStreamer` thread pattern.
- `references/quantization.md` — bitsandbytes 4-bit NF4 + 8-bit, GPTQ / AWQ / quanto, memory math table, picker flowchart.
- `references/fine-tuning-trainer.md` — `Trainer` minimal example, full `TrainingArguments` reference, causal-LM SFT pattern, `accelerate launch`, FSDP, DeepSpeed ZeRO-3.
- `references/peft-and-lora.md` — `LoraConfig`, `target_modules` per architecture, end-to-end QLoRA recipe, adapter save/load/merge, multi-adapter switching.
- `references/datasets.md` — `load_dataset`, `.map(batched=True)`, `.filter`, `train_test_split`, streaming, `push_to_hub`, audio/image columns.
- `references/multimodal.md` — VLM patterns (LLaVA / Qwen-VL / Idefics3 / InternVL), `AutoProcessor`, streaming, Whisper ASR, fine-tuning multimodal.
- `references/inference-server.md` — minimal FastAPI + `AutoModelForCausalLM` + `TextIteratorStreamer` server with `lifespan`, TGI and vLLM quick-reference, picker flowchart.
- `references/troubleshooting.md` — CUDA OOM (inference + training), pad-token error, garbled outputs, slow generation, gated 403, `trust_remote_code`, device/dtype mismatches, multi-GPU NCCL hangs.
- `references/recommended-defaults.md` — single source of truth for `dtype`, `attn_implementation`, `padding_side`, generation knobs, QLoRA / LoRA hyperparameters, `TrainingArguments` knobs.
- `references/wrong-vs-right.md` — 12 anti-pattern pairs (manual chat formatting, right-padding for generation, `max_length` vs `max_new_tokens`, missing `inference_mode`, mismatched tokenizer/model, missing `eos_token_id`, manual `.half()` on quantized, full FT vs QLoRA, v4 keyword names, missing tokenizer save, `trust_remote_code` on random repo, per-example `.map`).
- `references/eval-cases.md` — positive / negative routing prompts covering every capability + disambiguation cases vs `pytorch`, `langchain`, `scikit-learn`, `cuda-python`.

### Notes — Transformers 5.x migration highlights captured in this skill

- `from_pretrained(..., dtype=...)` is the current keyword; the legacy `torch_dtype=` still works but is deprecated — references use `dtype=`.
- `TrainingArguments(eval_strategy=...)` replaces v4's `evaluation_strategy=` — references use the v5 name throughout.
- `Trainer(processing_class=tok)` replaces the deprecated `tokenizer=` keyword and now also accepts image/audio processors — references use `processing_class=`.
- `tokenizer.prepare_seq2seq_batch` is removed — replaced by `tokenizer(..., text_target=...)`.
- `apply_chat_template(..., return_dict=True)` returns ready-to-splat `{input_ids, attention_mask}`.
- `attn_implementation` values: `"sdpa"` (default-safe), `"flash_attention_2"` (Ampere+/Hopper, needs `flash-attn` pkg), `"eager"` (debug).
- `cache_implementation="static"` paired with `torch.compile` for stable-shape generation.
- `hf` CLI replaces `huggingface-cli`; `hf auth login` for gated repos. The longer name still works.

### Cross-skill conventions
- Frontmatter `risk: medium-stakes` — has `references/troubleshooting.md` and `references/wrong-vs-right.md`.
- `references/recommended-defaults.md` is the single source of truth for operational knobs; other files link rather than duplicate.
- Version block left as a placeholder for `sync_skill_versions.py` to populate from `STACK_VERSIONS.md`.
