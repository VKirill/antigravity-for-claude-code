# Wrong vs Right

Pattern pairs surfaced from real v1 code reviews. Each shows the anti-pattern, the canonical fix, and why.

## Manual JSON parsing vs `with_structured_output`

```python
# WRONG — fragile, fails on code fences, prose preamble, or quote escaping
import json
response = model.invoke("Return a JSON object: " + prompt)
data = json.loads(response.content)
title = data["title"]
```

```python
# RIGHT — schema-enforced, provider-native, validates types
from pydantic import BaseModel

class Result(BaseModel):
    title: str
    year: int

structured = model.with_structured_output(Result)
data: Result = structured.invoke(prompt)
title = data.title
```

Why: `with_structured_output` uses provider-native structured output or tool calling. Returns a Pydantic instance with validated types. Manual parsing breaks the moment the model adds a sentence of explanation before the JSON.

## `AgentExecutor` vs `create_agent`

```python
# WRONG — deprecated in v1
from langchain.agents import AgentExecutor, create_tool_calling_agent
runnable = create_tool_calling_agent(model, tools, prompt)
executor = AgentExecutor(agent=runnable, tools=tools, verbose=True)
result = executor.invoke({"input": "weather in Paris"})
```

```python
# RIGHT — v1 idiom
from langchain.agents import create_agent

agent = create_agent(model, tools, system_prompt="You are a helpful assistant.")
result = agent.invoke({"messages": [{"role": "user", "content": "weather in Paris"}]})
```

Why: `AgentExecutor` is deprecated. `create_agent` is built on LangGraph, supports checkpointers natively, and exposes middleware.

## Chain subclassing vs LCEL composition

```python
# WRONG — Chain hierarchy is retired in v1
from langchain.chains.base import Chain

class TranslateChain(Chain):
    @property
    def input_keys(self): return ["text", "language"]
    @property
    def output_keys(self): return ["translation"]
    def _call(self, inputs):
        msg = prompt.format(**inputs)
        result = model.invoke(msg)
        return {"translation": result.content}
```

```python
# RIGHT — compose Runnables
chain = prompt | model | StrOutputParser()
result = chain.invoke({"text": "...", "language": "French"})
```

Why: LCEL chains are themselves Runnables — batchable, streamable, traceable, async-capable for free. Chain subclasses miss most of this.

## `.run` / `__call__` vs `.invoke`

```python
# WRONG — deprecated call paths
chain.run("hello")
chain("hello")
chain({"q": "hello"})
```

```python
# RIGHT — Runnable API
chain.invoke("hello")
chain.invoke({"q": "hello"})
```

Why: `__call__` and `.run` are v0 surface. `.invoke` is the single unified entry point; pairs with `.ainvoke`, `.batch`, `.stream`, `.with_retry`.

## Sync inside async vs `.ainvoke`

```python
# WRONG — blocks the event loop
@app.post("/answer")
async def answer(q: str):
    return chain.invoke({"q": q})        # sync call inside async handler
```

```python
# RIGHT
@app.post("/answer")
async def answer(q: str):
    return await chain.ainvoke({"q": q})
```

Why: sync `.invoke` blocks the event loop for the full LLM call (potentially seconds). Under load, this collapses throughput.

## `for` loop of invoke vs `.batch`

```python
# WRONG — sequential, ignores provider concurrency
results = [chain.invoke({"q": q}) for q in questions]
```

```python
# RIGHT
results = chain.batch(
    [{"q": q} for q in questions],
    config={"max_concurrency": 8},
)
```

Why: `.batch` runs in parallel up to `max_concurrency`, shares config / callbacks / tracing context, and uses provider-side batch endpoints where available.

## Missing run_name vs labelled run

```python
# WRONG — trace appears as "RunnableSequence" in LangSmith, indistinguishable from siblings
chain.invoke({"q": "..."})
```

```python
# RIGHT — labelled, filterable
chain.invoke(
    {"q": "..."},
    config={
        "run_name": "rag-answer",
        "tags": ["prod", "tenant-acme"],
        "metadata": {"request_id": "r-123"},
    },
)
```

Why: traces without `run_name` are anonymous and unfilterable in LangSmith. Cost-tracking and debugging both depend on this.

## `ConversationBufferMemory` vs checkpointer

```python
# WRONG — deprecated memory class
from langchain.memory import ConversationBufferMemory
memory = ConversationBufferMemory(return_messages=True, memory_key="history")
chain = LLMChain(llm=model, prompt=prompt, memory=memory)
```

```python
# RIGHT — agent with LangGraph checkpointer
from langchain.agents import create_agent
from langgraph.checkpoint.memory import InMemorySaver

agent = create_agent(model, tools, checkpointer=InMemorySaver())
agent.invoke(
    {"messages": [{"role": "user", "content": "..."}]},
    config={"configurable": {"thread_id": "user-42"}},
)
```

Or, for a simple chain-with-history, `RunnableWithMessageHistory` (see [memory.md](memory.md)).

## Unbounded agent loop vs `recursion_limit`

```python
# WRONG — agent can loop indefinitely if the model keeps re-calling a failing tool
agent.invoke({"messages": [...]})
```

```python
# RIGHT
agent.invoke(
    {"messages": [...]},
    config={"recursion_limit": 15},
)
```

Why: bound the loop. Combine with descriptive tool errors so the model can self-correct within the budget.

## Mixing embeddings vs verified dimension

```python
# WRONG — silent dim mismatch at query time
vs = Chroma.from_documents(docs, embedding=OpenAIEmbeddings())  # 1536 dim
# Later, "small" change:
vs = Chroma(embedding_function=OpenAIEmbeddings(model="text-embedding-3-large"))  # 3072 dim
vs.similarity_search("q")   # ValueError at query time
```

```python
# RIGHT — pin and verify
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
assert len(embeddings.embed_query("x")) == 1536
vs = Chroma(embedding_function=embeddings, collection_name="docs-1536")
```

Why: embedding model and vector store dimension must match. Encode the dim in the collection name to make accidents loud.
