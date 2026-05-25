# httpx — Testing

httpx exposes test transports for in-memory testing without spinning up a real server: `MockTransport` (canned responses), `ASGITransport` (in-process FastAPI/Starlette), `WSGITransport` (Flask/Django). Plus the `respx` and `pytest-httpx` libraries for richer mocking.

## `httpx.MockTransport(handler)`

Define a handler that returns an `httpx.Response`:

```python
import httpx

def handler(request: httpx.Request) -> httpx.Response:
    if request.url.path == "/users":
        return httpx.Response(200, json={"users": []})
    return httpx.Response(404)

transport = httpx.MockTransport(handler)
with httpx.Client(transport=transport, base_url="https://api.example.com") as client:
    r = client.get("/users")
    assert r.status_code == 200
```

Works for async too — handler may be a coroutine when used with `AsyncClient`:

```python
async def ahandler(request):
    return httpx.Response(200, json={"ok": True})

async with httpx.AsyncClient(transport=httpx.MockTransport(ahandler)) as client:
    r = await client.get("https://test/")
```

## Testing a FastAPI/Starlette app with `ASGITransport`

This is the canonical way to test a FastAPI app — fully in-memory, no Uvicorn, no real port:

```python
import pytest, httpx
from myapp import app

@pytest.mark.anyio
async def test_root():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/")
        assert response.status_code == 200
```

`ASGITransport` parameters:

- `app=` — the ASGI application (`FastAPI()` instance)
- `raise_app_exceptions=False` — return 500 instead of re-raising
- `root_path=""` — mount the app at a subpath
- `client=("1.2.3.4", 123)` — fake client (host, port) the app sees

Use `pytest-asyncio` or `anyio` as the test runner.

For FastAPI's old `TestClient` (a thin wrapper over httpx), prefer `httpx.AsyncClient(transport=ASGITransport(...))` directly in new async tests — it gives you async-native ergonomics with no extra dependency.

## Testing a Flask/Django app with `WSGITransport`

```python
from flask import Flask
import httpx

app = Flask(__name__)

@app.route("/api/data")
def get_data():
    return {"status": "ok"}

transport = httpx.WSGITransport(app=app)
with httpx.Client(transport=transport, base_url="http://testserver") as client:
    r = client.get("/api/data")
    assert r.json() == {"status": "ok"}
```

## `respx` — declarative HTTP mocking

`respx` records routes, asserts call counts, and supports patterns:

```python
import httpx, respx

@respx.mock
def test_users():
    respx.get("https://api.example.com/users").mock(
        return_value=httpx.Response(200, json=[{"id": 1}])
    )

    with httpx.Client() as client:
        r = client.get("https://api.example.com/users")
        assert r.json() == [{"id": 1}]

    assert respx.calls.call_count == 1
```

Async fixtures work the same way. Use `respx.route(...)` for regex/match-by-header patterns.

## `pytest-httpx` — pytest fixture

`pytest-httpx` registers `httpx_mock` as a fixture and asserts calls automatically at test teardown:

```python
def test_fetch(httpx_mock):
    httpx_mock.add_response(
        url="https://api.example.com/items/42",
        json={"id": 42, "name": "widget"},
    )

    with httpx.Client() as client:
        r = client.get("https://api.example.com/items/42")
        assert r.json()["name"] == "widget"
```

Async tests work via `pytest-asyncio` — same `httpx_mock` fixture.

## Choosing the right tool

| Need | Tool |
|---|---|
| Quick canned response, no library | `httpx.MockTransport` |
| Test a FastAPI/Starlette app end-to-end | `httpx.ASGITransport` |
| Test a Flask/Django app end-to-end | `httpx.WSGITransport` |
| Mock external upstream from a service test | `respx` or `pytest-httpx` |
| Pattern-match on URL/method/headers, count calls | `respx` |
| pytest-native assertion of un-mocked or missed calls | `pytest-httpx` |

## Freezing time

httpx itself does not depend on system clock. To freeze time around requests (for retry/backoff or timestamp-based auth), use `freezegun` or `time-machine` around your test body — neither library conflicts with httpx.

## Common testing mistakes

- Patching `httpx.get` directly via `monkeypatch` — fragile, breaks if the code switches to a `Client`. Use `MockTransport` or `respx` instead.
- Forgetting `base_url=` on the test client — `MockTransport` handlers see whatever absolute URL the code uses.
- Using `TestClient` (FastAPI) inside an `async def` test without `anyio` — bridge via `AsyncClient(transport=ASGITransport(app))` instead.
- Not asserting call count — a test passes if the route is never called when it should have been. `respx.calls.call_count` / `pytest-httpx` fixture catches this.
