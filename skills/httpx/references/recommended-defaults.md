# httpx — Recommended defaults

The single source of truth for numeric knobs. Other reference files refer here rather than inlining values.

## Client lifecycle

| Decision | Default |
|---|---|
| Use `Client` / `AsyncClient` as a context manager | Always |
| One `AsyncClient` per process for downstream API | Always — bind to framework lifespan |
| New client per test | Yes — use `MockTransport` or `ASGITransport` |
| Use bare `httpx.get(...)` at module scope | Only for throwaway scripts |

## Timeout

`httpx.Timeout(...)` accepts a single number (all phases) or per-phase values.

| Knob | Suggested baseline | Notes |
|---|---|---|
| `connect` | a few seconds | LAN: lower; cross-region cloud: higher |
| `read` | tens of seconds | Heavy report endpoints may need more |
| `write` | tens of seconds | Large uploads need more |
| `pool` | low single-digit seconds | If you hit `PoolTimeout`, raise `max_connections` instead |

Pattern:

```python
client = httpx.AsyncClient(
    timeout=httpx.Timeout(timeout=DEFAULT_TIMEOUT, connect=CONNECT_TIMEOUT),
)
```

Treat `timeout=None` (no timeout) as an explicit choice for streaming or long-poll endpoints — never as a global default.

## Redirects

| Knob | Default |
|---|---|
| `follow_redirects` (client) | `False` — opt in per client or per call |
| `follow_redirects` for browser-like GET to web pages | `True` only when expected |
| `follow_redirects` for API calls | `False` — APIs that 3xx mean something |
| `max_redirects` | leave default unless you see `TooManyRedirects` |

## Connection pool

`httpx.Limits(max_connections=..., max_keepalive_connections=..., keepalive_expiry=...)`.

| Knob | Tuning rule |
|---|---|
| `max_connections` | ≥ peak concurrent in-flight requests across all hosts |
| `max_keepalive_connections` | proportional to expected steady-state load |
| `keepalive_expiry` | set to less than the upstream's keep-alive timeout |

With HTTP/2 enabled, one connection serves many concurrent streams — keep `max_connections` modest.

## HTTP/2

| Decision | Default |
|---|---|
| `http2=True` on `AsyncClient` for high-concurrency API client | Yes, after `pip install httpx[http2]` |
| `http2=True` for one-off scripts | Not worth it |
| Verify with `response.http_version` in tests | Yes |

## TLS

| Decision | Default |
|---|---|
| `verify=True` | Always in production |
| `verify=False` | Never in production; fine for local dev with self-signed cert + `trustme` only |
| `truststore` for system CA store | Use in corporate environments with private CA |
| mTLS via `ssl.SSLContext` with `load_cert_chain` | Use when upstream requires |

## Auth

| Decision | Default |
|---|---|
| Bearer token via custom `httpx.Auth` subclass | Preferred over manual header injection per call |
| API key via `headers=` on `Client` | Fine when the key is static |
| OAuth2 refresh | Use `httpx.Auth` with `requires_response_body = True`, or a maintained library |
| Hash/sign per-request | Use `httpx.Auth.auth_flow` |

## Retries

| Decision | Default |
|---|---|
| Connect retry via `HTTPTransport(retries=N)` | One or two retries on `ConnectError`/`ConnectTimeout` |
| Status / read retry via `tenacity` or `stamina` | Wrap calls; jittered exponential backoff; cap attempts |
| Retry non-idempotent POSTs | Only with idempotency keys |
| Respect `Retry-After` on 429/503 | Always |

## Status checks

| Decision | Default |
|---|---|
| `response.raise_for_status()` after every call | Yes, unless code branches explicitly on status |
| Catch `httpx.RequestError` for network failures | Yes |
| Catch `httpx.HTTPStatusError` for 4xx/5xx | Yes |
| Bare `except Exception` around HTTP | Never |

## Streaming

| Decision | Default |
|---|---|
| Use `client.stream(...)` for responses > a few MB | Yes |
| Set `chunk_size` explicitly only when measured | Tune by profile |
| Close the streaming context before doing unrelated `await` work | Yes — frees pool slot |

## Testing

| Decision | Default |
|---|---|
| Use `ASGITransport` for FastAPI/Starlette tests | Yes — no real port |
| Use `MockTransport` / `respx` / `pytest-httpx` for upstream mocks | Yes |
| Monkey-patch httpx module globals in tests | Never — fragile |

## Logging

`httpx` and `httpcore` log to standard logging. Enable for debugging only — leave at INFO/WARNING in production to avoid leaking URLs and headers.

## What NOT to set

- `verify=False` — see TLS rules
- `timeout=None` — only when you know you're streaming or long-polling
- `follow_redirects=True` globally without auditing each route
- Excessively large `max_connections` "just in case" — wastes FDs
