# Structured Output

`model.with_structured_output(Schema)` returns a Runnable that yields a parsed instance. Prefer this over manual JSON parsing.

## Pydantic v2 schema

```python
from pydantic import BaseModel, Field
from langchain.chat_models import init_chat_model

class Movie(BaseModel):
    """A movie with details."""
    title: str = Field(description="The title of the movie")
    year: int = Field(description="The release year")
    director: str
    rating: float = Field(description="Rating out of 10", ge=0, le=10)

model = init_chat_model("anthropic:claude-haiku-4-5")
structured = model.with_structured_output(Movie)

result: Movie = structured.invoke("Tell me about Inception.")
print(result.title, result.year, result.director, result.rating)
```

The class docstring becomes the schema description for the model. Field descriptions guide the model's extraction.

## Methods

```python
structured = model.with_structured_output(Movie, method="json_schema")
structured = model.with_structured_output(Movie, method="function_calling")
structured = model.with_structured_output(Movie, method="json_mode")
```

- `"json_schema"` — provider-native structured-output mode (OpenAI Responses, Anthropic structured output). Most reliable when supported.
- `"function_calling"` — uses tool calling under the hood. Universal fallback.
- `"json_mode"` — provider returns JSON object; less constrained than `json_schema`.

When unspecified, LangChain picks the best method for the provider. Override only if you hit provider-specific issues.

## Raw vs parsed

```python
structured = model.with_structured_output(Movie, include_raw=True)
result = structured.invoke("...")
# {"raw": AIMessage(...), "parsed": Movie(...), "parsing_error": None | ValidationError}
```

`include_raw=True` returns both the raw model message (with token usage, tool_calls) and the parsed object. Use in production when you want to log raw output even on parse success, or fall back gracefully on parse error.

## Multiple schemas (discriminated union)

```python
from typing import Union

class Joke(BaseModel):
    """A joke."""
    setup: str
    punchline: str

class Fact(BaseModel):
    """An interesting fact."""
    statement: str
    source: str

structured = model.with_structured_output(Union[Joke, Fact])
result = structured.invoke("Tell me something fun about birds.")
# Either Joke(...) or Fact(...) depending on what the model produced
```

LangChain converts the union into a discriminated tool-call signature. The model picks one.

## TypedDict / JSON schema

```python
from typing_extensions import TypedDict, Annotated

class Movie(TypedDict):
    """A movie."""
    title: Annotated[str, ..., "Title of the movie"]
    year: Annotated[int, ..., "Release year"]

structured = model.with_structured_output(Movie)
```

Returns a plain dict. Use when you don't want a Pydantic dependency for the consumer.

## Streaming

```python
for chunk in structured.stream("Tell me about Inception."):
    print(chunk)
```

For structured output, `.stream` yields incremental partial objects as the model emits tokens — last chunk is the complete parsed instance.

## Error handling

If the model emits malformed JSON, `.invoke` raises `OutputParserException` (or `ValidationError` from Pydantic). Wrap with `.with_retry()` or use `include_raw=True` and handle `parsing_error` yourself.
