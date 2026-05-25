# httpx — Async usage

`httpx.AsyncClient` is the async-native peer of `httpx.Client`. It runs on `asyncio` (default), `trio`, or `anyio`-bridged loops.

## Basic shape

```python
import httpx
import asyncio

async def main():
    async with httpx.AsyncClient() as client:
        response = await client.get("https://api.example.com/items")
        response.raise_for_status()
        print(response.json())

asyncio.run(main())
```

Every request method is awaitable: `await client.get/post/put/patch/delete/head/options/request/send`.

## Concurrent requests with `asyncio.gather`

```python
async def fetch_all(urls: list[str]) -> list[httpx.Response]:
    async with httpx.AsyncClient() as client:
        tasks = [client.get(url) for url in urls]
        return await asyncio.gather(*tasks)
```

Fan-out with `gather` reuses one connection pool. With HTTP/2 enabled (`http2.md`), the same TCP connection multiplexes all requests to a given host.

For structured concurrency, use `asyncio.TaskGroup` (Python 3.11+) or `anyio.create_task_group`.

## Sharing the client across the process

Create exactly one `AsyncClient` per process. Bind its lifecycle to the framework's startup/shutdown hooks rather than per-request.

### FastAPI lifespan

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
import httpx

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http = httpx.AsyncClient(
        base_url="https://api.upstream.example",
        timeout=httpx.Timeout(10.0, connect=5.0),
    )
    yield
    await app.state.http.aclose()

app = FastAPI(lifespan=lifespan)

@app.get("/proxy")
async def proxy(request: Request):
    client: httpx.AsyncClient = request.app.state.http
    r = await client.get("/items")
    r.raise_for_status()
    return r.json()
```

The same pattern works for Starlette, Quart, Litestar, and any long-running async worker — own the client at process scope, hand it out via DI.

## When to NOT share

- One-off scripts where the cost of a single TCP+TLS handshake is acceptable
- Tests where each test should see a clean state — use `httpx.AsyncClient` inside the test with `MockTransport` / `ASGITransport` (see `testing.md`)

## Streaming response

`AsyncClient.stream(...)` is the async equivalent of `Client.stream(...)`. See `streaming.md`.

```python
async with client.stream("GET", "https://example.com/big.bin") as response:
    async for chunk in response.aiter_bytes():
        ...
```

## Manual streaming send

For frameworks that need explicit lifecycle control:

```python
req = client.build_request("GET", url)
r = await client.send(req, stream=True)
try:
    async for chunk in r.aiter_bytes():
        ...
finally:
    await r.aclose()
```

`aclose()` MUST be called — otherwise the response holds the connection open.

## Backend selection

`AsyncClient` auto-detects the running event loop. Works on:

- `asyncio` (CPython stdlib)
- `trio`
- Anything `anyio`-compatible

No code change is required to switch backends.

## Async iteration of upload bodies

```python
async def upload_chunks():
    for chunk in big_chunks:
        yield chunk

await client.post(url, content=upload_chunks())
```

The body streams without buffering the whole payload in memory.

## Common async pitfalls

- Calling `httpx.Client` (sync) inside `async def` — blocks the event loop. Use `AsyncClient`.
- Creating `AsyncClient` per request inside a FastAPI handler — burns the pool. Use lifespan-scoped client.
- Forgetting `await` on `client.get(...)` — returns a coroutine object, never the response.
- Forgetting `async with` / `await client.aclose()` — leaks connections.

See `wrong-vs-right.md` and `troubleshooting.md` for symptom-indexed fixes.
