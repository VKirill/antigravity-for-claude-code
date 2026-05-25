# Inference server — serving HF models behind HTTP

For production LLM serving, prefer dedicated engines:

| Engine | Best for | Notes |
|---|---|---|
| **TGI** (text-generation-inference) | HF-native LLM serving | Rust + Python; speculative decoding, continuous batching; OpenAI-compatible endpoint |
| **vLLM** | high-throughput LLM serving | PagedAttention; continuous batching; OpenAI-compatible endpoint |
| **SGLang** | structured / multi-step LLM serving | RadixAttention; constrained decoding primitives |

All three read Transformers model definitions directly — fine-tune with `Trainer`/PEFT, deploy with TGI/vLLM/SGLang.

This file covers the **minimal in-process FastAPI pattern** for when you don't need a dedicated engine.

## Minimal FastAPI + AutoModelForCausalLM

```python
# server.py
from contextlib import asynccontextmanager
from threading import Thread
from typing import AsyncIterator

import torch
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM, TextIteratorStreamer

state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    ckpt = "Qwen/Qwen2.5-7B-Instruct"
    state["tok"] = AutoTokenizer.from_pretrained(ckpt)
    state["model"] = AutoModelForCausalLM.from_pretrained(
        ckpt, dtype=torch.bfloat16, device_map="auto",
        attn_implementation="sdpa",
    )
    yield
    state.clear()


app = FastAPI(lifespan=lifespan)


class ChatRequest(BaseModel):
    messages: list[dict]
    max_new_tokens: int = 512
    temperature: float = 0.7
    top_p: float = 0.9


@app.post("/chat")
async def chat(req: ChatRequest):
    tok = state["tok"]
    model = state["model"]

    inputs = tok.apply_chat_template(
        req.messages, add_generation_prompt=True,
        return_tensors="pt", return_dict=True,
    ).to(model.device)

    with torch.inference_mode():
        out = model.generate(
            **inputs,
            max_new_tokens=req.max_new_tokens,
            do_sample=True,
            temperature=req.temperature,
            top_p=req.top_p,
            eos_token_id=tok.eos_token_id,
            pad_token_id=tok.pad_token_id or tok.eos_token_id,
        )
    new_tokens = out[0, inputs["input_ids"].shape[-1]:]
    return {"text": tok.decode(new_tokens, skip_special_tokens=True)}


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    tok = state["tok"]
    model = state["model"]

    inputs = tok.apply_chat_template(
        req.messages, add_generation_prompt=True,
        return_tensors="pt", return_dict=True,
    ).to(model.device)

    streamer = TextIteratorStreamer(
        tok, skip_prompt=True, skip_special_tokens=True,
    )
    gen_kwargs = dict(
        **inputs,
        max_new_tokens=req.max_new_tokens,
        do_sample=True,
        temperature=req.temperature,
        top_p=req.top_p,
        streamer=streamer,
        eos_token_id=tok.eos_token_id,
        pad_token_id=tok.pad_token_id or tok.eos_token_id,
    )

    Thread(target=model.generate, kwargs=gen_kwargs, daemon=True).start()

    async def event_stream() -> AsyncIterator[str]:
        for chunk in streamer:
            yield chunk

    return StreamingResponse(event_stream(), media_type="text/plain")
```

Run with `uvicorn server:app --host 0.0.0.0 --port 8000`.

## Limits of the in-process pattern

This is fine for:

- Internal tools / prototypes
- Single-user latency-sensitive endpoints
- Per-tenant fine-tuned models that don't need cross-request batching

It will not scale to high QPS — there is no continuous batching, no PagedAttention, no speculative decoding. For those:

## TGI quick reference

```bash
docker run --gpus all --shm-size 1g -p 8080:80 \
  -v $PWD/data:/data \
  ghcr.io/huggingface/text-generation-inference:latest \
  --model-id Qwen/Qwen2.5-7B-Instruct \
  --dtype bfloat16
```

OpenAI-compatible endpoint at `/v1/chat/completions`.

## vLLM quick reference

```bash
pip install vllm
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-7B-Instruct \
  --dtype bfloat16 \
  --port 8000
```

OpenAI-compatible endpoint at `/v1/chat/completions`. Native support for HF tokenizers, chat templates, and quantization formats (AWQ, GPTQ).

For LoRA: vLLM supports loading adapters at runtime — see vLLM docs for the per-version API.

## Picking a serving stack

```
                            ┌── single user, custom logic → FastAPI + transformers
high-throughput LLM? ───────┼── HF Hub model, OpenAI-API → TGI or vLLM
                            ├── structured outputs / agents → SGLang
                            └── on Apple Silicon → llama.cpp / mlx (GGUF)
```

## Common server gotchas

- Loading the model at request time → cold start of 30 s; always load in `lifespan` / module import
- Mixing `torch.inference_mode()` with a model in training mode → call `model.eval()` once on load
- Streaming + `concurrent` requests on the same `nn.Module` → CUDA streams collide; for true concurrency use dedicated engine (vLLM/TGI) or one model instance per worker
- Forgetting `daemon=True` on the generation thread → process won't exit cleanly
- Forgetting `pad_token_id` on causal LMs → batch generation errors
