# httpx — Retries, timeouts, and exception hierarchy

## httpx has NO built-in HTTP-level retry

httpx will **not** retry a 5xx response or a `ReadTimeout`. The only built-in retry is at the connect layer:

```python
transport = httpx.HTTPTransport(retries=2)
client = httpx.Client(transport=transport)
# async:
transport = httpx.AsyncHTTPTransport(retries=2)
client = httpx.AsyncClient(transport=transport)
```

`retries=N` retries ONLY on `httpx.ConnectError` and `httpx.ConnectTimeout` — never on read errors, timeouts during the response, or non-2xx status codes.

For anything else, layer a retry library on top: **`tenacity`** or **`stamina`**.

## Retry with `tenacity`

```python
import httpx
from tenacity import (
    retry, stop_after_attempt, wait_exponential_jitter, retry_if_exception_type,
)

@retry(
    reraise=True,
    stop=stop_after_attempt(3),
    wait=wait_exponential_jitter(initial=0.5, max=8),
    retry=retry_if_exception_type((httpx.RequestError, httpx.HTTPStatusError)),
)
def fetch(client: httpx.Client, url: str) -> dict:
    r = client.get(url)
    r.raise_for_status()
    return r.json()
```

For async, use `tenacity.AsyncRetrying` or `@retry` on an `async def`.

Pinned numeric defaults (max attempts, backoff cap) live in `recommended-defaults.md`. Do not inline them in business code.

## Retry with `stamina`

`stamina` wraps `tenacity` with safer defaults (jitter, telemetry hooks):

```python
import httpx, stamina

@stamina.retry(on=(httpx.RequestError, httpx.HTTPStatusError))
async def fetch(client, url):
    r = await client.get(url)
    r.raise_for_status()
    return r.json()
```

## Timeouts — per-phase

httpx applies a strict timeout per request, split into four phases:

| Phase | Bounds |
|---|---|
| `connect` | Time to open the TCP/TLS socket |
| `read` | Time waiting for each chunk of the response |
| `write` | Time waiting for each chunk of the request to flush |
| `pool` | Time waiting to acquire a connection from the pool |

Configure via `httpx.Timeout`:

```python
# Same value for all phases
client = httpx.Client(timeout=10.0)

# Separate values
client = httpx.Client(timeout=httpx.Timeout(10.0, connect=5.0))

# Per request
response = client.get(url, timeout=httpx.Timeout(30.0, read=60.0))

# Disable (rarely a good idea)
response = client.get(url, timeout=None)
```

Numeric defaults live in `recommended-defaults.md`.

## Exception hierarchy

```
httpx.HTTPError                              # base
├── httpx.RequestError                       # any network/transport problem
│   ├── httpx.TransportError
│   │   ├── httpx.TimeoutException
│   │   │   ├── httpx.ConnectTimeout
│   │   │   ├── httpx.ReadTimeout
│   │   │   ├── httpx.WriteTimeout
│   │   │   └── httpx.PoolTimeout
│   │   ├── httpx.NetworkError
│   │   │   ├── httpx.ConnectError
│   │   │   ├── httpx.ReadError
│   │   │   ├── httpx.WriteError
│   │   │   └── httpx.CloseError
│   │   ├── httpx.ProtocolError
│   │   │   ├── httpx.LocalProtocolError
│   │   │   └── httpx.RemoteProtocolError
│   │   ├── httpx.ProxyError
│   │   └── httpx.UnsupportedProtocol
│   ├── httpx.DecodingError
│   ├── httpx.TooManyRedirects
│   └── ...
└── httpx.HTTPStatusError                    # 4xx/5xx after raise_for_status()
```

Key distinction: **`RequestError`** covers anything that prevented a successful HTTP exchange. **`HTTPStatusError`** is only raised by `response.raise_for_status()` for 4xx/5xx responses.

```python
try:
    response = client.get(url)
    response.raise_for_status()
except httpx.HTTPStatusError as e:
    # 4xx / 5xx — server reachable, returned an error
    log.warning("status %s: %s", e.response.status_code, e.response.text)
except httpx.RequestError as e:
    # Network / transport / timeout — no response, or partial
    log.error("network failure to %s: %r", e.request.url, e)
```

## `raise_for_status()`

```python
response.raise_for_status()  # raises httpx.HTTPStatusError for 4xx/5xx
```

The raised exception carries the response on `.response`. Always call this unless your code branches explicitly on `response.status_code`.

## Retry policy: what to retry, what not to

Safe to retry:
- `httpx.ConnectError`, `httpx.ConnectTimeout` — server didn't see the request
- `httpx.ReadTimeout`, `httpx.RemoteProtocolError` — server may have processed; only safe for idempotent methods (GET, HEAD, PUT, DELETE)
- 5xx responses (`HTTPStatusError`) — only for idempotent methods or with idempotency keys
- 429 Too Many Requests — respect `Retry-After` header

Do NOT retry:
- 4xx (except 408, 429) — the request is wrong; retrying produces the same error
- Non-idempotent POSTs without idempotency keys — risks double-charging / double-creating

## Circuit breaker

For upstream-protecting circuit breaking, layer `purgatory` or `pybreaker` on top of httpx. httpx itself does not implement circuit breaking.

## Pool exhaustion as timeout

A request that waits too long for a free pool slot raises `httpx.PoolTimeout`. The fix is to raise `httpx.Limits(max_connections=...)` or reduce concurrent fan-out — see `recommended-defaults.md`.
