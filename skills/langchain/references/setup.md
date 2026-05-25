# Setup

## Install (uv preferred)

```bash
# Core + one provider + one community feature
uv add langchain langchain-core langchain-anthropic langchain-openai
uv add langchain-community langchain-text-splitters
uv add langsmith            # tracing
```

Pin `langchain` and `langchain-core` together. Skew between them is the most common `ImportError` source after upgrades.

## pyproject.toml

```toml
[project]
dependencies = [
  "langchain",
  "langchain-core",
  "langchain-anthropic",
  "langchain-openai",
  "langchain-community",
  "langchain-text-splitters",
  "langsmith",
  "pydantic",
]
```

For RAG add a vector-store backend, e.g. `langchain-postgres` (pgvector), `langchain-chroma`, `langchain-qdrant`, or `faiss-cpu` via `langchain-community`.

## Environment variables

```bash
# Provider API keys (only what you use)
export ANTHROPIC_API_KEY=...
export OPENAI_API_KEY=...

# LangSmith (optional but recommended)
export LANGSMITH_TRACING=true
export LANGSMITH_API_KEY=...
export LANGSMITH_PROJECT=my-app-dev      # per-environment

# Optional global model override
export LANGCHAIN_DEFAULT_PROVIDER=anthropic
```

Use `dotenv` or `pydantic-settings` to load these in app code — never hardcode keys.

## Import sanity check

```python
from langchain.chat_models import init_chat_model
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough, RunnableParallel

model = init_chat_model("anthropic:claude-haiku-4-5")
print(model.invoke("ping").content)
```

If the first import fails with `cannot import name 'init_chat_model'`, you're on a stale `langchain` — upgrade.

## Choosing a partner package

| Provider | Package | Class |
|---|---|---|
| Anthropic | `langchain-anthropic` | `ChatAnthropic` |
| OpenAI | `langchain-openai` | `ChatOpenAI`, `OpenAIEmbeddings` |
| Google Gemini | `langchain-google-genai` | `ChatGoogleGenerativeAI` |
| AWS Bedrock | `langchain-aws` | `ChatBedrock`, `ChatBedrockConverse` |
| Mistral | `langchain-mistralai` | `ChatMistralAI` |
| Ollama (local) | `langchain-ollama` | `ChatOllama` |
| Postgres / pgvector | `langchain-postgres` | `PGVector`, `PostgresChatMessageHistory` |
| Chroma | `langchain-chroma` | `Chroma` |
| Qdrant | `langchain-qdrant` | `QdrantVectorStore` |

When you only need core abstractions (writing a utility, a custom Runnable), depend only on `langchain-core`. It keeps the dependency graph tight and import time short.
