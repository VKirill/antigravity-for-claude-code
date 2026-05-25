# Prompts

`ChatPromptTemplate` is a Runnable that takes a dict and returns a list of `BaseMessage`.

## Basic chat prompt

```python
from langchain_core.prompts import ChatPromptTemplate

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a {role}. Answer in {language}."),
    ("human", "{question}"),
])

messages = prompt.invoke({
    "role": "tutor",
    "language": "English",
    "question": "What is recursion?",
})
# -> [SystemMessage(...), HumanMessage(...)]
```

Variables in `{name}` are filled from the input dict. Missing keys raise at format time, not render time — fail fast.

## Roles

- `("system", "...")` — system instructions
- `("human", "...")` or `("user", "...")` — user turn
- `("ai", "...")` or `("assistant", "...")` — model turn (few-shot or history)
- `("placeholder", "{messages}")` — splice in a list of messages at runtime
- `MessagesPlaceholder(variable_name="history")` — same, explicit class form

## MessagesPlaceholder for history / tool calls

```python
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant."),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{question}"),
])

prompt.invoke({
    "history": [
        HumanMessage("hi"),
        AIMessage("hello"),
    ],
    "question": "what did I say first?",
})
```

Splices the list at that position. Used by agents (`messages` placeholder for the running conversation) and by `RunnableWithMessageHistory`.

## Partial prompts

```python
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a {role}."),
    ("human", "{question}"),
])

tutor_prompt = prompt.partial(role="tutor")
tutor_prompt.invoke({"question": "What is recursion?"})
```

Bakes one variable in. Useful when the role / system text is fixed per route.

## Few-shot

```python
from langchain_core.prompts import FewShotChatMessagePromptTemplate

examples = [
    {"input": "2+2", "output": "4"},
    {"input": "3*5", "output": "15"},
]

example_prompt = ChatPromptTemplate.from_messages([
    ("human", "{input}"),
    ("ai", "{output}"),
])

few_shot = FewShotChatMessagePromptTemplate(
    example_prompt=example_prompt,
    examples=examples,
)

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a calculator."),
    few_shot,
    ("human", "{input}"),
])
```

## Prompt hub

```python
from langchain import hub
prompt = hub.pull("hwchase17/openai-tools-agent")
```

Pulls a published prompt by ID. Useful for community-maintained agent prompts; for production, version-control your prompts in code.

## Plain string templates

For non-chat models (text completion), use `PromptTemplate`:

```python
from langchain_core.prompts import PromptTemplate

p = PromptTemplate.from_template("Summarize this: {text}")
p.invoke({"text": "..."})   # StringPromptValue
```

Rarely needed in v1 — chat models cover almost everything.
