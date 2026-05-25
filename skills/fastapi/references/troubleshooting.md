# Troubleshooting — FastAPI

Symptom-indexed. Find your symptom, follow the diagnosis steps, apply the fix.

---

## CORS preflight (OPTIONS) returns 400 or browser blocks the response

**Symptoms**
- Browser console: `CORS error: No 'Access-Control-Allow-Origin' header`
- Curl works, browser doesn't
- `OPTIONS /api/...` returns 400 or 405
- `Access-Control-Allow-Origin: *` shows up but the browser still blocks (when credentials are involved)

**Diagnose**
```bash
# 1. Issue the preflight by hand
curl -i -X OPTIONS https://api.example.com/items \
  -H "Origin: https://app.example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization"

# 2. Look for: Access-Control-Allow-Origin: <your-origin> (not "*")
#               Access-Control-Allow-Credentials: true (only if needed)
#               Access-Control-Allow-Headers: <includes the requested ones>
```

**Common causes**
- `allow_origins=["*"]` with `allow_credentials=True` — browsers silently drop the response.
- `CORSMiddleware` registered AFTER a middleware that short-circuits the request — preflight never reaches CORS.
- Reverse proxy stripping CORS headers (Angie/Nginx with `proxy_hide_header`).
- A custom `add_middleware` returns a 4xx before `CORSMiddleware` runs.

**Fix**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://app.example.com"],   # explicit list
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)
```
Register CORS *last* (so it's the outermost wrapper). Reproduce against the live proxy, not just the FastAPI process.

---

## 422 Unprocessable Entity with cryptic `loc` paths

**Symptoms**
- Clients receive 422 with `detail: [{"loc": ["body", "items", 0, "price"], "msg": "Input should be a valid number"}]`
- Frontend can't show field-level error UI

**Diagnose**
- Inspect the request body sent by the client (`docs/network`) — usually a type mismatch or missing field.
- Compare against the OpenAPI schema at `/openapi.json`.

**Common causes**
- Field renamed without a `validation_alias` / `AliasChoices` mapping.
- Frontend sends string where a number is expected (`"19.99"` vs `19.99`).
- `model_config = ConfigDict(extra="forbid")` rejecting a legitimate new field.
- Coercion changes between Pydantic v1 and v2 (strict mode now coerces less).

**Fix**
Override the 422 handler to produce a friendlier shape:
```python
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_handler(request, exc):
    errors = [
        {"path": ".".join(map(str, e["loc"][1:])), "msg": e["msg"], "type": e["type"]}
        for e in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": errors})
```
Then surface the path-friendly errors to the user in the UI.

---

## Endpoint hangs / event loop stalls (high p99 latency)

**Symptoms**
- p99 latency jumps from 50 ms to 5+ seconds.
- Concurrent requests block each other on a single endpoint.
- CPU low; throughput collapsed.

**Diagnose**
```bash
# Find blocking calls in async endpoints
grep -nE "^\s*(time\.sleep|requests\.|psycopg2\.|open\()" src/app/routers/*.py
```
Inspect the suspicious endpoint:
```python
# Is this `async def` calling sync I/O?
@app.get("/...")
async def handler():
    r = requests.get(...)         # ← BLOCKS event loop
    data = open("file").read()    # ← BLOCKS
```

**Common causes**
- Sync HTTP client (`requests`) in an `async def` endpoint.
- Sync DB driver (`psycopg2`, `pymysql`) in an `async def` endpoint.
- `time.sleep(...)` instead of `await asyncio.sleep(...)`.
- CPU-heavy work (image processing, regex on large strings, gzip) inline.

**Fix**
- Replace `requests` with `httpx.AsyncClient`.
- Replace sync DB driver with `asyncpg` / `psycopg[async]` via SQLAlchemy 2.0.
- Offload CPU work to a thread pool: `await asyncio.to_thread(blocking_fn, *args)`.
- For long CPU work, push to a real queue (BullMQ/Celery/Dramatiq) — not `BackgroundTasks`.

See [wrong-vs-right.md](wrong-vs-right.md) for code pairs.

---

## DB session leak — `QueuePool limit of size N overflow M reached, connection timed out`

**Symptoms**
- After hours of normal traffic, the service starts returning 500.
- Logs: `TimeoutError: QueuePool limit of size 10 overflow 10 reached`
- Postgres `pg_stat_activity` shows many idle-in-transaction connections.

**Diagnose**
```sql
-- On Postgres
SELECT state, count(*) FROM pg_stat_activity GROUP BY state;
SELECT pid, state, query_start, query
FROM pg_stat_activity
WHERE state = 'idle in transaction' ORDER BY query_start;
```
Pool stats from SQLAlchemy:
```python
print(engine.pool.status())   # checked out / overflow / size
```

**Common causes**
- `Depends(get_db)` that doesn't close the session on exceptions — missing `try/finally` around `yield`.
- Long-running streaming endpoints holding a session for the full stream duration.
- Code path that creates `AsyncSession` manually and forgets `await session.close()`.
- `expire_on_commit=True` (default) causing re-fetches after `await commit()` and holding the transaction longer.

**Fix**
```python
async def get_db(request: Request) -> AsyncIterator[AsyncSession]:
    async with request.app.state.sessionmaker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```
Set `expire_on_commit=False` on the sessionmaker. See [databases.md](databases.md).

---

## JWT decode fails with "Signature has expired" right after issuance

**Symptoms**
- Token issued by `issue_jwt(...)` is rejected by `decode_jwt(...)` on the very next call.
- Different machines, different timezones, intermittent failures.

**Diagnose**
- Print `iat` / `exp` claims and compare to `datetime.now(timezone.utc)`.
- Check server clocks: `timedatectl status` (Linux).
- Look for `datetime.now()` (naive, local time) instead of `datetime.now(timezone.utc)` in token creation.

**Common causes**
- Mixed naive/aware `datetime` objects between sign and verify.
- Server clock skew > token validity window.
- `leeway=0` and very short expiry (e.g., 30 seconds) — clients see drift.

**Fix**
- Use `datetime.now(timezone.utc)` everywhere.
- Allow leeway: `jwt.decode(token, secret, algorithms=["HS256"], leeway=30)`.
- Sync clocks via `chrony` / `systemd-timesyncd`.

---

## Dependency cycle — `fastapi.exceptions.FastAPIError: Invalid args ... circular`

**Symptoms**
- App fails to start with a stack trace mentioning `Depends` resolution.
- Adding a new dependency to `get_current_user` triggers the error.

**Diagnose**
- Trace the `Depends` graph by hand. `A → B → C → A` is the bug.
- Common in: `get_current_user → get_db → settings` and `get_db → get_current_user` (don't!).

**Fix**
- Break the cycle. Settings should never depend on DB; DB should never depend on user.
- Use `Annotated` everywhere — type checkers catch some cycles statically.

---

## OpenAPI generation fails — `KeyError` or `RecursionError` at `/openapi.json`

**Symptoms**
- App boots, routes work, but `/openapi.json` 500s.
- Swagger UI shows a spinner forever.

**Common causes**
- Recursive Pydantic models without `model_rebuild()` after forward refs.
- A `Union[A, B]` where `A` and `B` share field names with conflicting types.
- A custom response class that doesn't expose a `media_type`.

**Fix**
- Call `Model.model_rebuild()` after defining forward references.
- Use discriminated unions: `Annotated[A | B, Field(discriminator="kind")]`.
- For custom responses, set `media_type` explicitly.

---

## "RuntimeError: This event loop is already running" in tests

**Symptoms**
- `TestClient` fails when used inside an `async def` test.
- Mixing `pytest-asyncio` and direct `asyncio.run` in fixtures.

**Common causes**
- Calling `TestClient` (which uses anyio internally) from within an asyncio test.
- Two async frameworks loaded simultaneously.

**Fix**
- For async tests, use `httpx.AsyncClient(transport=ASGITransport(app=app))`, not `TestClient`.
- Pick a single async test framework (`pytest-asyncio` OR `anyio`).

---

## SSE stream stops after exactly 30 / 60 seconds (proxy timeout)

**Symptoms**
- Browser EventSource reconnects every ~30 or 60 seconds.
- Server logs show normal completion; proxy logs show `upstream timed out`.

**Common causes**
- Nginx/Angie default `proxy_read_timeout` (60s) closes idle-looking connections.
- No keep-alive comments emitted on the stream.

**Fix**
- Per-location override: `proxy_read_timeout 1h; proxy_buffering off;`
- Emit a comment line every 15s to keep the connection lively: `yield ": keepalive\n\n"`.
- Use `sse-starlette`'s `EventSourceResponse(..., ping=15)`.

---

## Lifespan startup error swallowed — silent worker exit

**Symptoms**
- `uvicorn` / `gunicorn` exits with code 3 / SIGABRT immediately.
- No useful log output.

**Common causes**
- An exception raised before `yield` in `lifespan`.
- Missing `await` on an async resource init that returns a coroutine.

**Fix**
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        app.state.engine = create_async_engine(settings.database_url)
        # actively verify
        async with app.state.engine.connect() as c:
            await c.execute(text("SELECT 1"))
    except Exception as exc:
        logger.exception("startup failed", exc_info=exc)
        raise
    try:
        yield
    finally:
        await app.state.engine.dispose()
```
Always log before re-raising in startup so the actual cause appears.

---

## 502 from reverse proxy after long-idle connections

**Symptoms**
- Sporadic 502 Bad Gateway under low traffic.
- Logs: `upstream prematurely closed connection`.

**Common causes**
- Upstream `keepalive` timeout shorter than the proxy's idle timeout. Proxy reuses a connection the upstream has already closed.

**Fix**
- Set `--timeout-keep-alive` (Uvicorn) / `--keep-alive` (Gunicorn) **longer** than the proxy idle timeout.
- Or set the proxy idle timeout below the upstream's keep-alive.

See [recommended-defaults.md](recommended-defaults.md) for the relationship.
