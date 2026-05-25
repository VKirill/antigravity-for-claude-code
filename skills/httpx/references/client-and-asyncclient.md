# httpx — Client and AsyncClient

When the same process calls the same host more than once, use `Client` (sync) or `AsyncClient` (async). Both pool connections, share headers/cookies/auth, and centralize configuration.

## Context-manager pattern (required)

```python
import httpx

# Sync
with httpx.Client(base_url="https://api.example.com") as client:
    response = client.get("/items")

# Async
async with httpx.AsyncClient(base_url="https://api.example.com") as client:
    response = await client.get("/items")
```

The `with` / `async with` block closes the underlying transport and releases sockets. Skipping it leaks file descriptors and connection-pool slots until garbage collection.

## Constructor parameters (most useful)

| Param | Purpose |
|---|---|
| `base_url=` | URL prefix joined to each relative request URL |
| `headers=` | default headers merged into every request |
| `cookies=` | default cookies; client maintains a cookie jar across requests |
| `auth=` | default auth — tuple, `BasicAuth`, `DigestAuth`, or custom `httpx.Auth` |
| `params=` | default query params merged into every request |
| `timeout=` | default per-request timeout (see `recommended-defaults.md`) |
| `follow_redirects=` | default redirect behavior — `False` unless opted in |
| `limits=httpx.Limits(...)` | connection pool size — see `recommended-defaults.md` |
| `transport=` | custom transport — `HTTPTransport`, `MockTransport`, `ASGITransport`, etc. |
| `proxy=` | single proxy URL applied to all requests |
| `mounts=` | dict mapping scheme prefix → transport, for per-scheme proxying |
| `verify=` | SSL verification — `True`, `False`, path to CA bundle, or `ssl.SSLContext` |
| `cert=` | client certificate path (or `ssl.SSLContext`) for mTLS |
| `http2=` | enable HTTP/2 (requires `httpx[http2]` extra) |
| `event_hooks=` | dict of `{"request": [...], "response": [...]}` callables |
| `trust_env=` | read `HTTP_PROXY`, `NO_PROXY`, `SSL_CERT_FILE` env vars; default `True` |

## Default headers and cookies

```python
client = httpx.Client(
    base_url="https://api.example.com",
    headers={"User-Agent": "myapp/1.0", "X-Trace-Id": "abc"},
    cookies={"session": "..."},
    auth=("user", "pass"),
)
```

Default values are merged per request. Anything passed to `client.get(headers=...)` is layered on top of the client default.

## Connection pooling

A `Client` maintains a connection pool keyed by `(scheme, host, port)`. Reusing the same client across requests means TCP and TLS handshakes happen once per pool slot. `limits=httpx.Limits(max_connections=..., max_keepalive_connections=...)` controls the pool size (see `recommended-defaults.md` for tuning).

```python
import httpx

limits = httpx.Limits(max_connections=100, max_keepalive_connections=20)
client = httpx.AsyncClient(limits=limits)
```

## Sharing one client

Create one `Client` / `AsyncClient` per process and hand it out. Never create a new client inside a loop or per-request handler. See `async-usage.md` for FastAPI lifespan integration.

## Custom transport

`transport=` accepts:

- `httpx.HTTPTransport(retries=N)` — sync real-network transport with connect-retry only
- `httpx.AsyncHTTPTransport(retries=N)` — async equivalent
- `httpx.MockTransport(handler)` — test helper, see `testing.md`
- `httpx.ASGITransport(app=...)` — in-memory call into an ASGI app (FastAPI/Starlette)
- `httpx.WSGITransport(app=...)` — in-memory call into a WSGI app (Flask/Django)

## Event hooks

Useful for logging, request-id injection, or response inspection. Hooks cannot mutate the request/response, only observe.

```python
def log_response(response):
    response.read()
    print(response.status_code, response.url)

client = httpx.Client(event_hooks={"response": [log_response]})
```

For async clients, hooks may be coroutines.

## Closing manually

If you cannot use the context manager (e.g. a globally-scoped client), call `.close()` (sync) or `await .aclose()` (async) before process exit. The context-manager form is strictly preferred — leaked clients are the #1 source of "Too many open files" in long-running services.
