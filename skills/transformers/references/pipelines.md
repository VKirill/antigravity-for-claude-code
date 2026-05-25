# Pipelines — quick inference

`pipeline(task, model=..., ...)` is the fastest path from checkpoint to predictions. It wires tokenizer/processor + model + post-processing into one callable.

## Minimal usage

```python
from transformers import pipeline

clf = pipeline("sentiment-analysis")
clf("HuggingFace pipelines are great")
# [{'label': 'POSITIVE', 'score': 0.99...}]
```

## Loading on GPU with sensible defaults

```python
import torch
from transformers import pipeline

pipe = pipeline(
    task="text-generation",
    model="Qwen/Qwen2.5-7B-Instruct",
    device_map="auto",
    dtype="auto",             # was torch_dtype= in v4 — keep using dtype= in new code
)
```

- `device_map="auto"` distributes shards across GPUs / CPU via accelerate
- `dtype="auto"` reads the model config's preferred dtype (usually bf16)
- For a specific dtype: `dtype=torch.bfloat16`

## Task names

| Task string | Modality | Returns |
|---|---|---|
| `"text-generation"` | text in → text out | string completion |
| `"text-classification"` (alias `"sentiment-analysis"`) | text | label + score |
| `"token-classification"` (alias `"ner"`) | text | per-token labels |
| `"fill-mask"` | text with `[MASK]` | candidate tokens |
| `"summarization"` | long text | shorter text |
| `"translation"` / `"translation_xx_to_yy"` | text | translated text |
| `"question-answering"` | (question, context) | extracted span |
| `"zero-shot-classification"` | text + labels | label probs |
| `"feature-extraction"` | text | embeddings |
| `"image-classification"` | image | label + score |
| `"object-detection"` | image | boxes + labels |
| `"image-segmentation"` | image | masks |
| `"image-text-to-text"` | image + text | text completion (VLM) |
| `"audio-classification"` | audio | label + score |
| `"automatic-speech-recognition"` | audio | transcript |

## Text generation pipeline

```python
pipe = pipeline("text-generation", model="meta-llama/Llama-3.1-8B-Instruct",
                device_map="auto", dtype="auto")

messages = [
    {"role": "system", "content": "You are a concise assistant."},
    {"role": "user", "content": "Explain attention in 1 sentence."},
]
out = pipe(messages, max_new_tokens=64, do_sample=False)
print(out[0]["generated_text"][-1]["content"])
```

The pipeline applies the chat template automatically when given message-list input on chat-tuned models.

## Batching

For throughput, pass a list and set `batch_size`:

```python
texts = ["good movie", "bad movie", "meh"]
pipe = pipeline("sentiment-analysis", device_map="auto", batch_size=8)
results = pipe(texts)
```

For text generation, batching is most effective when `tokenizer.padding_side = "left"` (the pipeline sets this for you when needed).

## Image-text-to-text (VLM)

```python
import torch
from transformers import pipeline

pipe = pipeline(
    task="image-text-to-text",
    model="Qwen/Qwen2.5-VL-3B-Instruct",
    device_map="auto",
    dtype="auto",
)

messages = [
    {
        "role": "user",
        "content": [
            {"type": "image", "url": "https://example.com/cat.jpg"},
            {"type": "text", "text": "Describe this image."},
        ],
    }
]
out = pipe(text=messages, max_new_tokens=128, return_full_text=False)
print(out[0]["generated_text"])
```

Image input can be: `url=...`, `image=PIL.Image`, or `image=` local path. The processor handles preprocessing.

## ASR (Whisper)

```python
asr = pipeline("automatic-speech-recognition", model="openai/whisper-large-v3",
               device_map="auto", dtype=torch.float16)
asr("audio.flac")
# {'text': '...'}

# Long audio with chunking:
asr("long_audio.wav", chunk_length_s=30, return_timestamps=True)
```

## Passing a pre-loaded model

When you already loaded the model (e.g., with quantization), pass it directly:

```python
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig, pipeline

bnb = BitsAndBytesConfig(load_in_4bit=True)
tok = AutoTokenizer.from_pretrained("bigcode/octocoder")
model = AutoModelForCausalLM.from_pretrained("bigcode/octocoder", quantization_config=bnb)
pipe = pipeline("text-generation", model=model, tokenizer=tok)
pipe("def fibonacci(n):", max_new_tokens=60)
```

## When to leave pipelines

Pipelines are for the 80% case. Drop to `AutoModel*` + `AutoTokenizer` when you need:

- Fine control over `GenerationConfig` (constrained decoding, custom stopping)
- Custom collation for batched fine-tuning
- Streaming via `TextIteratorStreamer`
- Multi-modal preprocessing beyond defaults
- Per-layer device placement
