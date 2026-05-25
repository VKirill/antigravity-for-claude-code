# Troubleshooting

Common HF errors and what to do.

## CUDA out of memory during generation

```
torch.cuda.OutOfMemoryError: CUDA out of memory.
```

Try in order:

1. Lower `batch_size` (or generate one prompt at a time)
2. Reduce `max_new_tokens`
3. Ensure `use_cache=True` is set (default for `.generate`)
4. Switch `attn_implementation` from `"eager"` to `"sdpa"` or `"flash_attention_2"`
5. Quantize: `BitsAndBytesConfig(load_in_4bit=True, ...)`
6. Move to a smaller variant of the model
7. `torch.cuda.empty_cache()` between unrelated phases — does not help inside a single call

## CUDA OOM during training

1. Lower `per_device_train_batch_size`, raise `gradient_accumulation_steps` to keep effective batch
2. Enable `gradient_checkpointing=True` in `TrainingArguments`
3. Use `bf16=True` (Ampere+/Hopper) — halves activation memory vs fp32
4. Switch to LoRA / QLoRA (see [peft-and-lora.md](peft-and-lora.md))
5. FSDP for sharding (`fsdp="full_shard"`) or DeepSpeed ZeRO-3 with CPU offload
6. Reduce `max_length` for tokenization

## `ValueError: Asking to pad but the tokenizer does not have a padding token`

Many causal LMs ship without a pad token. Fix:

```python
if tok.pad_token is None:
    tok.pad_token = tok.eos_token
    model.config.pad_token_id = tok.pad_token_id
```

## Outputs look garbled / start with random tokens

Likely cause: right-padded batch on a decoder-only LLM. Fix:

```python
tok.padding_side = "left"
```

## Output is empty / never stops

Likely cause: `eos_token_id` mismatch or missing. Fix:

```python
out = model.generate(
    **inputs,
    max_new_tokens=512,
    eos_token_id=tok.eos_token_id,    # explicit
    pad_token_id=tok.pad_token_id,
)
```

For chat models, some templates use a custom assistant-end token — check the model card.

## Slow generation

Typical fixes:

1. `attn_implementation="sdpa"` (default-safe) or `"flash_attention_2"` (Ampere+/Hopper, requires `pip install flash-attn`)
2. `use_cache=True` (default; verify it isn't disabled by gradient checkpointing)
3. Use `cache_implementation="static"` with `torch.compile` for stable shapes
4. Avoid `do_sample=True` with extremely low temperature (just use `do_sample=False`)
5. Batch independent requests
6. Switch to dedicated engine (vLLM, TGI) for high QPS — see [inference-server.md](inference-server.md)

## `OSError: ... is not a local folder and is not a valid model identifier`

- Typo in the checkpoint string
- Gated model: run `hf auth login` and accept the model's license on the Hub
- Offline mode: set `HF_HUB_OFFLINE=1` only after pre-fetching with `hf download`

## 403 Forbidden on `from_pretrained`

Gated model. On the model's Hub page, click "Agree and access repository" with a logged-in account. Then `hf auth login` (or `HF_TOKEN` env var) on the machine.

## `trust_remote_code` warning

```
The repository ... contains custom code which must be executed to correctly load the model.
You can inspect the repository content at https://...
```

Only enable `trust_remote_code=True` for:

- First-party HF / lab repos you trust (Qwen team, Meta, Google DeepMind, etc.)
- Repos you have audited
- Pin via `revision="<commit-sha>"` to lock the executed code

Never enable on random community forks.

## `RuntimeError: Expected all tensors to be on the same device`

Manually moved inputs / model to different devices. Fix: load with `device_map="auto"` and move inputs via `inputs.to(model.device)`. Do not call `.to("cuda")` on a model already placed by accelerate.

## `dtype` mismatch errors

```
RuntimeError: expected scalar type BFloat16 but found Float
```

Causes:

- Mixed inputs in fp32 with model in bf16 — let the tokenizer/processor produce ids (always int), no manual `.float()` calls
- Called `.half()` or `.bfloat16()` on a model already loaded with `dtype=...` — drop the manual cast
- Used a quantized model + manual `.to("cuda")` — let accelerate place it

## Tokenizer / model mismatch — garbage output, no error

You loaded `AutoTokenizer.from_pretrained("A")` with `AutoModelForCausalLM.from_pretrained("B")`. Always use the same checkpoint string for both. After fine-tuning, save the tokenizer next to the model.

## `evaluation_strategy` errors

Use `eval_strategy` — `evaluation_strategy` is the deprecated v4 name. Same for any code copy-pasted from old tutorials.

## `processing_class` vs `tokenizer` in Trainer

`tokenizer=tok` keyword in `Trainer(...)` is deprecated. The current name is `processing_class=tok` (also accepts `AutoProcessor` for multimodal). The old name still works in current Transformers but emits warnings — update for new code.

## `bitsandbytes` import error on CPU / Mac

bitsandbytes requires CUDA. On macOS or CPU boxes:

- Use `quanto` for quantization (`QuantoConfig(weights="int4")`)
- Or run quantized models via `llama.cpp` / GGUF

## Flash-attn install fails

```
ERROR: Failed building wheel for flash-attn
```

- `pip install flash-attn --no-build-isolation` (the wheel needs to import torch during build)
- Needs CUDA toolkit headers matching your torch CUDA build
- Compute capability must be ≥ 8.0 (Ampere). On Turing (7.5) or older, stay on `sdpa`

## Trainer hangs at start of training

On multi-GPU launches, often a NCCL / process-group issue:

- Ensure all ranks call `Trainer` at the same point
- Check `CUDA_VISIBLE_DEVICES` is consistent across ranks
- Add `os.environ["NCCL_DEBUG"] = "INFO"` for verbose logs

## `compute_metrics` never runs

`eval_strategy` is `"no"` (default). Set it to `"steps"` or `"epoch"`.

## Push-to-hub fails with 401

- `hf auth login` (or set `HF_TOKEN`) with a token that has `write` scope
- The repo may already exist under a different user — set `hub_model_id="yourname/your-repo"` explicitly
