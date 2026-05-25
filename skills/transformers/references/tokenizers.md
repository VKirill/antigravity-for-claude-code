# Tokenizers — `AutoTokenizer` and chat templates

`AutoTokenizer.from_pretrained(...)` returns the matching tokenizer for any Hub checkpoint. Fast tokenizers (Rust-backed) are the default and the right choice in 99% of cases.

## Loading

```python
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-7B-Instruct")
# explicit slow tokenizer (Python pure):
# tok = AutoTokenizer.from_pretrained("...", use_fast=False)
```

## Encoding

```python
# single text → tensors
enc = tok("Hello, world.", return_tensors="pt")
# {'input_ids': tensor([[...]]), 'attention_mask': tensor([[...]])}

# batched, padded, truncated
enc = tok(
    ["short", "this is a much longer sentence"],
    padding=True,                # or "max_length"
    truncation=True,
    max_length=128,
    return_tensors="pt",
)
```

## Decoding

```python
output_ids = model.generate(**enc, max_new_tokens=32)
# Skip special tokens (BOS, EOS, padding) for human-readable text
text = tok.decode(output_ids[0], skip_special_tokens=True)

# Batched decode
texts = tok.batch_decode(output_ids, skip_special_tokens=True)
```

## The `pad_token` problem

Many causal LMs (Llama, GPT-2, Mistral base) ship **without** a pad token. Batching fails with:

```
ValueError: Asking to pad but the tokenizer does not have a padding token.
```

Fix once at load:

```python
if tok.pad_token is None:
    tok.pad_token = tok.eos_token
    # also tell the model:
    model.config.pad_token_id = tok.pad_token_id
```

## Padding side for generation

Decoder-only LLMs attend left-to-right. When batching prompts of different lengths for `.generate()`, padding must be on the **left**:

```python
tok.padding_side = "left"
```

If you forget this, generations get prepended garbage tokens or generate from the pad position.

For training (loss masking), use right-padding (the default).

## Chat templates — `apply_chat_template`

Modern chat-tuned models embed a Jinja chat template inside the tokenizer config. Use it — never hand-format role tokens:

```python
messages = [
    {"role": "system", "content": "You are a concise assistant."},
    {"role": "user", "content": "What is 2+2?"},
]

# Render to a string (debugging)
prompt_str = tok.apply_chat_template(
    messages,
    tokenize=False,
    add_generation_prompt=True,
)

# Tokenize to model inputs directly
inputs = tok.apply_chat_template(
    messages,
    add_generation_prompt=True,
    return_tensors="pt",
    return_dict=True,           # returns {input_ids, attention_mask}
).to(model.device)

out = model.generate(**inputs, max_new_tokens=128)
```

Key kwargs:

- `add_generation_prompt=True` — append the assistant turn header so the model continues as the assistant
- `tokenize=False` — return the formatted string (useful for debugging)
- `return_tensors="pt"` — return torch tensors
- `return_dict=True` — return a dict with `input_ids` + `attention_mask`, ready to splat into `.generate(**inputs)`

## Multi-turn with tool use

Some templates accept tool / function-call blocks:

```python
messages = [
    {"role": "user", "content": "What's the weather in Paris?"},
    {"role": "assistant", "content": None, "tool_calls": [
        {"type": "function", "function": {"name": "get_weather", "arguments": '{"city": "Paris"}'}}
    ]},
    {"role": "tool", "name": "get_weather", "content": "{\"temp\": 21, \"unit\": \"C\"}"},
]
prompt = tok.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
```

The exact tool-call format is model-specific — read the model card.

## Special tokens

```python
tok.bos_token, tok.eos_token, tok.pad_token, tok.unk_token, tok.sep_token

# Add custom tokens (rare — needs model.resize_token_embeddings afterward)
num_added = tok.add_special_tokens({"additional_special_tokens": ["<|tool_call|>"]})
model.resize_token_embeddings(len(tok))
```

## Tokenizing for Trainer — the `.map` pattern

```python
def tokenize_fn(batch):
    return tok(batch["text"], truncation=True, max_length=512)

tokenized_ds = raw_ds.map(tokenize_fn, batched=True, remove_columns=["text"])
```

`Trainer` expects an `input_ids` column. `DataCollatorWithPadding(tok)` handles dynamic padding per batch.

## Saving the tokenizer

After fine-tuning, save tokenizer next to model — inference depends on the exact same vocab + special tokens:

```python
tok.save_pretrained(output_dir)
model.save_pretrained(output_dir)
```

## Common gotchas

- Mixing tokenizer A with model B (different checkpoint strings) → garbage output, no error
- Forgetting `add_generation_prompt=True` → model continues the user turn instead of replying
- Forgetting `padding_side="left"` for batched generation → corrupt outputs in some sequences
- Forgetting `skip_special_tokens=True` in `.decode` → user-visible `<|begin_of_text|>` artifacts
- `max_length` without `truncation=True` → tokens silently extend past the limit
