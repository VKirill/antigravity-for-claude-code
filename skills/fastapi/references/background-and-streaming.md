# FastAPI — background tasks & streaming

## `BackgroundTasks` — fire-and-forget after response

```python
from fastapi import BackgroundTasks

async def send_email(to: str, subject: str, body: str):
    await mailer.send(to=to, subject=subject, body=body)

@app.post("/signup", status_code=201)
async def signup(
    payload: SignupIn,
    tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    user = await create_user(db, payload)
    tasks.add_task(send_email, user.email, "Welcome", "...")
    return {"id": user.id}
```

Behavior:

- The task runs **after the response is sent**.
- Tasks share the worker — long tasks block subsequent requests on that worker.
- Exceptions are logged but don't affect the response.
- No retries, no persistence. If durability matters, push to a queue (Celery/RQ/Dramatiq) instead.

When to use:

| Good fit | Bad fit |
|---|---|
| Send a single welcome email | Process a 1 GB video |
| Invalidate a cache | Long-running ML inference |
| Best-effort webhook notify | Anything that must survive a crash |

For anything heavy, hand off to a real queue.

## `StreamingResponse` — incremental body

```python
from fastapi.responses import StreamingResponse

@app.get("/large.csv")
async def export_csv(db: Annotated[AsyncSession, Depends(get_db)]):
    async def gen():
        yield "id,name,created_at\n"
        async for row in db.stream(select(User)):
            yield f"{row.id},{row.name},{row.created_at}\n"
    return StreamingResponse(gen(), media_type="text/csv")
```

Use cases:

- Large CSV / NDJSON / XML export — never materializes in memory.
- Proxying another service's stream.
- Server-Sent Events (see below).

Important: the dependency `yield` cleanup runs **after** the stream finishes. A streaming endpoint that consumes a DB session holds that session for the entire stream — size your pool accordingly.

## Server-Sent Events (SSE)

Two ways:

### 1. Hand-rolled `StreamingResponse`

```python
@app.get("/events")
async def events():
    async def gen():
        while True:
            data = await get_next_event()
            yield f"event: update\ndata: {json.dumps(data)}\n\n"
            if not data:
                break
    return StreamingResponse(gen(), media_type="text/event-stream")
```

Set `media_type="text/event-stream"` and use the `event: ... \ndata: ...\n\n` framing.

### 2. `sse-starlette` library (recommended)

```python
from sse_starlette.sse import EventSourceResponse

@app.get("/events")
async def events():
    async def gen():
        while True:
            yield {"event": "update", "data": {"x": 1}}
    return EventSourceResponse(gen())
```

Handles keep-alive pings, client disconnection, and `Last-Event-ID` resumption. Preferred for production SSE.

Behind a reverse proxy: disable buffering for SSE locations (Nginx/Angie `proxy_buffering off;`) — see [deployment.md](deployment.md).

## `FileResponse` — single-file download

```python
from fastapi.responses import FileResponse

@app.get("/files/{name}")
async def download(name: str):
    return FileResponse(
        path=f"/data/{name}",
        filename=name,
        media_type="application/octet-stream",
        headers={"Cache-Control": "private, max-age=3600"},
    )
```

Streams from disk. For S3-backed files, use `StreamingResponse` over the S3 streaming body.

## WebSockets

```python
from fastapi import WebSocket, WebSocketDisconnect

@app.websocket("/ws/{room}")
async def ws(websocket: WebSocket, room: str):
    await websocket.accept()
    try:
        while True:
            msg = await websocket.receive_json()
            await websocket.send_json({"echo": msg, "room": room})
    except WebSocketDisconnect:
        # client closed — clean up subscriptions, etc.
        ...
```

Dependency injection works on WebSocket routes too, but `BackgroundTasks` does **not** (no HTTP response phase).

Production considerations:

- Each connection holds a worker slot. Size workers accordingly (or run a WebSocket-dedicated process).
- Reverse-proxy timeouts must allow long-lived idle connections (set `proxy_read_timeout` generously and send keep-alive pings).
- Use channels (Redis pub/sub, NATS, or a dedicated WebSocket server) when scaling across multiple workers.

## Streaming JSON lines (NDJSON)

```python
@app.get("/items/stream")
async def stream_items():
    async def gen():
        async for item in iter_items():
            yield json.dumps(item) + "\n"
    return StreamingResponse(gen(), media_type="application/x-ndjson")
```

NDJSON is friendlier to clients than SSE if you don't need server-push semantics — just a way to deliver a large list incrementally.

## Anti-patterns

- ❌ Returning a giant `list[BaseModel]` from a route when streaming would do — memory blows up under concurrency.
- ❌ Holding a transactional DB session for a multi-minute stream — long-running transactions block VACUUM and cause replication lag.
- ❌ Using `BackgroundTasks` for retries — there are none. Use a real queue.
- ❌ Yielding chunks larger than 64 KiB without an `await` — starves other coroutines.
