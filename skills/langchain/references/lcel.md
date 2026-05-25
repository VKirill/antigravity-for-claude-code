# LCEL — LangChain Expression Language

Everything in LangChain is a `Runnable`. Runnables compose with `|`. That's the whole language.

## The Runnable interface

Every Runnable exposes:

- `.invoke(input, config=None)` — sync, single
- `.ainvoke(input, config=None)` — async, single
- `.batch(inputs, config=None)` — sync, list
- `.abatch(inputs, config=None)` — async, list
- `.stream(input, config=None)` — sync iterator of chunks
- `.astream(input, config=None)` — async iterator
- `.astream_events(input, config=None)` — semantic LCEL events
- `.with_config(config)` — bake config in
- `.with_retry(...)` / `.with_fallbacks([...])` — resilience wrappers

## Pipe composition

```python
from langchain.chat_models import init_chat_model
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

prompt = ChatPromptTemplate.from_messages([
    ("system", "You translate to {language}."),
    ("human", "{text}"),
])
model = init_chat_model("anthropic:claude-haiku-4-5")
chain = prompt | model | StrOutputParser()

chain.invoke({"language": "French", "text": "Hello"})
# -> "Bonjour"
```

The chain itself is a Runnable. You can pipe it into another chain.

## Building blocks

### RunnablePassthrough — identity / assignment

```python
from langchain_core.runnables import RunnablePassthrough

# Identity
RunnablePassthrough().invoke({"a": 1})   # {"a": 1}

# Assign a new field computed from input
chain = RunnablePassthrough.assign(
    upper=lambda x: x["text"].upper(),
)
chain.invoke({"text": "hi"})   # {"text": "hi", "upper": "HI"}
```

Used heavily in RAG to thread context through the chain.

### RunnableParallel — fan-out

```python
from langchain_core.runnables import RunnableParallel

parallel = RunnableParallel(
    summary=summary_chain,
    sentiment=sentiment_chain,
)
parallel.invoke({"text": "..."})
# -> {"summary": "...", "sentiment": "positive"}
```

Branches run concurrently when async. Dict literal `{...}` inside a pipe is auto-promoted to `RunnableParallel`.

### RunnableLambda — wrap a function

```python
from langchain_core.runnables import RunnableLambda

upper = RunnableLambda(lambda x: x.upper())
(upper | model).invoke("hello")
```

Use for one-off transforms inside a chain. Async functions are supported automatically.

### Pipe a plain function

```python
chain = prompt | model | (lambda msg: msg.content.strip())
```

LangChain auto-wraps callables when they appear in a `|` chain.

## Config dict

Every `.invoke`/`.stream`/`.batch` accepts a `config`:

```python
chain.invoke(
    {"text": "..."},
    config={
        "run_name": "translate-fr",      # appears in LangSmith
        "tags": ["prod"],
        "metadata": {"req_id": "abc"},
        "callbacks": [my_handler],
        "max_concurrency": 5,             # batch / map
        "configurable": {...},            # for ConfigurableField
    },
)
```

`config` is propagated to every Runnable in the chain — child runs inherit parent tags / callbacks.

## Batch with concurrency

```python
chain.batch(
    [{"text": t} for t in many_texts],
    config={"max_concurrency": 8},
)
```

`.batch` is far better than a Python `for` loop — it uses provider-side parallelism plus async fan-out.

## .map() for per-element

```python
list_chain = chain.map()        # wraps the chain to operate on a list
list_chain.invoke([{"text": "a"}, {"text": "b"}])
```

## Resilience

```python
robust = chain.with_retry(
    stop_after_attempt=3,
    wait_exponential_jitter=True,
)
robust = chain.with_fallbacks([fallback_chain])
```

Use sparingly — retries on non-idempotent tool calls can double-charge.

## Custom Runnable via @chain decorator

```python
from langchain_core.runnables import chain

@chain
def my_runnable(inp: dict) -> str:
    result = some_chain.invoke(inp)
    return result.upper()
```

`@chain` makes a function into a Runnable so it composes with `|` and inherits config propagation.
