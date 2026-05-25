# FastAPI — lifespan

The `lifespan` async context manager replaces the legacy `@app.on_event("startup")` / `@app.on_event("shutdown")` pair. Use it for everything: DB engines, HTTP clients, ML models, message brokers.

## Canonical shape

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ---- startup ----
    app.state.http = httpx.AsyncClient(timeout=10.0)
    app.state.engine = create_async_engine(settings.database_url, pool_size=20)
    app.state.sessionmaker = async_sessionmaker(app.state.engine, expire_on_commit=False)

    yield   # app serves requests here

    # ---- shutdown ----
    await app.state.http.aclose()
    await app.state.engine.dispose()

app = FastAPI(lifespan=lifespan)
```

Key facts:

- Runs **once per worker process**, before the first request and after the last response of that worker.
- Code before `yield` MUST NOT block the event loop — use `await`.
- An exception before `yield` prevents the worker from starting (uvicorn logs the traceback and exits).
- An exception after `yield` is logged but does not prevent shutdown.
- The signature is fixed: `(app: FastAPI) -> AsyncIterator[None]` (or `AsyncIterator[State]` if you use the state-passing form below).

## Lifespan with typed state

If you'd rather not stuff resources onto `app.state` (no static typing), yield a `TypedDict`:

```python
from typing import TypedDict

class AppState(TypedDict):
    http: httpx.AsyncClient
    engine: AsyncEngine

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[AppState]:
    async with httpx.AsyncClient() as http:
        engine = create_async_engine(...)
        try:
            yield {"http": http, "engine": engine}
        finally:
            await engine.dispose()
```

Inside a route, access via `request.state` — FastAPI propagates the yielded dict.

## Why not `on_event`?

`@app.on_event("startup")` and `@app.on_event("shutdown")` are **deprecated** in favor of `lifespan`. Reasons:

1. Two separate hooks; awkward to share local variables between them.
2. No support for nested context managers.
3. Order of execution between multiple `on_event` handlers is fragile.

`lifespan` lets you write the standard "setup → yield → teardown" idiom that mirrors normal `with` blocks.

## Using `Depends` to consume lifespan resources

Once stored on `app.state`, expose via a `Depends` that reads from the request:

```python
async def get_http(request: Request) -> httpx.AsyncClient:
    return request.app.state.http

@app.get("/proxy")
async def proxy(http: Annotated[httpx.AsyncClient, Depends(get_http)]):
    r = await http.get("https://api.example.com/x")
    return r.json()
```

This keeps tests easy — `app.dependency_overrides[get_http] = lambda: FakeHttp()`.

## Migrating from `on_event`

```python
# OLD — deprecated
@app.on_event("startup")
async def startup():
    app.state.engine = create_async_engine(...)

@app.on_event("shutdown")
async def shutdown():
    await app.state.engine.dispose()

# NEW
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.engine = create_async_engine(...)
    try:
        yield
    finally:
        await app.state.engine.dispose()

app = FastAPI(lifespan=lifespan)
```

## Resources that *must* go in lifespan

- Database connection pools (SQLAlchemy `AsyncEngine`, asyncpg pool, `psycopg_pool.AsyncConnectionPool`)
- HTTP clients (`httpx.AsyncClient` — sharing is *much* faster than recreating per request)
- Message brokers / Redis clients
- Background task schedulers (APScheduler)
- ML model warmup (`torch.load`, `tensorflow.saved_model.load`)
- File-system probes (`/tmp` writable, model files present)

## Graceful shutdown

Uvicorn forwards SIGTERM to FastAPI; the lifespan teardown gets a chance to drain. Allow enough time:

```bash
gunicorn ... --graceful-timeout 30
uvicorn ... --timeout-graceful-shutdown 30
```

Drain pattern (await in-flight tasks before closing the pool):

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.tasks = set()
    yield
    # Wait for fire-and-forget tasks to finish before closing resources
    if app.state.tasks:
        await asyncio.gather(*app.state.tasks, return_exceptions=True)
    await app.state.http.aclose()
```

## Testing lifespan

`TestClient` triggers lifespan when used as a context manager:

```python
with TestClient(app) as client:
    # startup ran
    r = client.get("/")
# shutdown ran
```

For `httpx.AsyncClient`-based async tests, wrap with `LifespanManager` from `asgi-lifespan`:

```python
from asgi_lifespan import LifespanManager
async with LifespanManager(app):
    async with httpx.AsyncClient(app=app, base_url="http://test") as ac:
        ...
```

See [testing.md](testing.md).

## Common mistakes

- ❌ Forgetting `try/finally` around `yield` — exceptions during request handling skip the cleanup.
- ❌ Using `lifespan` to populate global module variables — defeats `dependency_overrides`. Always put on `app.state` (or pass via the typed state).
- ❌ Awaiting external services synchronously before `yield` and blocking startup forever — wrap with `asyncio.wait_for(..., timeout=10)`.
- ❌ Initializing per-request resources in lifespan (database **session** instead of engine) — sessions are per-request, engines are per-process.
