# Observability with LangSmith

LangSmith is the first-party tracing / eval / dataset platform. Enabling it is environment variables — no code change.

## Enable tracing

```bash
export LANGSMITH_TRACING=true
export LANGSMITH_API_KEY=lsv2_pt_...
export LANGSMITH_PROJECT=my-app-prod   # per-environment
# optional
export LANGSMITH_ENDPOINT=https://api.smith.langchain.com   # default
```

Every Runnable run auto-traces. Token usage, latency, child runs, retry attempts, tool calls — all captured.

Set a different `LANGSMITH_PROJECT` per environment (dev / staging / prod). Mixing them is the most common observability mistake.

## Run names and tags

The single biggest readability win — name your top-level invocations.

```python
chain.invoke(
    {"q": "..."},
    config={
        "run_name": "summarize-article",
        "tags": ["prod", "v1", "tenant-acme"],
        "metadata": {"user_id": "u-123", "request_id": "r-456"},
    },
)
```

`run_name` becomes the trace title. `tags` and `metadata` are filterable in the LangSmith UI.

## Tracing arbitrary code with @traceable

```python
from langsmith import traceable

@traceable
def my_helper(x: int) -> int:
    return x * 2
```

Adds a trace span when called from inside a LangChain run. Pairs well with custom data-prep / post-processing functions.

## Token usage and cost

`AIMessage.usage_metadata` carries token counts:

```python
response = model.invoke("...")
print(response.usage_metadata)
# {"input_tokens": 12, "output_tokens": 34, "total_tokens": 46}
```

LangSmith rolls these up per run, per project, per tag. For cost, configure per-model price in the LangSmith project settings.

For programmatic cost tracking without LangSmith:

```python
from langchain_community.callbacks import get_openai_callback

with get_openai_callback() as cb:
    chain.invoke({"q": "..."})
    print(cb.total_cost, cb.total_tokens)
```

(OpenAI-specific. For provider-neutral, sum `usage_metadata` yourself.)

## Capturing exceptions

Tracing captures exceptions automatically — failed runs appear in the LangSmith UI with the traceback. For app-level alerting (Sentry, etc.), still wrap the top-level `.invoke` and log/raise.

## Disabling tracing in tests

```python
import os
os.environ["LANGSMITH_TRACING"] = "false"
```

Or set in test config / fixture. Otherwise unit tests pollute the prod project.

## Eval datasets (brief)

LangSmith stores datasets of `(input, expected_output)` pairs. Run a chain over a dataset:

```python
from langsmith import Client
from langsmith.evaluation import evaluate

client = Client()

def predict(inputs: dict) -> dict:
    return {"output": chain.invoke(inputs["question"])}

evaluate(
    predict,
    data="my-eval-dataset",
    evaluators=[my_evaluator],
)
```

Use for regression testing prompts / chains across versions. Defer to a dedicated eval skill for depth.

## Production checklist

- [ ] `LANGSMITH_PROJECT` is per-environment, never mixed
- [ ] Top-level calls pass `run_name`, `tags`, `metadata` with request_id
- [ ] PII redaction at the application layer if your prompts contain user data — LangSmith captures full prompts by default
- [ ] Sample at high QPS — `LANGSMITH_SAMPLING_RATE=0.1` to trace 10% of runs
