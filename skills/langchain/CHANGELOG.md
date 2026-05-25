# Changelog

## 1.0.0

Initial release. LangChain Python v1 skill.

Highlights of v1 codified here:

- `init_chat_model("provider:model")` as the unified provider-agnostic model entry point.
- LCEL (`Runnable`, `|` pipe, `RunnablePassthrough`, `RunnableParallel`, `RunnableLambda`, `.batch`, `.astream_events`) as the composition language; old `Chain` hierarchy retired.
- `model.with_structured_output(PydanticSchema)` as the canonical typed-output API; manual `json.loads` flagged as anti-pattern.
- `@tool` + `model.bind_tools([...])` for tool calling.
- `langchain.agents.create_agent` as the agent constructor; `AgentExecutor` and `langgraph.prebuilt.create_react_agent` both deprecated.
- `RunnableWithMessageHistory` for chain-with-history; LangGraph checkpointer (`InMemorySaver`, `RedisSaver`, `PostgresSaver`) preferred for agents.
- `astream_events(version="v2")` for semantic LCEL streaming events.
- LangSmith tracing via env vars; `run_name` + `tags` + `metadata` on every top-level call.
- `set_llm_cache` with `InMemoryCache`, `SQLiteCache`, `RedisCache`, `RedisSemanticCache`.
- Migration guide v0 → v1: `.invoke` over `.__call__` / `.run`, LCEL over `Chain` subclasses, `create_agent` over `AgentExecutor`, checkpointer over `ConversationBufferMemory`.

Pattern 2 layout. Risk: medium-stakes (LLM correctness and cost).
