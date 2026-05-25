# Transformers — Decision Map

Index of references with "if you need X, open Y" routing.

## Capability map — task → model class → pipeline → reference

| Task | AutoModel class | `pipeline()` name | Detailed file |
|---|---|---|---|
| Chat / text completion | `AutoModelForCausalLM` | `"text-generation"` | [generation.md](generation.md), [models.md](models.md) |
| Text classification (sentiment, topic) | `AutoModelForSequenceClassification` | `"text-classification"` | [models.md](models.md), [fine-tuning-trainer.md](fine-tuning-trainer.md) |
| Token classification (NER, POS) | `AutoModelForTokenClassification` | `"token-classification"` (alias `"ner"`) | [models.md](models.md) |
| Summarization | `AutoModelForSeq2SeqLM` | `"summarization"` | [models.md](models.md) |
| Translation | `AutoModelForSeq2SeqLM` | `"translation"` | [models.md](models.md) |
| Question answering (extractive) | `AutoModelForQuestionAnswering` | `"question-answering"` | [models.md](models.md) |
| Fill-mask (encoder-only LM) | `AutoModelForMaskedLM` | `"fill-mask"` | [models.md](models.md) |
| Embeddings | `AutoModel` | `"feature-extraction"` | [models.md](models.md) |
| Image classification | `AutoModelForImageClassification` | `"image-classification"` | [models.md](models.md), [multimodal.md](multimodal.md) |
| Object detection | `AutoModelForObjectDetection` | `"object-detection"` | [multimodal.md](multimodal.md) |
| Image-text VLM (LLaVA, Idefics3, Qwen-VL) | `AutoModelForImageTextToText` | `"image-text-to-text"` | [multimodal.md](multimodal.md), [generation.md](generation.md) |
| Audio classification | `AutoModelForAudioClassification` | `"audio-classification"` | [multimodal.md](multimodal.md) |
| Speech recognition (Whisper) | `AutoModelForSpeechSeq2Seq` | `"automatic-speech-recognition"` | [multimodal.md](multimodal.md) |

## By goal — what do you want to do?

| Goal | Open |
|---|---|
| Install transformers + companion libraries | [setup.md](setup.md) |
| Smallest possible inference snippet | [pipelines.md](pipelines.md) |
| Build a prompt for a chat model | [tokenizers.md](tokenizers.md) — `apply_chat_template` |
| Set decoding parameters (temperature, top_p, beams) | [generation.md](generation.md) |
| Stream tokens to a user | [generation.md](generation.md) — `TextIteratorStreamer` |
| Run 7B/13B/70B model on a single consumer GPU | [quantization.md](quantization.md) — 4-bit NF4 |
| Fine-tune a classifier or seq2seq model | [fine-tuning-trainer.md](fine-tuning-trainer.md) |
| Fine-tune a 7B+ LLM on one GPU | [peft-and-lora.md](peft-and-lora.md) — QLoRA recipe |
| Load and tokenize a dataset from the Hub | [datasets.md](datasets.md) |
| Run a VLM on an image URL | [multimodal.md](multimodal.md) |
| Serve a model behind HTTP | [inference-server.md](inference-server.md) |
| Debug CUDA OOM / NaN / slow generation | [troubleshooting.md](troubleshooting.md) |
| Look up sensible defaults | [recommended-defaults.md](recommended-defaults.md) |
| See what NOT to do | [wrong-vs-right.md](wrong-vs-right.md) |
| Verify routing prompts trigger this skill | [eval-cases.md](eval-cases.md) |

## Companion library quick-reference

| Library | Purpose | When you need it |
|---|---|---|
| `transformers` | core | always |
| `torch` | DL backend | always (CPU or GPU) |
| `datasets` | data loading | training, evaluation |
| `accelerate` | device placement, distributed | quantization, multi-GPU, FSDP |
| `peft` | LoRA / IA3 / prompt-tuning | parameter-efficient fine-tune |
| `bitsandbytes` | 4/8-bit quantization | CUDA-only, QLoRA |
| `sentencepiece` | tokenizers | some Llama/Gemma forks |
| `protobuf` | tokenizer compat | rare warnings |
| `evaluate` | metric computation | `compute_metrics` in Trainer |
