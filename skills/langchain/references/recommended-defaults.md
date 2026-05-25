# Recommended Defaults

Single source of truth for the knobs that recur across LangChain code. Override only with a reason.

## Model init

- **Use `init_chat_model("provider:model")`** for new code unless you need provider-specific constructor kwargs not on the unified API.
- **`temperature=0`** for extraction, classification, structured output, tool calling, RAG answering. Raise only for creative tasks.
- **`max_tokens`** explicit, sized to your output budget. Don't rely on provider default — it varies.
- **`timeout`** explicit (e.g. 30s for sync UI calls, 120s for batch). Never `None`.

## Structured output

- **Always `with_structured_output(PydanticSchema)`** for typed output. Never `json.loads(response.content)`.
- **Prefer `method="json_schema"`** when the provider supports it — most reliable.
- **`include_raw=True`** in production paths where you want to log raw output even on parse success or fall back on parse error.
- **Lower `temperature` to 0** specifically for the structured call.

## Tools

- **Docstring is the contract** — write it for the LLM. Include arg descriptions, units, examples.
- **Type hints on every arg.** No `**kwargs`.
- **`tool_choice="auto"`** by default. Force a tool only when business logic demands it.
- **Tool errors are descriptive** — `ValueError("missing 'x'")`, not `Exception("error")`.

## LCEL

- **Pass `config={"run_name": "...", "tags": [...]}`** on every top-level `.invoke` / `.stream`. Always.
- **Prefer `.batch([...])` over a `for` loop** of `.invoke`. Set `max_concurrency` in `config`.
- **Use `.ainvoke` / `.astream` in async paths.** Wrap sync Runnables with `asyncio.to_thread` if needed.
- **Wrap with `.with_retry()`** for transient errors at the model level — not at the chain level if the chain has side-effectful tools.

## Streaming

- **`astream_events(..., version="v2")`** when the UI shows intermediate steps.
- **`astream`** when only raw tokens are needed.
- **Always pass `version="v2"`** to `astream_events`. v1 is legacy.

## RAG

- **`RecursiveCharacterTextSplitter`** as the default splitter. `chunk_size=1000`, `chunk_overlap=100–200`.
- **`MarkdownHeaderTextSplitter`** for markdown / docs.
- **Retriever defaults** — `search_type="mmr"`, `search_kwargs={"k": 4, "fetch_k": 20}`. Retrieve wider for re-rankers.
- **Re-rank with a cross-encoder** for production RAG — better than LLM-based compression at lower cost.
- **Verify embedding dim** before insert — `len(embeddings.embed_query("x"))`.

## Agents

- **`create_agent(model, tools, system_prompt=...)`** for new agents. Not `AgentExecutor`.
- **`checkpointer=` for multi-turn** — `InMemorySaver` in tests, Redis/Postgres in prod.
- **Set `recursion_limit`** in config to bound agent loops (e.g. 10–25 depending on task).

## Memory

- **LangGraph checkpointer** for agent state. `RunnableWithMessageHistory` for simple chain-with-history.
- **TTL on Redis stores** (e.g. 24h–7d) — chat history isn't append-forever.
- **Custom summarization** when context budgets tighten — build it as a Runnable, don't reach for deprecated `Summary*Memory`.

## Caching

- **Off by default.** Enable only when prompts are deterministic and replayable.
- **`InMemoryCache`** in unit tests; **`SQLiteCache`** for dev; **`RedisSemanticCache`** in prod when hit rate justifies it.
- **Score threshold for semantic cache** — start at `0.2` cosine distance, tune empirically.

## Observability

- **`LANGSMITH_TRACING=true`** + per-environment `LANGSMITH_PROJECT`. Always.
- **`run_name`** descriptive (`"rag-answer"`, not `"chain"`).
- **`tags`** for routing (`["prod", "tenant-acme"]`).
- **`metadata`** carries request_id, user_id (for filtering and PII redaction at trace time).

## Imports

- **Pin `langchain` and `langchain-core` together** in `pyproject.toml`. Skew causes import errors.
- **Use partner packages** (`langchain-anthropic`, `langchain-openai`, …) directly when possible — `langchain-community` is the long-tail.

## Async hygiene

- **Inside `async def`**: only `await ainvoke / astream / abatch`. Never sync `.invoke` without `to_thread`.
- **FastAPI handlers** that stream: use `StreamingResponse` or `EventSourceResponse`. Don't `return chain.invoke(...)`.
