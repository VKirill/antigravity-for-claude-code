# LLM Caching

LangChain caches LLM responses globally via `set_llm_cache`. Cache key: model + prompt (exact or semantic).

## When caching helps

- Deterministic prompts: `temperature=0`, no time-varying input
- Repeated evaluation / replays during dev
- Idempotent batch jobs over a static corpus
- Test suites — avoid spending API budget on regression tests

## When it does NOT help (don't enable)

- High-variance prompts (`temperature > 0`)
- Per-user personalization (cache key collisions across users)
- Time-sensitive content (news, prices) — cached answer goes stale
- Streaming UIs — cached responses bypass streaming, jarring UX

## In-memory cache (tests, dev)

```python
from langchain.globals import set_llm_cache
from langchain_core.caches import InMemoryCache

set_llm_cache(InMemoryCache())
```

Process-local, dies with the process. Perfect for unit tests.

## SQLite cache (local dev, single machine)

```python
from langchain_community.cache import SQLiteCache

set_llm_cache(SQLiteCache(database_path=".langchain.db"))
```

Survives restarts. Single-writer — don't share across processes.

## Redis exact-match cache

```python
from langchain_community.cache import RedisCache
import redis

set_llm_cache(RedisCache(redis_=redis.Redis.from_url("redis://localhost:6379")))
```

Multi-process safe. TTL per entry. Keyed on prompt text — minor wording changes miss.

## Redis semantic cache

```python
from langchain_community.cache import RedisSemanticCache
from langchain_openai import OpenAIEmbeddings

set_llm_cache(
    RedisSemanticCache(
        embedding=OpenAIEmbeddings(),
        redis_url="redis://localhost:6379",
        score_threshold=0.2,    # cosine distance threshold for "similar enough"
    )
)
```

Hits on semantically similar prompts, not just exact matches. Adds an embedding call per lookup (cheap) — net win at >~30% hit rate. Tune `score_threshold` carefully; too loose returns wrong answers.

## Postgres / pgvector semantic cache

```python
# Available via langchain-postgres or per-vendor packages
# (e.g. AlloyDB, CrateDB, AstraDB all expose semantic-cache classes)
```

## Per-call disable

```python
from langchain_core.caches import BaseCache

# Disable for one specific call
chain.invoke({"q": "..."}, config={"configurable": {"llm_cache": None}})
```

Or construct a fresh model with `model.with_config(disable_cache=True)` if the provider supports it.

## Cache and structured output

The cache key includes the bound schema / tool list — switching `with_structured_output` schemas produces different keys, as expected. Same for `bind_tools`.

## Observability

`set_llm_cache` activity shows in LangSmith — cache hits appear as a near-zero-latency span with `cached: true` metadata. Use the hit rate in LangSmith to decide whether to keep / tune the cache.
