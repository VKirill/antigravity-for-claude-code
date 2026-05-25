# Tools

Tools are Python callables exposed to the LLM. The LLM decides when to call them; you execute the call and feed the result back.

## @tool decorator

```python
from langchain_core.tools import tool

@tool
def get_weather(city: str) -> str:
    """Return the current weather for a given city.

    Args:
        city: The city name to look up.
    """
    return f"Sunny in {city}, 22°C"
```

- The **docstring** is the tool description — the LLM picks tools based on this. Write it for the model, not for humans.
- Type hints become the args schema (via Pydantic under the hood).
- Return value can be a string, dict, or `ToolMessage` — strings are most common.

## @tool with explicit name and schema

```python
from pydantic import BaseModel, Field

class WeatherInput(BaseModel):
    city: str = Field(description="City name, e.g. 'Paris'")
    units: str = Field(default="celsius", description="'celsius' or 'fahrenheit'")

@tool("get_weather", args_schema=WeatherInput)
def get_weather(city: str, units: str = "celsius") -> str:
    """Return current weather."""
    return f"22°{units[0].upper()} in {city}"
```

Use `args_schema` when you need custom validation or richer field descriptions.

## Binding tools

```python
model_with_tools = model.bind_tools([get_weather, get_news])

response = model_with_tools.invoke("What's the weather in Paris?")
print(response.tool_calls)
# [{"name": "get_weather", "args": {"city": "Paris"}, "id": "call_abc"}]
```

`response.tool_calls` is a list of `{name, args, id, type}` dicts. `response.content` may be empty when the model only emits tool calls.

## Manual tool-calling loop

```python
from langchain_core.messages import HumanMessage, ToolMessage

messages = [HumanMessage("What's the weather in Paris?")]
ai_msg = model_with_tools.invoke(messages)
messages.append(ai_msg)

for call in ai_msg.tool_calls:
    if call["name"] == "get_weather":
        result = get_weather.invoke(call["args"])
        messages.append(ToolMessage(content=result, tool_call_id=call["id"]))

final = model_with_tools.invoke(messages)
print(final.content)
```

For most apps use `create_agent` instead (see [agents.md](agents.md)) — it runs this loop until the model stops calling tools.

## Force a specific tool

```python
model.bind_tools([get_weather], tool_choice="get_weather")
model.bind_tools([get_weather], tool_choice="any")   # any tool, but must call one
model.bind_tools([get_weather], tool_choice="auto")  # default — model decides
```

## BaseTool subclass

For tools with stateful resources (DB pool, HTTP client) or async logic:

```python
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field

class SearchInput(BaseModel):
    query: str = Field(description="Search query")
    k: int = Field(default=5, description="Max results")

class SearchTool(BaseTool):
    name: str = "search"
    description: str = "Search the company knowledge base."
    args_schema: type[BaseModel] = SearchInput

    def _run(self, query: str, k: int = 5) -> str:
        return self.client.search(query, top_k=k)

    async def _arun(self, query: str, k: int = 5) -> str:
        return await self.client.asearch(query, top_k=k)
```

Implement `_arun` for async paths — otherwise async callers will block in `to_thread`.

## Tool error handling

By default, an exception raised in a tool propagates up and aborts the chain. Configure:

```python
@tool(return_direct=False)
def risky(x: int) -> int:
    """Divide 100 by x."""
    return 100 // x

# In an agent, set handle_tool_errors=True on the executor / agent
```

For `create_agent`, the agent will receive the exception as a `ToolMessage` and decide whether to retry, fix args, or give up.

## InjectedToolArg (advanced)

```python
from typing_extensions import Annotated
from langchain_core.tools import InjectedToolArg

@tool
def lookup(user_id: Annotated[str, InjectedToolArg], query: str) -> str:
    """Look something up for a user."""
    ...
```

`user_id` is injected from the caller's context, not from the LLM — the LLM only sees `query` in the schema. Useful for passing trusted runtime context (tenant ID, auth).
