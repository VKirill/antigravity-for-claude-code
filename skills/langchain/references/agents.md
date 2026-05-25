# Agents in LangChain v1

In v1, agents come from `langchain.agents.create_agent`. The old `AgentExecutor` and the prior `langgraph.prebuilt.create_react_agent` are deprecated.

## Quick start

```python
from langchain.chat_models import init_chat_model
from langchain.agents import create_agent
from langchain_core.tools import tool

@tool
def get_weather(city: str) -> str:
    """Return current weather for a city."""
    return f"Sunny in {city}"

@tool
def search(query: str) -> str:
    """Search the web."""
    return f"Results for {query}"

model = init_chat_model("anthropic:claude-haiku-4-5")

agent = create_agent(
    model=model,
    tools=[get_weather, search],
    system_prompt="You are a helpful research assistant.",
)

result = agent.invoke({
    "messages": [{"role": "user", "content": "What's the weather in Paris?"}],
})

# Final response is in the last message
print(result["messages"][-1].content)
```

`create_agent` returns a LangGraph-backed Runnable. Input is `{"messages": [...]}`, output is the full message history including tool calls and tool results.

## Streaming an agent

```python
async for event in agent.astream_events(
    {"messages": [{"role": "user", "content": "weather in Tokyo?"}]},
    version="v2",
):
    kind = event["event"]
    if kind == "on_tool_start":
        print(f"Calling tool {event['name']}")
    elif kind == "on_chat_model_stream":
        chunk = event["data"]["chunk"]
        print(chunk.content, end="", flush=True)
```

See [streaming.md](streaming.md).

## Memory / multi-turn

`create_agent` integrates with LangGraph checkpointers:

```python
from langgraph.checkpoint.memory import InMemorySaver

checkpointer = InMemorySaver()
agent = create_agent(model, tools, checkpointer=checkpointer)

config = {"configurable": {"thread_id": "user-42"}}
agent.invoke({"messages": [{"role": "user", "content": "hi, I'm Bob"}]}, config)
agent.invoke({"messages": [{"role": "user", "content": "what's my name?"}]}, config)
# Second call remembers Bob via the checkpointer
```

For production, swap `InMemorySaver` for `RedisSaver` or `PostgresSaver` (from `langgraph-checkpoint-redis` / `langgraph-checkpoint-postgres`).

## What replaced what

| v0 / older | v1 |
|---|---|
| `AgentExecutor(...)` | `create_agent(model, tools, system_prompt=...)` |
| `initialize_agent(...)` | `create_agent` |
| `langgraph.prebuilt.create_react_agent` | `langchain.agents.create_agent` |
| `create_tool_calling_agent` (the helper, not the executor) | `create_agent` |
| `ConversationBufferMemory` | LangGraph checkpointer |

The v1 `create_agent` is itself built on LangGraph and exposes a richer middleware API than the deprecated executors.

## When to drop down to LangGraph

`create_agent` is a single tool-calling loop. Drop down to the `langgraph` package (separate skill) when you need:

- Custom graph topology — branches, joins, parallel agents
- Human-in-the-loop gates between steps
- Time-travel / replay from a specific checkpoint
- Long-running stateful workflows with explicit nodes per phase
- Multi-agent coordination with shared state

Calling `agent.get_graph().draw_mermaid()` shows the underlying graph if you want to inspect it.

## Migration from AgentExecutor

```python
# v0 — DEPRECATED
from langchain.agents import AgentExecutor, create_tool_calling_agent
agent_runnable = create_tool_calling_agent(model, tools, prompt)
executor = AgentExecutor(agent=agent_runnable, tools=tools, verbose=True)
result = executor.invoke({"input": "..."})

# v1 — current
from langchain.agents import create_agent
agent = create_agent(model, tools, system_prompt="...")
result = agent.invoke({"messages": [{"role": "user", "content": "..."}]})
```

Note the input shape changed: `{"input": "..."}` → `{"messages": [...]}`.

## System prompt vs prompt template

`create_agent` takes a `system_prompt: str` (or callable) directly — no `ChatPromptTemplate`. The agent constructs the message list internally with the system prompt + the conversation. If you need richer templating, pre-format and pass via the first message.
