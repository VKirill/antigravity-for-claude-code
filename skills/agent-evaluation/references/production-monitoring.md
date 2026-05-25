# Production Monitoring for LLM Agents

Offline evals catch what you thought to test. Production monitoring catches what you didn't. The two are complementary — neither replaces the other.

## Core Concepts

### Tracing

Every agent step — LLM call, tool invocation, retrieval query, external API call — should emit a span with:
- Input/output content (or truncated hash for privacy)
- Token counts (prompt + completion)
- Latency in ms
- Model name and version
- User/session ID for attribution
- Custom metadata (intent, topic, retrieval score)

Traces are the raw material for every other monitoring capability. Instrument first; add eval-in-production on top.

### Eval-in-Production

Run lightweight evaluation checks on a sampled fraction of live traffic.

**Sampling strategy**: 1–5% for rule-based checks (cheap); 0.1–1% for LLM judge calls (expensive). Adjust based on traffic volume and cost budget.

**Checks to run in production**:
1. Format compliance (response matches expected schema)
2. Safety classifier (harmless output)
3. Citation validation (links exist in retrieved context)
4. Tool error rate (tool calls that returned errors)
5. LLM judge score on a random sample

Route flagged traces to a human review queue.

### Drift Detection

Monitor the embedding distribution of outputs over time. Drift signals model behavior change, prompt change, or data distribution shift — without requiring ground truth labels.

```python
import numpy as np
from scipy.spatial.distance import jensenshannon
from sentence_transformers import SentenceTransformer

encoder = SentenceTransformer("all-MiniLM-L6-v2")

def compute_output_drift(baseline_outputs: list[str], current_outputs: list[str]) -> float:
    """
    Returns Jensen-Shannon divergence between baseline and current output embeddings.
    Higher = more drift. Threshold typically 0.1–0.15 for alert.
    """
    baseline_embs = encoder.encode(baseline_outputs)
    current_embs = encoder.encode(current_outputs)

    # Project to 1D via PCA for distributional comparison
    from sklearn.decomposition import PCA
    pca = PCA(n_components=1)
    all_embs = np.vstack([baseline_embs, current_embs])
    pca.fit(all_embs)

    baseline_proj = pca.transform(baseline_embs).flatten()
    current_proj = pca.transform(current_embs).flatten()

    # Histogram-based JSD
    bins = np.linspace(
        min(baseline_proj.min(), current_proj.min()),
        max(baseline_proj.max(), current_proj.max()),
        50,
    )
    p, _ = np.histogram(baseline_proj, bins=bins, density=True)
    q, _ = np.histogram(current_proj, bins=bins, density=True)

    # Add epsilon to avoid zero probability
    p = p + 1e-10
    q = q + 1e-10
    p /= p.sum()
    q /= q.sum()

    return float(jensenshannon(p, q))
```

Alert when JSD > 0.10 compared to the last 7-day baseline. Investigate trigger: model update, prompt change, or input distribution shift.

## Tooling

### LangSmith

Managed observability platform with tight LangChain integration.

**Setup** (Python):
```python
import os
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_ENDPOINT"] = "https://api.smith.langchain.com"
os.environ["LANGCHAIN_API_KEY"] = "your-api-key"
os.environ["LANGCHAIN_PROJECT"] = "my-agent-project"

# All LangChain/LangGraph calls are automatically traced
from langchain_anthropic import ChatAnthropic
llm = ChatAnthropic(model="claude-opus-4-5")
response = llm.invoke("Hello")
```

**Key features**:
- Automatic tracing for LangChain, LangGraph, OpenAI SDK
- Dataset management and eval run comparison
- Online evaluation rules (flag traces matching criteria)
- Human annotation queue for review workflows

**Eval runs**:
```python
from langsmith import Client
from langsmith.evaluation import evaluate

client = Client()

def my_evaluator(run, example):
    # run.outputs has agent output; example has expected
    score = compute_faithfulness(run.outputs["output"], example.outputs["expected"])
    return {"key": "faithfulness", "score": score}

results = evaluate(
    lambda inputs: agent.run(inputs["query"]),
    data="my-dataset-name",
    evaluators=[my_evaluator],
    experiment_prefix="claude-opus-4-5-v2",
)
```

**Best for**: teams already on LangChain/LangGraph who want managed infrastructure.

### LangFuse

Open-source alternative to LangSmith. Self-hostable (Docker + PostgreSQL). Strong for custom pipelines.

**Setup**:
```python
from langfuse import Langfuse
from langfuse.decorators import observe, langfuse_context

langfuse = Langfuse(
    public_key="pk-...",
    secret_key="sk-...",
    host="https://cloud.langfuse.com",  # or self-hosted
)

@observe()
def run_agent(query: str) -> str:
    langfuse_context.update_current_trace(
        name="agent-run",
        user_id="user_123",
        metadata={"query_type": classify_query(query)},
    )
    response = agent.run(query)
    langfuse_context.score_current_trace(
        name="format_compliance",
        value=1.0 if is_valid_format(response) else 0.0,
    )
    return response
```

**Scores**: attach scores to traces at collection time or in an async eval pipeline.

**Best for**: self-hosted deployments, privacy-sensitive workloads, custom scoring pipelines.

### Arize Phoenix

Strongest for drift detection and explainability. Open-source (Elv2 license).

```python
import phoenix as px
from phoenix.otel import register

# Start Phoenix server (local)
px.launch_app()

# Instrument with OpenTelemetry
tracer_provider = register(
    project_name="my-agent",
    endpoint="http://localhost:6006/v1/traces",
)

# Works with OpenAI, Anthropic, LangChain — auto-instrument
from opentelemetry.instrumentation.anthropic import AnthropicInstrumentor
AnthropicInstrumentor().instrument(tracer_provider=tracer_provider)
```

Phoenix computes embedding drift natively: upload your baseline dataset, and Phoenix tracks KL divergence on output embeddings in real time.

**Best for**: teams prioritizing drift detection and explainability over managed infrastructure.

### Helicone

Proxy-based: route all LLM API calls through Helicone's gateway. Zero SDK changes needed.

```python
from anthropic import Anthropic

# Only change: swap base_url
client = Anthropic(
    base_url="https://anthropic.helicone.ai",
    default_headers={
        "Helicone-Auth": f"Bearer {HELICONE_API_KEY}",
        "Helicone-Property-UserId": user_id,
        "Helicone-Property-SessionId": session_id,
    },
)
```

Captures: latency, tokens, cost, request/response bodies, custom properties.

**Best for**: fastest time-to-monitoring. No code restructuring required. Weakest eval integration.

## Tool Selection Guide

| Priority | Recommended Tool |
|---|---|
| Already on LangChain/LangGraph | LangSmith |
| Self-hosted / privacy-first | LangFuse |
| Drift detection is primary concern | Arize Phoenix |
| Fastest setup, minimal code change | Helicone |
| Multi-tool: tracing + eval + datasets | LangSmith or LangFuse + Arize |

## Cost Monitoring

Agent costs can silently increase over time as context accumulates, retry rates rise, or prompt length grows.

Track per-request:
- `prompt_tokens` + `completion_tokens` from every LLM response
- Cost = tokens × per-token price (store price by model version)
- Tool call count per task (more calls = more cost + latency)
- Retry count per task

Alert when rolling 7-day average cost per task increases > 20% week-over-week without a corresponding quality improvement.
