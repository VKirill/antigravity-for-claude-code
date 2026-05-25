# Troubleshooting

## ImportError after upgrade

```
ImportError: cannot import name 'init_chat_model' from 'langchain.chat_models'
```

- Cause: stale `langchain` or `langchain-core`.
- Fix: upgrade both together; they share internal APIs and skew breaks imports.

```
cannot import name 'ChatOpenAI' from 'langchain.chat_models'
```

- Cause: the integration was split out.
- Fix: `from langchain_openai import ChatOpenAI`, and install `langchain-openai`.

## Provider rate limits

```
RateLimitError: 429 Too Many Requests
```

Wrap with retry/backoff:

```python
chain = (prompt | model).with_retry(
    stop_after_attempt=5,
    wait_exponential_jitter=True,
    retry_if_exception_type=(RateLimitError,),
)
```

Don't retry-blind on side-effectful tools — duplicate tool calls. Apply retry at the model level, not the agent level.

For sustained pressure, use `.batch(..., config={"max_concurrency": N})` to cap parallelism instead of unbounded async fan-out.

## Tool-call shape mismatch

Symptom: model returns `tool_calls=[]` despite a clear request, or `AIMessage.content` contains a JSON-looking string instead of a structured tool call.

Causes and fixes:

- Tool docstring is missing or unclear — the LLM picks tools by docstring. Rewrite for the model.
- `bind_tools` not actually called on the model passed to the chain — verify `model.bind_tools([...])` is the instance in use.
- Provider doesn't support tool calling for the chosen model — check provider docs; fall back to JSON-mode structured output.
- `tool_choice="auto"` and the model decided it didn't need a tool — that's correct behavior. Force with `tool_choice="<tool_name>"` only when appropriate.

## `with_structured_output` parse failure

```
OutputParserException / ValidationError
```

- Cause: model emitted invalid JSON or fields don't match schema.
- Fixes:
  - Use `include_raw=True` and handle `parsing_error` gracefully
  - Switch `method`: try `"json_schema"` (most reliable when supported) over `"function_calling"`
  - Tighten the Pydantic field descriptions — vague fields produce off-schema output
  - Lower `temperature` to 0 for extraction tasks
  - Add `.with_retry(retry_if_exception_type=(OutputParserException,))` for transient flakiness

## Retriever returns empty results

Common causes:

1. **Embedding dimension mismatch** between the embedding model and the vector store column. Check `len(embeddings.embed_query("x"))` matches store config. Always set up the store with the embedding's dim.
2. **Wrong collection / namespace** — the retriever points at an empty collection.
3. **Metadata filter excludes everything** — log `search_kwargs["filter"]` and the per-document metadata.
4. **Score threshold too high** — for `similarity_score_threshold`, lower the threshold until you see results, then tune up.
5. **k=0 by accident** — common typo with `search_kwargs={"k": 0}`.

Debug with raw vector store: `vs.similarity_search_with_score("q", k=10)` shows scores; if everything is far, the query and corpus don't match semantically.

## Embedding dimension mismatch

```
ValueError: Embeddings have dimension 1536 but collection has 768
```

- The vector store was created with one embedding model; you're querying with another.
- Fix: re-index with the current embedding model, or switch back. Don't mix.

## Async / sync mixing

Symptom: hangs, `RuntimeError: This event loop is already running`, or sync calls inside async produce sluggish handlers.

Fixes:

- Inside an `async def` handler, always use `.ainvoke` / `.astream` / `.abatch`
- If a Runnable doesn't implement async (rare), wrap with `await asyncio.to_thread(chain.invoke, x)`
- Don't call `asyncio.run(...)` from inside an already-running loop (e.g. inside FastAPI)
- For Jupyter, use `await chain.ainvoke(...)` directly — the cell loop is fine

## Streaming buffer not flushing

Symptom: tokens arrive in one big chunk at the end instead of streaming.

- Some output parsers buffer until the full output arrives (e.g. PydanticOutputParser). Use `StrOutputParser` for true token streaming, or use `astream_events` to subscribe to the model layer directly.
- Make sure no middleware buffers — `httpx` with no streaming-aware transport will buffer.
- For FastAPI, use `StreamingResponse` / `EventSourceResponse`; don't `return chain.invoke(...)` if you wanted streaming.

## Token-limit / context-window overflow

Symptom: model returns truncated output, or errors with "context length exceeded".

- Reduce `max_tokens` to leave room for output
- Trim chat history before sending — implement a head-truncation or summarization step
- For RAG, lower `k` or chunk size, or use a re-ranker to fit more relevant content in less space

## LangSmith traces missing

- Verify `LANGSMITH_TRACING=true` is set in the process env (not just the shell that started it — check PM2 / systemd env)
- Verify `LANGSMITH_API_KEY` is valid (`langsmith` CLI: `langsmith projects list`)
- For background workers, env vars must be inherited — `pm2 ecosystem.config.js` `env:` block, not just `.bashrc`

## Tool call from agent never returns

- Agent loops if tool always errors and the model keeps retrying. Set a recursion limit:

```python
agent.invoke({"messages": [...]}, config={"recursion_limit": 10})
```

- Make tool errors descriptive — `raise ValueError("missing arg 'x'")` not `raise Exception("error")` — so the model can self-correct.

## `chain(input)` is deprecated

```
DeprecationWarning: The __call__ method on Runnable is deprecated; use .invoke()
```

- Fix: replace `chain(x)` with `chain.invoke(x)` everywhere. See [migration-from-v0.md](migration-from-v0.md).
