---
name: langchain
description: "LangChain Python v1 — LLM app framework. Composable chains (LCEL/Runnable), typed structured outputs, tool calling, RAG, agents (via langgraph), streaming, LangSmith. Use when: langchain, langchain python, langchain v1, init_chat_model, with_structured_output, LCEL, Runnable, RunnablePassthrough, RunnableParallel, @tool, bind_tools, ChatPromptTemplate, MessagesPlaceholder, retriever, vectorstore, embeddings, RAG, astream_events, create_agent, AgentExecutor migration, RunnableWithMessageHistory, LangSmith, set_llm_cache. SKIP: pure Anthropic/OpenAI SDK (→claude-api / openai-sdk), graph-only orchestration (→langgraph), HTTP serving (→fastapi)."
stacks:
  - langchain
  - python
tags:
  - llm
  - langchain
  - ai
  - rag
packages:
  - langchain
  - langchain-core
  - langchain-anthropic
  - langchain-openai
  - langchain-community
  - langsmith
manifests:
  - pyproject.toml
  - requirements.txt
source: vechkasov-global-skills
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- LangChain (Python): `1.x`
- Python: `3.14.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Use this skill when

- Building LLM pipelines that compose models, prompts, retrievers, and parsers via LCEL (`prompt | model | parser`)
- Initializing chat models provider-agnostically with `init_chat_model("anthropic:claude-...")` / `init_chat_model("openai:gpt-...")`
- Forcing typed JSON output from an LLM via `model.with_structured_output(PydanticModel)`
- Defining tools with `@tool` and binding them to a chat model via `.bind_tools([...])`
- Building RAG: load docs → `RecursiveCharacterTextSplitter` → embed → `VectorStore` → `.as_retriever()` → chain
- Streaming partial tokens or LCEL semantic events with `astream` / `astream_events`
- Migrating from a v0 codebase (`AgentExecutor`, `Chain` subclassing, `.__call__`) to v1 (`create_agent`, Runnable composition, `.invoke`)
- Adding LangSmith tracing for debugging chains, tool calls, retriever hit-rate, and token-cost reporting
- Caching LLM calls with `set_llm_cache` (in-memory / SQLite / Redis semantic)

## Do not use this skill when

- The user only needs to call an Anthropic SDK or OpenAI SDK directly without chains / retrievers / tools — use `claude-api` or `openai-sdk` instead
- The task is pure graph orchestration with custom state machines, no LangChain primitives — use the `langgraph` skill (LangGraph is a separate package; `create_agent` from `langchain.agents` is built on top of it)
- Serving the chain behind HTTP — use `fastapi` for the HTTP layer and call LangChain inside the handler
- The user wants raw prompt-engineering tips with no orchestration code — use the model-vendor skill
- The codebase is locked to deprecated `AgentExecutor` and the user is not refactoring — skill bias is toward v1 idioms, not maintaining v0 hacks

## Purpose

LangChain Python 1.x is a composable framework for building LLM applications. The core abstraction is `Runnable` — anything with `.invoke()`, `.ainvoke()`, `.stream()`, `.astream()`, `.batch()` — and the `|` pipe operator that wires Runnables into chains (LCEL). On top of this, LangChain ships chat-model adapters (`langchain-anthropic`, `langchain-openai`, ...), prompt templates, output parsers, tool decorators, retriever and vector-store interfaces, plus first-class streaming and LangSmith observability.

v1 is a meaningful break from v0. The `Chain` class hierarchy is retired in favor of plain LCEL composition. The old `AgentExecutor` is deprecated; agents now come from `langchain.agents.create_agent` (built on LangGraph). `init_chat_model` is the unified provider-agnostic entry point. Memory has moved into LangGraph checkpointers — `RunnableWithMessageHistory` still exists but new code typically uses a LangGraph state graph with a checkpointer for multi-turn state. This skill codifies the v1 idioms and flags v0 anti-patterns that still appear in stale tutorials.

## Capabilities

### Provider-agnostic model init

Use `init_chat_model("provider:model-id")` instead of importing provider classes directly when you want to swap providers via config. The provider prefix selects the integration package (`anthropic`, `openai`, `google_genai`, `bedrock`, ...); install the matching `langchain-<provider>` package alongside. Both forms return a `BaseChatModel` with the same Runnable interface. See [references/models.md](references/models.md) and [references/setup.md](references/setup.md).

### LCEL (LangChain Expression Language)

Compose Runnables with `|`. `prompt | model | parser` is a Runnable itself — call `.invoke({...})`, `.batch([...])`, `.stream(...)`, `.ainvoke(...)`. Use `RunnableParallel` to fan out, `RunnablePassthrough.assign(...)` to add fields, `RunnableLambda` to wrap plain functions. Pass `config={"run_name": ..., "tags": [...], "callbacks": [...]}` to every top-level call for traceability. See [references/lcel.md](references/lcel.md).

### Prompt templates

`ChatPromptTemplate.from_messages([("system", "..."), ("human", "{q}")])` produces a Runnable that takes a dict and returns a list of `BaseMessage`. Use `MessagesPlaceholder(variable_name="history")` to inject prior turns. Few-shot prompts and prompt-hub pulls are supported. See [references/prompts.md](references/prompts.md).

### Structured output

`model.with_structured_output(MyPydanticModel)` returns a Runnable whose `.invoke()` yields a parsed Pydantic instance. Under the hood it uses provider-native JSON-schema mode (`method="json_schema"`) or tool calling depending on the provider. Prefer this over manual `json.loads` of LLM output — schema-enforced decoding catches errors at the model level. See [references/structured-output.md](references/structured-output.md).

### Tools

Decorate a function with `@tool` to expose it to a model. The docstring becomes the tool description (the LLM reads it to decide when to call), and type hints become the args schema. For complex args use `args_schema=PydanticModel`. Bind tools to a model with `model.bind_tools([t1, t2])`; the model returns `AIMessage.tool_calls`, you execute them, and feed `ToolMessage` results back. See [references/tools.md](references/tools.md).

### Retrievers and RAG

Load docs → split with `RecursiveCharacterTextSplitter` (or `MarkdownHeaderTextSplitter` for structured text) → embed → store in a `VectorStore` (Chroma, Qdrant, FAISS, pgvector via `langchain-postgres`) → `vectorstore.as_retriever()` → use the Retriever in an LCEL chain. Advanced retrievers: `MultiQueryRetriever` (LLM rephrases query N times), `ContextualCompressionRetriever` (re-rank + filter). See [references/retrievers-and-rag.md](references/retrievers-and-rag.md).

### Agents

In v1, build agents with `from langchain.agents import create_agent`. This replaces the deprecated `AgentExecutor` and the prior `langgraph.prebuilt.create_react_agent`. `create_agent` returns a LangGraph-backed runnable that supports tool calling, system prompts, and middleware. For custom graph topologies, drop down to the `langgraph` skill. See [references/agents.md](references/agents.md).

### Streaming

`.stream()` / `.astream()` yields token chunks for the leaf model call. `.astream_events()` yields semantic events for the full LCEL chain — `on_chat_model_stream`, `on_retriever_end`, `on_tool_start`, etc. — with metadata. Use callbacks (`BaseCallbackHandler` subclass) for production loggers. See [references/streaming.md](references/streaming.md).

### Memory and history

`RunnableWithMessageHistory` wraps a chain with a `BaseChatMessageHistory` (in-memory, `RedisChatMessageHistory`, `SQLChatMessageHistory`). For new code building agents, prefer a LangGraph checkpointer (`InMemorySaver`, `RedisSaver`, `PostgresSaver`) — it persists the full graph state, not only messages, and integrates with `create_agent`. Summarization memory classes from v0 are deprecated. See [references/memory.md](references/memory.md).

### Observability with LangSmith

Set `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY=...`, optionally `LANGSMITH_PROJECT=...`. Every Runnable run auto-traces. Use `config={"run_name": "...", "tags": [...]}` to label runs. Token usage and latency flow into LangSmith without extra code. See [references/observability.md](references/observability.md).

### Caching

`set_llm_cache(InMemoryCache())` for unit tests; `SQLiteCache(database_path="...")` for local dev; `RedisSemanticCache(embedding=..., redis_url=...)` for production semantic dedup. Caching only helps for deterministic prompts (low temperature, no time-varying context). See [references/caching.md](references/caching.md).

### Migration from v0

`Chain` subclassing → LCEL composition. `AgentExecutor(...)` → `create_agent(model, tools, system_prompt=...)`. `chain(input)` (calling `__call__`) → `chain.invoke(input)`. `ChatOpenAI(model_name=...)` still works but prefer `init_chat_model("openai:...")` for provider-agnostic code. `ConversationBufferMemory` → LangGraph checkpointer. See [references/migration-from-v0.md](references/migration-from-v0.md).

## Behavioral Traits

- Always initialize models via `init_chat_model("provider:model-id")` unless the project explicitly needs provider-specific constructor args
- Always use `with_structured_output(PydanticModel)` for typed output — never `json.loads(response.content)` over a free-form prompt
- Always pass `config={"run_name": "...", "tags": [...]}` on top-level `.invoke` / `.stream` calls so LangSmith traces are meaningful
- Always use `.invoke()` / `.ainvoke()` — `chain(input)` (i.e., `__call__`) is the v0 API path and is deprecated
- Prefer `.batch([...])` over a Python loop of `.invoke` — batch uses provider concurrency and shares config
- Prefer `.ainvoke` / `.astream` in async paths; never mix sync `.invoke` inside an async event loop without `asyncio.to_thread`
- Set `temperature=0` for deterministic / cacheable / test paths; raise only for creative tasks
- Use `@tool` with a clear docstring — the LLM picks tools by docstring, not by function name
- Use `RecursiveCharacterTextSplitter` as the default text splitter; switch to `MarkdownHeaderTextSplitter` for markdown
- When building agents, reach for `create_agent` first; drop to raw LangGraph only when you need custom state or branches
- Stream via `astream_events` when the UI needs to show intermediate steps (retrieval done, tool called); use `stream` only when raw tokens are enough

## Important Constraints

- NEVER subclass `Chain` for new code — the class hierarchy is retired in v1; compose Runnables with `|` instead
- NEVER use `AgentExecutor` for new code — it is deprecated; use `langchain.agents.create_agent` (which sits on LangGraph)
- NEVER parse LLM JSON output by hand when `with_structured_output` is available — schema-enforced decoding is provider-native and far more reliable
- NEVER call `chain(input)` (Runnable `__call__`) in new code — use `.invoke(input)`; `__call__` is the v0 surface and is being removed
- NEVER pass plain dicts where the chain expects messages — `ChatPromptTemplate` produces `BaseMessage` objects; bypassing the template breaks `MessagesPlaceholder` and history
- NEVER call sync `.invoke` from inside an async handler without `asyncio.to_thread` — it blocks the event loop
- NEVER assume the embedding model matches the vector store dimension — a mismatch raises at query time, not at insert time; check `Embeddings.embed_query("x")` length up front
- NEVER trace production traffic to LangSmith without setting `LANGSMITH_PROJECT` per environment — dev runs pollute the prod project
- ALWAYS install matching partner packages (`langchain-anthropic`, `langchain-openai`, `langchain-postgres`, ...) — they live outside the `langchain` core wheel
- ALWAYS pin `langchain` and `langchain-core` together — minor version skew between them causes `ImportError` on internal APIs

## Related Skills

### Parent
- `python` — language baseline (3.11+ comfort, type hints, async)

### Sibling — typed schemas
- `pydantic` — `with_structured_output` is Pydantic v2 under the hood; tool args schemas are Pydantic

### Sibling — model SDKs
- `claude-api` — Anthropic Python SDK directly, when you don't need orchestration
- `openai-sdk` — OpenAI Python SDK directly (when present)

### Sibling — transport and serving
- `httpx` — async HTTP client (LangChain uses it under the hood; configure proxies / retries via it)
- `fastapi` — serve LangChain chains behind HTTP endpoints

### Sibling — testing
- `pytest` — unit-test chains with `vcr` cassettes or `InMemoryCache` to avoid live LLM calls

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Capability map: langchain-core / langchain / langchain-community / partner packages / LangGraph | [references/REFERENCE.md](references/REFERENCE.md) |
| Install (uv) + env config + import sanity | [references/setup.md](references/setup.md) |
| `BaseChatModel`, `init_chat_model`, `.invoke` / `.ainvoke` / `.stream` / `.astream`, `bind_tools`, `with_structured_output`, callbacks | [references/models.md](references/models.md) |
| LCEL — `Runnable`, `|` pipe, `RunnablePassthrough`, `RunnableParallel`, `RunnableLambda`, `.batch` / `.map`, config dict | [references/lcel.md](references/lcel.md) |
| `ChatPromptTemplate`, `MessagesPlaceholder`, partial prompts, few-shot, prompt hub | [references/prompts.md](references/prompts.md) |
| `with_structured_output` — Pydantic v2 schemas, `method="json_schema"` vs tool-calling, raw vs parsed, multiple schemas | [references/structured-output.md](references/structured-output.md) |
| `@tool`, `BaseTool`, `args_schema`, runtime validation, `ToolMessage`, error handling | [references/tools.md](references/tools.md) |
| `Document`, splitters, `VectorStore`, embeddings, retriever protocol, MultiQuery / ContextualCompression | [references/retrievers-and-rag.md](references/retrievers-and-rag.md) |
| Agents in v1 — `create_agent`, `AgentExecutor` deprecation, LangGraph pointer, system prompt / middleware | [references/agents.md](references/agents.md) |
| `stream` / `astream` / `astream_events` / `astream_log`, callback handlers for partial output | [references/streaming.md](references/streaming.md) |
| `RunnableWithMessageHistory`, `BaseChatMessageHistory`, Redis / SQL backends, LangGraph checkpointer alternative | [references/memory.md](references/memory.md) |
| LangSmith env vars, run names / tags, token usage, cost tracking, tracing decorator | [references/observability.md](references/observability.md) |
| `set_llm_cache` — `InMemoryCache`, `SQLiteCache`, `RedisSemanticCache`, when caching helps | [references/caching.md](references/caching.md) |
| v0 → v1 migration: Chain hierarchy, AgentExecutor → create_agent, `.invoke` over `.__call__`, init_chat_model | [references/migration-from-v0.md](references/migration-from-v0.md) |
| Troubleshooting: rate limits, tool-call shape mismatch, structured-output parse fail, retriever empty, dim mismatch, async/sync mix, streaming flush | [references/troubleshooting.md](references/troubleshooting.md) |
| Recommended defaults: `init_chat_model` provider prefix, `temperature=0`, `run_name` always, `with_structured_output` over JSON parsing | [references/recommended-defaults.md](references/recommended-defaults.md) |
| Wrong vs right code pairs — Chain subclassing, manual JSON parse, AgentExecutor, `__call__`, sync-in-async | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases — routing prompts to verify this skill loads on the right tasks | [references/eval-cases.md](references/eval-cases.md) |

**How to use**: open the specific topic file. Don't read all references — load only what the active task needs.
