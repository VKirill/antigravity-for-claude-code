# Chat Models

All chat models implement `BaseChatModel` and the full `Runnable` interface.

## Provider-agnostic init

```python
from langchain.chat_models import init_chat_model

model = init_chat_model("anthropic:claude-haiku-4-5")
# Equivalent:
# model = init_chat_model(model="claude-haiku-4-5", model_provider="anthropic")
```

Provider prefix selects the integration package. Equivalent direct construction:

```python
from langchain_anthropic import ChatAnthropic
model = ChatAnthropic(model="claude-haiku-4-5")
```

Use `init_chat_model` when the project may swap providers (config-driven). Use the concrete class when you need provider-specific constructor kwargs that aren't on the unified API.

## Calling the model

```python
# Sync
response = model.invoke("What is 2+2?")
print(response.content)               # str
print(response.usage_metadata)        # tokens

# Async
response = await model.ainvoke("What is 2+2?")

# Batch (uses provider concurrency)
results = model.batch(["q1", "q2", "q3"])

# Streaming (token deltas)
for chunk in model.stream("Tell a joke"):
    print(chunk.content, end="", flush=True)

# Async streaming
async for chunk in model.astream("Tell a joke"):
    print(chunk.content, end="", flush=True)
```

## Message types

```python
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage

model.invoke([
    SystemMessage("You are concise."),
    HumanMessage("Capital of France?"),
])
```

Plain strings, dicts (`{"role": "user", "content": "..."}`), and `BaseMessage` lists are all accepted.

## Config knobs

```python
model = init_chat_model(
    "anthropic:claude-haiku-4-5",
    temperature=0,           # deterministic
    max_tokens=1024,
    timeout=30,
)
```

Most provider kwargs flow through. For provider-specific knobs not on the unified API, fall back to the concrete class.

## Per-call config

```python
response = model.invoke(
    "Hello",
    config={
        "run_name": "greet-user",
        "tags": ["prod", "v1"],
        "callbacks": [my_handler],
        "metadata": {"user_id": "u-123"},
    },
)
```

`run_name` and `tags` show up in LangSmith. Set them on every top-level call.

## Tool binding

```python
from langchain_core.tools import tool

@tool
def get_weather(city: str) -> str:
    """Return the current weather for a city."""
    return f"Sunny in {city}"

model_with_tools = model.bind_tools([get_weather])
response = model_with_tools.invoke("What's the weather in Paris?")
# response.tool_calls -> [{"name": "get_weather", "args": {"city": "Paris"}, "id": "..."}]
```

See [tools.md](tools.md) for the full tool-calling loop.

## Structured output

```python
from pydantic import BaseModel

class Answer(BaseModel):
    summary: str
    confidence: float

structured = model.with_structured_output(Answer)
result: Answer = structured.invoke("Summarize quantum entanglement in one line.")
```

See [structured-output.md](structured-output.md).

## Configurable fields (runtime swap)

```python
from langchain_core.runnables import ConfigurableField

model = init_chat_model("anthropic:claude-haiku-4-5").configurable_fields(
    model_name=ConfigurableField(id="model_name"),
    temperature=ConfigurableField(id="temperature"),
)
model.with_config({"configurable": {"model_name": "claude-sonnet-4-6", "temperature": 0.7}}).invoke("...")
```

Useful for A/B tests and per-tenant model choice.
