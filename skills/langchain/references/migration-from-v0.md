# Migration from LangChain v0 to v1

v1 is largely backwards compatible at the import level, but several APIs are deprecated or moved. Migrate proactively — the warnings will become hard removals.

## Summary of v0 → v1

| v0 idiom | v1 idiom |
|---|---|
| `from langchain.llms import OpenAI` | `from langchain_openai import ChatOpenAI` or `init_chat_model("openai:...")` |
| `ChatOpenAI(model_name="...")` constructor everywhere | `init_chat_model("openai:...")` for provider-agnostic code |
| Subclass `Chain` and override `_call` | Compose Runnables with `\|` |
| `chain(input)` (call `__call__`) | `chain.invoke(input)` |
| `chain.run("text")` | `chain.invoke("text")` |
| `AgentExecutor(...)` | `langchain.agents.create_agent(model, tools, system_prompt=...)` |
| `initialize_agent(...)` | `create_agent` |
| `langgraph.prebuilt.create_react_agent` | `langchain.agents.create_agent` |
| `LLMChain(llm=..., prompt=...)` | `prompt \| model` |
| `SequentialChain` / `SimpleSequentialChain` | `chain_a \| chain_b` |
| `ConversationBufferMemory` attached to chain | `RunnableWithMessageHistory` or LangGraph checkpointer |
| `ConversationSummaryMemory` | Build summarization explicitly as a Runnable |
| Manual `json.loads(response.content)` | `model.with_structured_output(Schema)` |
| `OutputParser` subclasses | Use built-in parsers (`StrOutputParser`, `JsonOutputParser`) or `with_structured_output` |
| `Tool(name=..., func=..., description=...)` | `@tool` decorator on a typed function |
| `callbacks=[...]` constructor arg | `config={"callbacks": [...]}` per call |

## Step-by-step migration

### 1. Switch model construction

```python
# v0
from langchain.chat_models import ChatOpenAI
model = ChatOpenAI(model_name="gpt-4", temperature=0)

# v1
from langchain.chat_models import init_chat_model
model = init_chat_model("openai:gpt-4", temperature=0)
```

Direct `ChatOpenAI` import still works (now from `langchain_openai`), but `init_chat_model` is preferred.

### 2. Replace `Chain` subclasses with LCEL

```python
# v0
class MyChain(Chain):
    @property
    def input_keys(self): return ["q"]
    @property
    def output_keys(self): return ["a"]
    def _call(self, inputs):
        ...

# v1
chain = prompt | model | StrOutputParser()
```

If you need extra logic, wrap in `RunnableLambda` or use `@chain` decorator.

### 3. Replace `.run` / `__call__` with `.invoke`

```python
# v0
chain.run("hello")
chain("hello")
chain({"q": "hello"})

# v1
chain.invoke("hello")
chain.invoke({"q": "hello"})
```

### 4. Replace AgentExecutor with create_agent

```python
# v0
from langchain.agents import AgentExecutor, create_tool_calling_agent
runnable = create_tool_calling_agent(model, tools, prompt)
executor = AgentExecutor(agent=runnable, tools=tools, verbose=True)
executor.invoke({"input": "..."})

# v1
from langchain.agents import create_agent
agent = create_agent(model, tools, system_prompt="...")
agent.invoke({"messages": [{"role": "user", "content": "..."}]})
```

Input shape changed: `{"input": ...}` → `{"messages": [...]}`. Output is the full message history.

### 5. Replace manual JSON parsing with `with_structured_output`

```python
# v0 — fragile
response = model.invoke(prompt + "\n\nReturn JSON.")
data = json.loads(response.content)   # may fail on prose, code fences

# v1 — schema-enforced
class Schema(BaseModel):
    field: str

structured = model.with_structured_output(Schema)
data: Schema = structured.invoke("...")
```

### 6. Replace memory classes

```python
# v0
from langchain.memory import ConversationBufferMemory
memory = ConversationBufferMemory(...)
chain = LLMChain(llm=model, prompt=prompt, memory=memory)

# v1 (chain)
from langchain_core.runnables.history import RunnableWithMessageHistory
with_history = RunnableWithMessageHistory(prompt | model, get_session_history=...)

# v1 (agent)
agent = create_agent(model, tools, checkpointer=InMemorySaver())
```

### 7. Update import paths

`langchain.chat_models.ChatOpenAI` → `langchain_openai.ChatOpenAI`. Similar split-outs:

- `langchain.embeddings.OpenAIEmbeddings` → `langchain_openai.OpenAIEmbeddings`
- `langchain.vectorstores.Chroma` → `langchain_chroma.Chroma`
- `langchain.text_splitter.RecursiveCharacterTextSplitter` → `langchain_text_splitters.RecursiveCharacterTextSplitter`

The `langchain` package still re-exports many of these with deprecation warnings — fix at your own pace, but expect removal in a future major.

## Lazy-migration tip

The fastest path is:

1. Update imports — run a search/replace for the old paths.
2. Replace `chain(x)` / `chain.run(x)` with `chain.invoke(x)`.
3. Migrate any `AgentExecutor` last — that's the biggest surface change.

Run the existing test suite between steps. Deprecation warnings tell you what's left.
