# Models — `AutoModelFor*` families

`AutoModelFor<Task>` selects the correct architecture from a checkpoint config and attaches the right task head.

## The Auto* families

| Class | Task |
|---|---|
| `AutoModel` | bare encoder; outputs hidden states (embeddings) |
| `AutoModelForCausalLM` | autoregressive LM (Llama, Qwen, Mistral, GPT-2) |
| `AutoModelForSeq2SeqLM` | encoder-decoder (T5, BART, mBART, Pegasus) |
| `AutoModelForMaskedLM` | BERT-style masked LM |
| `AutoModelForSequenceClassification` | text classification head |
| `AutoModelForTokenClassification` | NER / POS head |
| `AutoModelForQuestionAnswering` | extractive QA head (start/end logits) |
| `AutoModelForMultipleChoice` | MC head |
| `AutoModelForImageClassification` | vision classifier (ViT, ConvNeXt) |
| `AutoModelForObjectDetection` | DETR-style detection |
| `AutoModelForImageTextToText` | VLM (LLaVA, Idefics3, Qwen-VL, InternVL) |
| `AutoModelForSpeechSeq2Seq` | Whisper, SeamlessM4T |
| `AutoModelForAudioClassification` | Wav2Vec2 classifier |
| `AutoProcessor` | unified text+image/audio preprocessor for multimodal |
| `AutoConfig` | inspect / mutate config without loading weights |

## Canonical load

```python
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

ckpt = "Qwen/Qwen2.5-7B-Instruct"
tok = AutoTokenizer.from_pretrained(ckpt)
model = AutoModelForCausalLM.from_pretrained(
    ckpt,
    dtype=torch.bfloat16,          # bf16 on Ampere+/Hopper; "auto" reads config
    device_map="auto",             # accelerate places shards on visible devices
    attn_implementation="sdpa",    # PyTorch native; safe default
)
```

## `from_pretrained` — key kwargs

| Kwarg | Purpose | Common values |
|---|---|---|
| `dtype` | weight + activation dtype on load | `torch.bfloat16`, `torch.float16`, `"auto"` |
| `device_map` | shard placement via accelerate | `"auto"`, `"cuda"`, `"cpu"`, `{"layer.0": 0, ...}` |
| `attn_implementation` | attention kernel | `"sdpa"` (default-safe), `"flash_attention_2"` (Ampere+/Hopper, requires flash-attn pkg), `"eager"` (slow, debugging) |
| `quantization_config` | quantization | `BitsAndBytesConfig(...)`, `GPTQConfig(...)`, `AWQConfig(...)` |
| `low_cpu_mem_usage` | streamed load to avoid 2x CPU peak | `True` (default with `device_map`) |
| `revision` | git ref | `"main"`, branch / tag / commit sha |
| `subfolder` | nested checkpoint in repo | `"checkpoint-1000"` |
| `trust_remote_code` | execute model-specific Python in repo | `True` only for audited / first-party checkpoints |
| `use_safetensors` | prefer `.safetensors` over `.bin` | `True` (default when available) |
| `token` | auth for gated repos | `os.environ["HF_TOKEN"]` |
| `cache_dir` | override HF_HOME for this call | `"/data/hf"` |

> Note on `dtype` vs `torch_dtype`: current Transformers uses `dtype=`. The older `torch_dtype=` kwarg still works for backward compatibility but is the deprecated name — use `dtype=` in new code.

## Attention implementations

| Value | Speed | Memory | Notes |
|---|---|---|---|
| `"eager"` | slow | low | reference impl; debugging only |
| `"sdpa"` | fast | medium | PyTorch built-in; safe default; works on all hardware |
| `"flash_attention_2"` | fastest | lowest | needs `pip install flash-attn`; Ampere+/Hopper only |

```python
# Try flash-attn-2, fall back to sdpa:
try:
    model = AutoModelForCausalLM.from_pretrained(
        ckpt, dtype=torch.bfloat16, device_map="auto",
        attn_implementation="flash_attention_2",
    )
except (ImportError, ValueError):
    model = AutoModelForCausalLM.from_pretrained(
        ckpt, dtype=torch.bfloat16, device_map="auto",
        attn_implementation="sdpa",
    )
```

## Classification head

```python
from transformers import AutoModelForSequenceClassification

model = AutoModelForSequenceClassification.from_pretrained(
    "distilbert-base-uncased",
    num_labels=3,
    id2label={0: "neg", 1: "neu", 2: "pos"},
    label2id={"neg": 0, "neu": 1, "pos": 2},
)
```

For fine-tuning, the classifier head is randomly initialized — train it before serving.

## Seq2seq

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("google/flan-t5-base")
model = AutoModelForSeq2SeqLM.from_pretrained("google/flan-t5-base")
inputs = tok("translate English to French: Hello", return_tensors="pt")
out = model.generate(**inputs, max_new_tokens=32)
print(tok.decode(out[0], skip_special_tokens=True))
```

## Embeddings (bare AutoModel)

```python
from transformers import AutoModel, AutoTokenizer

tok = AutoTokenizer.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")
model = AutoModel.from_pretrained("sentence-transformers/all-MiniLM-L6-v2").eval()

with torch.inference_mode():
    enc = tok(["hello", "hi there"], padding=True, return_tensors="pt")
    out = model(**enc)
    # Mean-pool over tokens for sentence embeddings:
    mask = enc["attention_mask"].unsqueeze(-1).float()
    sentence_emb = (out.last_hidden_state * mask).sum(1) / mask.sum(1)
```

## Saving and reloading

```python
model.save_pretrained("out/")     # weights + config
tok.save_pretrained("out/")       # vocab + tokenizer config

# Load back from local dir (same API as Hub):
model2 = AutoModelForCausalLM.from_pretrained("out/")
tok2 = AutoTokenizer.from_pretrained("out/")
```

## `trust_remote_code` — when to enable

Some checkpoints ship custom Python that overrides the default model class. Enabling `trust_remote_code=True` **executes that Python on load**.

- Enable for: first-party HuggingFace/lab repos you trust (Qwen team, Google DeepMind, Meta, etc.)
- Do not enable for: random forks, unaudited community uploads
- Pin via `revision="<commit-sha>"` to lock the code being executed

## Inspecting the model

```python
print(model)                  # full module tree
print(model.config)           # architectural hyperparams
sum(p.numel() for p in model.parameters()) / 1e9  # param count in B
```
