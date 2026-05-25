# Memory and Chat History

Two paths in v1:

1. **`RunnableWithMessageHistory`** — wrap a chain with a per-thread message store. Lightweight, message-only.
2. **LangGraph checkpointer** — persist the full graph state across turns. Preferred for new agent code (`create_agent` integrates directly).

Summarization memory classes from v0 (`ConversationSummaryMemory`, etc.) are deprecated.

## RunnableWithMessageHistory

```python
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are concise."),
    MessagesPlaceholder("history"),
    ("human", "{question}"),
])

chain = prompt | model

store: dict[str, InMemoryChatMessageHistory] = {}

def get_history(session_id: str) -> InMemoryChatMessageHistory:
    if session_id not in store:
        store[session_id] = InMemoryChatMessageHistory()
    return store[session_id]

with_history = RunnableWithMessageHistory(
    chain,
    get_session_history=get_history,
    input_messages_key="question",
    history_messages_key="history",
)

config = {"configurable": {"session_id": "user-42"}}
with_history.invoke({"question": "hi, I'm Bob"}, config)
with_history.invoke({"question": "what's my name?"}, config)
```

The store callback is yours — implement it against Redis / SQL / Postgres for persistence.

## Redis-backed history

```python
from langchain_community.chat_message_histories import RedisChatMessageHistory

def get_history(session_id: str):
    return RedisChatMessageHistory(
        session_id=session_id,
        url="redis://localhost:6379",
        ttl=86400,   # 1 day
    )
```

## SQL-backed history

```python
from langchain_community.chat_message_histories import SQLChatMessageHistory

def get_history(session_id: str):
    return SQLChatMessageHistory(
        session_id=session_id,
        connection="postgresql+psycopg://user:pass@host/db",
    )
```

## Postgres-backed (first-party)

```python
from langchain_postgres import PostgresChatMessageHistory
# similar API, lives in langchain-postgres
```

## LangGraph checkpointer (preferred for agents)

A checkpointer persists the full graph state — messages plus any custom keys — keyed by `thread_id`:

```python
from langchain.agents import create_agent
from langgraph.checkpoint.memory import InMemorySaver

checkpointer = InMemorySaver()
agent = create_agent(model, tools, checkpointer=checkpointer)

config = {"configurable": {"thread_id": "user-42"}}
agent.invoke({"messages": [{"role": "user", "content": "hi, I'm Bob"}]}, config)
agent.invoke({"messages": [{"role": "user", "content": "what's my name?"}]}, config)
```

Production backends:

- `langgraph.checkpoint.memory.InMemorySaver` — dev / tests
- `langgraph-checkpoint-postgres` — `PostgresSaver` / `AsyncPostgresSaver`
- `langgraph-checkpoint-redis` — `RedisSaver` / `AsyncRedisSaver`
- `langgraph-checkpoint-sqlite` — `SqliteSaver`

Call `.setup()` once on first use to create tables/keys.

## When to use which

| Need | Use |
|---|---|
| Chat history only, single chain, simple | `RunnableWithMessageHistory` |
| Agent with tools, multi-turn | LangGraph checkpointer via `create_agent` |
| Full graph state (custom keys, time-travel) | LangGraph checkpointer (direct) |
| Summarization of old turns | Implement explicitly — write a Runnable that summarizes the head of history when it exceeds a budget |

## Summarization (build-it-yourself)

The old `ConversationSummaryBufferMemory` is gone. Build it as a Runnable:

```python
def trim_and_summarize(messages: list, budget_tokens: int = 4000):
    # 1. count tokens
    # 2. if over budget, take the first N old messages
    # 3. call model with "summarize these: ..." -> SystemMessage
    # 4. return [summary_system_msg, *recent_messages]
    ...
```

Wire it before the prompt in the LCEL chain.
