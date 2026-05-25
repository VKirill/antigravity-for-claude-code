# Eval cases — routing tests

Prompts that should / should not load this skill. Use them to verify the description triggers correctly.

## Positive — should route to `transformers`

### Pipelines / quick inference
- "How do I run sentiment analysis with HuggingFace?"
- "Show me a pipeline for text generation"
- "I want to use `pipeline('automatic-speech-recognition')`"
- "How do I load a model from the HuggingFace Hub?"

### Loading / AutoModel
- "Load Qwen2.5-7B-Instruct with `AutoModelForCausalLM`"
- "What does `device_map='auto'` do?"
- "Should I use `sdpa` or `flash_attention_2`?"
- "How do I set `attn_implementation` on `from_pretrained`?"

### Generation
- "How do I stream tokens from `.generate()`?"
- "What is `TextIteratorStreamer`?"
- "Set up `GenerationConfig` for sampling with top_p"
- "Why does batched generation give garbage outputs?" (→ padding_side)
- "How do I use `apply_chat_template`?"

### Fine-tuning / Trainer
- "Fine-tune a BERT classifier with Trainer"
- "What's the difference between `eval_strategy` and `evaluation_strategy`?"
- "Configure `TrainingArguments` for FSDP"
- "How do I push my model to the Hub after training?"

### PEFT / LoRA
- "Set up LoRA for Llama-3"
- "What is QLoRA?"
- "Which `target_modules` should I use for Qwen?"
- "How do I merge LoRA adapters back into the base model?"

### Quantization
- "Load a 7B model with 4-bit quantization"
- "What is `BitsAndBytesConfig`?"
- "How does NF4 compare to GPTQ?"

### Multimodal
- "Run LLaVA on an image URL"
- "How do I use Qwen-VL?"
- "Transcribe audio with Whisper using transformers"
- "What is `AutoProcessor`?"

### Datasets library
- "Load IMDB with `datasets.load_dataset`"
- "How do I `.map` tokenization over a dataset?"
- "Stream a dataset that doesn't fit on disk"

## Negative — should NOT route here

### Classical ML
- "Train a random forest on tabular data" → `scikit-learn`
- "Logistic regression with scikit-learn" → `scikit-learn`

### Raw PyTorch
- "Write a custom `nn.Module` training loop" → `pytorch`
- "What is `torch.compile`?" → `pytorch`
- "Implement DDP training" → `pytorch`

### LLM application frameworks
- "Build a RAG agent with LangChain" → `langchain`
- "Use LCEL Runnable composition" → `langchain`

### Provider SDKs (no `transformers` import)
- "Call Claude with the Anthropic SDK" → `claude-api`
- "Use the OpenAI Python SDK" → (openai-sdk skill if active)

### GPU compute without DL
- "Write a custom CUDA kernel" → `cuda-python`
- "Use CuPy for array math" → `cuda-python`

### Data prep only
- "Read a CSV with pandas" → `pandas`
- "Polars lazy frame" → `polars`

### Serving (when the question is purely about the engine, not the model)
- "Deploy vLLM in production" → (no vLLM skill exists; inference-server.md gives an overview but the topic is engine-side, not transformers-side)
- "Tune TGI batch settings" → same — pure serving-side

## Disambiguation cases

- "Fine-tune a model with PEFT" → **transformers** (Trainer + PEFT) — load this skill
- "Train an LLM from scratch" → **pytorch** as primary, transformers secondary
- "Build a RAG pipeline that uses HF embeddings" → **langchain** primary; this skill secondary for the embedding model loading
- "Run inference on a quantized Llama" → **transformers** primary (load + generate), this skill answers fully
- "Serve quantized Llama at 1000 QPS" → mostly out of scope; reference `inference-server.md` for vLLM/TGI pointers

## How to use

Paste any of the positive prompts into a fresh Claude Code session and verify the `transformers` skill loads. Paste a negative prompt and verify a more specific skill (or none) loads instead.
