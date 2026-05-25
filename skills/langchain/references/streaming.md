# Streaming

Three streaming APIs. Pick by what your UI needs.

## `.stream()` / `.astream()` — token chunks

```python
for chunk in chain.stream({"q": "..."}):
    print(chunk.content, end="", flush=True)

async for chunk in chain.astream({"q": "..."}):
    print(chunk.content, end="", flush=True)
```

Yields chunks from the **leaf model** call. For a `prompt | model | parser` chain, the chunks come from the model; the parser sees the full output at the end. Use when the UI only needs raw token deltas.

## `.astream_events()` — semantic LCEL events

```python
async for event in chain.astream_events({"q": "..."}, version="v2"):
    kind = event["event"]
    name = event.get("name")
    data = event.get("data", {})

    if kind == "on_chat_model_stream":
        print(data["chunk"].content, end="", flush=True)
    elif kind == "on_retriever_end":
        print(f"\n[retrieved {len(data['output'])} docs]")
    elif kind == "on_tool_start":
        print(f"\n[tool: {name}({data.get('input')})]")
    elif kind == "on_tool_end":
        print(f"\n[result: {data.get('output')}]")
    elif kind == "on_chain_end" and name == "AgentExecutor":
        print(f"\n[done]")
```

Event kinds:

- `on_chat_model_start` / `on_chat_model_stream` / `on_chat_model_end`
- `on_chain_start` / `on_chain_stream` / `on_chain_end` — every Runnable in the LCEL graph
- `on_retriever_start` / `on_retriever_end`
- `on_tool_start` / `on_tool_end`
- `on_prompt_start` / `on_prompt_end`

Always pass `version="v2"` — `v1` is legacy. Filter events by `name`, `tags`, or `event` kind to keep the loop simple.

Use `astream_events` when the UI needs to show intermediate steps (e.g. "Searching... Calling tool... Composing answer...").

## `.astream_log()` — full deltas

```python
async for chunk in chain.astream_log({"q": "..."}):
    # chunk is a RunLogPatch — JSON Patch operations against a RunLog tree
    ...
```

Returns JSON Patch deltas of the run tree. Powerful but verbose; prefer `astream_events` unless you specifically need patch-based UI updates (e.g. piping straight to a JSON-Patch-aware frontend).

## Callbacks

For non-streaming logging or production handlers, implement `BaseCallbackHandler`:

```python
from langchain_core.callbacks import BaseCallbackHandler

class LoggingHandler(BaseCallbackHandler):
    def on_chat_model_start(self, serialized, messages, **kwargs):
        print(f"Model start: {len(messages[0])} messages")

    def on_llm_new_token(self, token: str, **kwargs):
        print(token, end="", flush=True)

    def on_tool_start(self, serialized, input_str, **kwargs):
        print(f"Tool: {serialized.get('name')}({input_str})")

chain.invoke({"q": "..."}, config={"callbacks": [LoggingHandler()]})
```

Async variants: `on_chat_model_start` → `aon_chat_model_start`. Use `AsyncCallbackHandler` base when handlers do I/O.

## Streaming structured output

```python
structured = model.with_structured_output(Schema)
for chunk in structured.stream("..."):
    # Each chunk is a partial Schema instance; last one is complete
    print(chunk)
```

Useful for UIs that fill fields as they arrive.

## Tip — name your runs

When streaming events from a complex graph, set `run_name` so you can filter:

```python
chain.with_config({"run_name": "rag-pipeline"}).astream_events(...)
```

Then `if event["name"] == "rag-pipeline" and event["event"] == "on_chain_end": ...` gives you the final output cleanly.
