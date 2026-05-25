# Multimodal — vision-language and audio

Multimodal models use `AutoProcessor` (a unified preprocessor) instead of `AutoTokenizer`. The processor wraps tokenizer + image processor + (sometimes) feature extractor.

## Image-text models (VLMs)

Supported families: LLaVA, LLaVA-NeXT, Idefics2/3, Qwen-VL / Qwen2.5-VL, InternVL3, Pixtral, Gemma-3-vision, Llama-3.2-Vision, ERNIE-4.5-VL.

### Pipeline (easiest)

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
            {"type": "text", "text": "Describe this image in one sentence."},
        ],
    },
]
out = pipe(text=messages, max_new_tokens=128, return_full_text=False)
print(out[0]["generated_text"])
```

Image input options inside `content`:
- `{"type": "image", "url": "https://..."}` — fetched by the processor
- `{"type": "image", "image": pil_image_object}` — pre-loaded PIL.Image
- `{"type": "image", "path": "./local.jpg"}` — local file

### Manual — `AutoProcessor` + `AutoModelForImageTextToText`

```python
import torch
from PIL import Image
import requests
from transformers import AutoProcessor, AutoModelForImageTextToText

ckpt = "Qwen/Qwen2.5-VL-3B-Instruct"
processor = AutoProcessor.from_pretrained(ckpt)
model = AutoModelForImageTextToText.from_pretrained(
    ckpt, dtype=torch.bfloat16, device_map="auto",
)

image = Image.open(requests.get("https://example.com/cat.jpg", stream=True).raw)
messages = [
    {"role": "user", "content": [
        {"type": "image"},
        {"type": "text", "text": "What is in this picture?"},
    ]},
]
prompt = processor.apply_chat_template(messages, add_generation_prompt=True)
inputs = processor(text=prompt, images=image, return_tensors="pt").to(model.device)

with torch.inference_mode():
    out = model.generate(**inputs, max_new_tokens=128, do_sample=False)
print(processor.batch_decode(out, skip_special_tokens=True)[0])
```

Manual path is needed when you want full control: custom stopping criteria, streaming, batched multi-image inputs, or processor pre-processing tweaks (resolution, patch size).

## Streaming VLM output

Same `TextIteratorStreamer` pattern as text-only — pass the processor's tokenizer:

```python
from threading import Thread
from transformers import TextIteratorStreamer

streamer = TextIteratorStreamer(processor.tokenizer, skip_prompt=True, skip_special_tokens=True)
gen_kwargs = dict(**inputs, max_new_tokens=512, streamer=streamer, do_sample=False)
Thread(target=model.generate, kwargs=gen_kwargs).start()
for chunk in streamer:
    print(chunk, end="", flush=True)
```

## Image classification (non-generative)

```python
from transformers import pipeline
clf = pipeline("image-classification", model="google/vit-base-patch16-224")
clf("https://example.com/dog.jpg")
# [{'label': 'golden retriever', 'score': 0.92}, ...]
```

## Object detection

```python
det = pipeline("object-detection", model="facebook/detr-resnet-50")
det("https://example.com/street.jpg")
# [{'box': {...}, 'label': 'car', 'score': 0.99}, ...]
```

## Speech recognition — Whisper

```python
import torch
from transformers import pipeline

asr = pipeline(
    "automatic-speech-recognition",
    model="openai/whisper-large-v3",
    device_map="auto",
    dtype=torch.float16,
)
asr("podcast.mp3")
# {'text': 'transcript...'}

# Long-form with timestamps:
asr("long.wav", chunk_length_s=30, return_timestamps=True)
# {'text': '...', 'chunks': [{'timestamp': (0.0, 5.2), 'text': '...'}, ...]}
```

Manual Whisper:

```python
from transformers import AutoProcessor, AutoModelForSpeechSeq2Seq

processor = AutoProcessor.from_pretrained("openai/whisper-large-v3")
model = AutoModelForSpeechSeq2Seq.from_pretrained(
    "openai/whisper-large-v3", dtype=torch.float16, device_map="auto",
)

# audio_array must be 16000 Hz mono float32
inputs = processor(audio_array, sampling_rate=16000, return_tensors="pt").to(model.device)
out = model.generate(**inputs, max_new_tokens=448, language="en", task="transcribe")
print(processor.batch_decode(out, skip_special_tokens=True)[0])
```

## Audio classification

```python
clf = pipeline("audio-classification", model="MIT/ast-finetuned-audioset-10-10-0.4593")
clf("audio.wav")
# [{'label': 'speech', 'score': 0.9}, ...]
```

## Text-to-image / image-to-image

These are **diffusers** territory, not transformers — install `diffusers` and use `DiffusionPipeline` / `StableDiffusionPipeline`. Out of scope for this skill.

## Multimodal fine-tuning

`Trainer` supports VLMs / ASR models the same way as text. Two extra things:

1. Use `processing_class=processor` instead of `processing_class=tokenizer`
2. Set `remove_unused_columns=False` in `TrainingArguments` so raw image / audio columns survive

```python
args = TrainingArguments(
    output_dir="vlm-ft",
    remove_unused_columns=False,
    ...
)
trainer = Trainer(
    model=model,
    args=args,
    train_dataset=ds["train"],
    eval_dataset=ds["test"],
    processing_class=processor,
    data_collator=my_collator,        # custom — preprocesses images per batch
)
```

## Pitfalls

- Forgetting to pass images in the right place — VLMs need `{"type": "image"}` slots in the messages AND the raw images in `processor(images=...)`
- Resolution mismatch — most VLMs accept dynamic resolutions, but Idefics3 and some others fix patch grids; check the model card
- `processor.tokenizer` vs `processor` for streaming — pass `processor.tokenizer` to `TextIteratorStreamer`
- Whisper expects 16 kHz mono float32; resample upstream or use `datasets.Audio(sampling_rate=16000)`
- Forgetting `remove_unused_columns=False` for VLM fine-tuning → image bytes get dropped before the collator runs
