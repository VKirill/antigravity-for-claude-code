# FastAPI — middleware

FastAPI builds on Starlette ASGI middleware. You have three layers:

1. **Built-in middlewares** — `CORSMiddleware`, `TrustedHostMiddleware`, `GZipMiddleware`, `HTTPSRedirectMiddleware`, `SessionMiddleware`.
2. **Custom HTTP middleware** — quick to write, runs per request via `@app.middleware("http")`.
3. **Full ASGI middleware** — wraps the `scope/receive/send` triple; only when you need WebSocket-level control.

Order of registration matters: middlewares wrap each other in reverse order of `add_middleware` calls. The first registered runs **outermost** (last to see the response, first to see the request — actually the opposite is true for Starlette, which is the common gotcha; see below).

## Starlette execution order

Starlette/FastAPI wraps middlewares so that the **last-added is outermost**. In practice:

```python
app.add_middleware(GZipMiddleware)
app.add_middleware(CORSMiddleware, ...)
```

Request flow: `CORS → GZip → routes → GZip → CORS`. To make CORS the outermost (recommended), register CORS **last**. The community convention: register CORS as one of the last middlewares so it can attach headers to *every* response, including those raised by inner middlewares.

## Built-in middlewares

### `CORSMiddleware`

See [security.md](security.md) for the canonical config.

### `TrustedHostMiddleware`

```python
from fastapi.middleware.trustedhost import TrustedHostMiddleware

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["api.example.com", "*.example.com"],
)
```

Returns 400 on Host header mismatch. Use behind any proxy that may not strip `Host`.

### `GZipMiddleware`

```python
from fastapi.middleware.gzip import GZipMiddleware

app.add_middleware(GZipMiddleware, minimum_size=1000, compresslevel=5)
```

Skip if a reverse proxy (Angie/Nginx) already does gzip/Brotli — double compression wastes CPU.

### `HTTPSRedirectMiddleware`

```python
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
app.add_middleware(HTTPSRedirectMiddleware)
```

Redundant if the reverse proxy redirects HTTP→HTTPS. Adds 307 redirects in-process otherwise.

### `SessionMiddleware` (Starlette)

```python
from starlette.middleware.sessions import SessionMiddleware
app.add_middleware(SessionMiddleware, secret_key=settings.session_secret, https_only=True, same_site="lax")
```

Signs and stores small session payloads in a cookie. Not for large data; not a substitute for a server-side session store.

## Custom `@app.middleware("http")`

The 80% case — wraps every HTTP request with pre/post code.

```python
import time, uuid
from fastapi import Request

@app.middleware("http")
async def request_id_and_timing(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    start = time.perf_counter()

    # Make request_id available to downstream code via request.state
    request.state.request_id = request_id

    response = await call_next(request)

    duration_ms = (time.perf_counter() - start) * 1000
    response.headers["x-request-id"] = request_id
    response.headers["x-response-time-ms"] = f"{duration_ms:.1f}"
    return response
```

Reading from `request.state.request_id` inside endpoints is the standard pattern for log correlation.

## Custom ASGI middleware

When you need to intercept WebSocket frames, manipulate the request body before validation, or process streaming bodies, write a real ASGI middleware:

```python
class BodySizeMiddleware:
    def __init__(self, app, max_bytes: int):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        total = 0
        async def wrapped_receive():
            nonlocal total
            msg = await receive()
            if msg["type"] == "http.request":
                total += len(msg.get("body", b""))
                if total > self.max_bytes:
                    raise HTTPException(status_code=413, detail="Body too large")
            return msg
        await self.app(scope, wrapped_receive, send)

app.add_middleware(BodySizeMiddleware, max_bytes=10 * 1024 * 1024)
```

ASGI middleware bypasses FastAPI's exception handlers if it raises raw exceptions — catch and convert to `Response` directly when needed.

## Exception handlers

`@app.exception_handler(ExceptionClass)` catches errors raised anywhere in the route lifecycle and converts them to responses.

```python
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Pretty-print Pydantic v2 errors for the client
    errors = [
        {"loc": ".".join(map(str, e["loc"])), "msg": e["msg"], "type": e["type"]}
        for e in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": errors})


class DomainError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code, self.message, self.status_code = code, message, status_code

@app.exception_handler(DomainError)
async def domain_error_handler(request: Request, exc: DomainError):
    return JSONResponse(status_code=exc.status_code, content={"code": exc.code, "message": exc.message})
```

Two important rules:

- Exception handlers run **inside** middlewares — middleware always sees the response.
- `HTTPException` already has a default handler; override it only if you need a custom envelope.

## Headers always to set

- `X-Request-ID` (request-id middleware) — log correlation.
- `Cache-Control` on dynamic endpoints — default `no-store` to be safe.
- `Strict-Transport-Security` if not handled by proxy.
- Remove `Server` header (or override) — leak less version info.

Some teams add a `secure-headers`-style middleware that bundles HSTS / X-Content-Type-Options / X-Frame-Options / Referrer-Policy. There's no built-in for this in FastAPI; the `secure` PyPI package works.

## Common mistakes

- ❌ Mutating `request.state` from middleware to pass data to dependencies, when a `Depends(get_request_state)` would be cleaner.
- ❌ Catching all exceptions in a middleware — masks errors that should produce 500. Use `exception_handler` for typed errors instead.
- ❌ Running CPU-heavy work in middleware (image processing, large JSON parsing) — runs on every request, including health checks.
- ❌ Registering CORS first — inner middlewares' early returns then ship without CORS headers.
