# Wrong vs Right — common HF anti-patterns

Each pair shows a real anti-pattern and the surgical fix.

## 1. Manual chat formatting

**❌ Wrong** — hand-rolled prompt format, drifts from model template:

```python
prompt = f"<|system|>You are helpful.<|end|>\n<|user|>{user_msg}<|end|>\n<|assistant|>"
inputs = tok(prompt, return_tensors="pt").to(model.device)
```

**✅ Right** — let the tokenizer apply the model's canonical template:

```python
messages = [
    {"role": "system", "content": "You are helpful."},
    {"role": "user", "content": user_msg},
]
inputs = tok.apply_chat_template(
    messages, add_generation_prompt=True,
    return_tensors="pt", return_dict=True,
).to(model.device)
```

Hand-formatting works for one model and silently breaks when you swap checkpoints.

## 2. Right-padding for batched generation

**❌ Wrong**:

```python
tok.pad_token = tok.eos_token  # default padding_side is "right"
inputs = tok(prompts, padding=True, return_tensors="pt").to(model.device)
out = model.generate(**inputs, max_new_tokens=64)
# Outputs look fine for the longest prompt, garbage for shorter ones
```

**✅ Right**:

```python
tok.padding_side = "left"
tok.pad_token = tok.eos_token
inputs = tok(prompts, padding=True, return_tensors="pt").to(model.device)
out = model.generate(**inputs, max_new_tokens=64)
```

Decoder-only attention is causal — right-padding misaligns generation positions.

## 3. `max_length` instead of `max_new_tokens`

**❌ Wrong**:

```python
out = model.generate(**inputs, max_length=512)
# If prompt is 510 tokens, you get 2 new tokens — silently broken
```

**✅ Right**:

```python
out = model.generate(**inputs, max_new_tokens=512)
```

## 4. Generating without `inference_mode`

**❌ Wrong**:

```python
out = model.generate(**inputs, max_new_tokens=512)
# Builds autograd graph — leaks memory, slower
```

**✅ Right**:

```python
with torch.inference_mode():
    out = model.generate(**inputs, max_new_tokens=512)
```

## 5. Loading tokenizer and model from different checkpoints

**❌ Wrong**:

```python
tok = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B-Instruct")
model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.1-70B")
# Different vocab — outputs are garbage, no error raised
```

**✅ Right** — same checkpoint string in one variable:

```python
ckpt = "meta-llama/Llama-3.1-8B-Instruct"
tok = AutoTokenizer.from_pretrained(ckpt)
model = AutoModelForCausalLM.from_pretrained(ckpt, dtype=torch.bfloat16, device_map="auto")
```

## 6. Forgetting `eos_token_id` on chat models

**❌ Wrong**:

```python
out = model.generate(**inputs, max_new_tokens=4096)
# Generates until max_new_tokens; ignores natural stop tokens
```

**✅ Right** — pass model's EOS explicitly (and `pad_token_id` for batches):

```python
out = model.generate(
    **inputs, max_new_tokens=4096,
    eos_token_id=tok.eos_token_id,
    pad_token_id=tok.pad_token_id or tok.eos_token_id,
)
```

## 7. Manual `.half()` on top of quantized load

**❌ Wrong**:

```python
bnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16)
model = AutoModelForCausalLM.from_pretrained(ckpt, quantization_config=bnb, device_map="auto")
model = model.half()  # corrupts quantized layers
```

**✅ Right** — let `from_pretrained` handle dtypes; never `.half()` a quantized model:

```python
bnb = BitsAndBytesConfig(
    load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_quant_type="nf4", bnb_4bit_use_double_quant=True,
)
model = AutoModelForCausalLM.from_pretrained(ckpt, quantization_config=bnb, device_map="auto")
```

## 8. Full fine-tune when LoRA suffices

**❌ Wrong** — full fine-tune a 7B model on a single 24 GB GPU:

```python
model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-7B-Instruct", dtype=torch.bfloat16)
trainer = Trainer(model=model, ...)
trainer.train()  # OOM on first batch
```

**✅ Right** — QLoRA (4-bit base + LoRA adapters):

```python
bnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                          bnb_4bit_compute_dtype=torch.bfloat16,
                          bnb_4bit_use_double_quant=True)
base = AutoModelForCausalLM.from_pretrained(ckpt, quantization_config=bnb, device_map="auto")
base = prepare_model_for_kbit_training(base, use_gradient_checkpointing=True)
model = get_peft_model(base, LoraConfig(r=16, lora_alpha=32,
                                         target_modules=["q_proj","k_proj","v_proj","o_proj"],
                                         task_type="CAUSAL_LM"))
```

## 9. v4 keyword names in v5 `TrainingArguments`

**❌ Wrong** — old keyword names:

```python
args = TrainingArguments(
    output_dir="out",
    evaluation_strategy="epoch",     # deprecated
)
trainer = Trainer(model=model, args=args, tokenizer=tok, ...)  # deprecated kwarg
```

**✅ Right** — current keyword names:

```python
args = TrainingArguments(
    output_dir="out",
    eval_strategy="epoch",
)
trainer = Trainer(model=model, args=args, processing_class=tok, ...)
```

## 10. Saving model without tokenizer

**❌ Wrong**:

```python
trainer.save_model("out/")
# Inference later: AutoTokenizer.from_pretrained("out/") → no tokenizer files
```

**✅ Right** — save both:

```python
trainer.save_model("out/")
tok.save_pretrained("out/")
```

`Trainer` saves the tokenizer automatically when `processing_class=tok` was passed; do it explicitly otherwise.

## 11. `trust_remote_code=True` on a random repo

**❌ Wrong**:

```python
model = AutoModelForCausalLM.from_pretrained("random-user/some-fork", trust_remote_code=True)
# Executes arbitrary Python from a stranger's repo
```

**✅ Right** — only on audited / first-party repos, and pin to a commit:

```python
model = AutoModelForCausalLM.from_pretrained(
    "Qwen/Qwen2.5-7B-Instruct",
    trust_remote_code=True,
    revision="<known-good-sha>",
)
```

## 12. Tokenizing per example with `.map(batched=False)`

**❌ Wrong**:

```python
ds = ds.map(lambda x: tok(x["text"], truncation=True))   # ~100x slower
```

**✅ Right**:

```python
ds = ds.map(lambda b: tok(b["text"], truncation=True), batched=True, remove_columns=["text"])
```
