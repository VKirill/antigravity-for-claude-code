# FastAPI — deployment

## Single-process Uvicorn (small services / containers)

```bash
uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --proxy-headers \
  --forwarded-allow-ips='*' \
  --timeout-keep-alive 5
```

Best for one-container-one-process Docker / Kubernetes deployments. Let the orchestrator handle horizontal scaling.

## Multi-worker Uvicorn (bare-metal or VM)

```bash
uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 4 \
  --proxy-headers
```

Caveat: `--workers` runs separate processes (no shared memory). Lifespan startup runs **once per worker** — heavy resources (ML models) cost N× memory.

## Gunicorn + UvicornWorker (preferred for bare-metal Python services)

```bash
gunicorn app.main:app \
  -k uvicorn.workers.UvicornWorker \
  --workers 4 \
  --bind 0.0.0.0:8000 \
  --timeout 60 \
  --graceful-timeout 30 \
  --keep-alive 5 \
  --max-requests 10000 \
  --max-requests-jitter 1000 \
  --access-logfile - \
  --error-logfile -
```

Why Gunicorn over `uvicorn --workers`:

- Pre-fork model with proper SIGHUP reload (`kill -HUP <pid>` cycles workers without dropping the listening socket).
- Per-worker timeout supervision (`--timeout`) — Uvicorn alone has no per-request kill.
- `--max-requests` recycles workers periodically to prevent memory creep.
- Better signal handling for graceful shutdown.

Worker count math and concrete timeout values → [recommended-defaults.md](recommended-defaults.md).

## Behind a reverse proxy (Angie / Nginx)

```nginx
upstream fastapi {
    server 127.0.0.1:8000;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    location / {
        proxy_pass http://fastapi;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        proxy_read_timeout 60s;
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;

        client_max_body_size 10m;
    }

    # SSE / WebSockets: disable buffering and bump timeouts
    location /events {
        proxy_pass http://fastapi;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection "";
        proxy_read_timeout 1h;
    }

    location /ws {
        proxy_pass http://fastapi;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_read_timeout 1h;
    }
}
```

To trust `X-Forwarded-*`, run Uvicorn / Gunicorn with `--proxy-headers --forwarded-allow-ips='<proxy_ip>'`. Without these, `request.client.host` is the proxy, not the real client.

## Healthcheck endpoint

Cheap, no dependencies, no logs spam:

```python
@app.get("/healthz", include_in_schema=False)
async def healthz():
    return {"status": "ok"}

@app.get("/readyz", include_in_schema=False)
async def readyz(db: Annotated[AsyncSession, Depends(get_db)]):
    await db.execute(text("SELECT 1"))
    return {"status": "ready"}
```

- `/healthz` — liveness: the process is alive. Used by orchestrator restarts.
- `/readyz` — readiness: dependencies (DB, cache) are reachable. Used by load balancer to add/remove from rotation.

Filter access logs for `/healthz` to keep logs readable (Gunicorn `--access-logfile -` + a custom log format, or Uvicorn `--log-config`).

## Docker pattern

```dockerfile
FROM python:3.14-slim AS base

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install uv (fast pip)
RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY src/ ./src/

ENV PATH="/app/.venv/bin:${PATH}"

EXPOSE 8000

# One process per container — let the orchestrator scale horizontally
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
```

Multi-stage build for smaller images:

```dockerfile
FROM python:3.14-slim AS builder
RUN pip install --no-cache-dir uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

FROM python:3.14-slim
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY src/ ./src/
ENV PATH="/app/.venv/bin:${PATH}"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
```

## Graceful shutdown (SIGTERM)

The orchestrator sends SIGTERM, then SIGKILL after a grace period. Flow:

1. Uvicorn / Gunicorn receives SIGTERM.
2. Stops accepting new connections.
3. Lets in-flight requests finish, up to `--graceful-timeout` / `--timeout-graceful-shutdown`.
4. Runs `lifespan` shutdown — close DB pools, HTTP clients.
5. Exits.

Match the orchestrator grace period to `graceful-timeout` (e.g., Kubernetes `terminationGracePeriodSeconds: 60` and `--graceful-timeout 30`).

To trigger lifespan shutdown reliably, do NOT swallow signals:

```python
# Bad — never do this in a Python entrypoint
signal.signal(signal.SIGTERM, signal.SIG_IGN)
```

## systemd service (Ubuntu)

```ini
# /etc/systemd/system/api.service
[Unit]
Description=FastAPI app
After=network.target

[Service]
User=app
Group=app
WorkingDirectory=/opt/api
Environment="PATH=/opt/api/.venv/bin"
EnvironmentFile=/opt/api/.env
ExecStart=/opt/api/.venv/bin/gunicorn app.main:app -k uvicorn.workers.UvicornWorker \
    --workers 4 --bind 127.0.0.1:8000 --timeout 60 --graceful-timeout 30 \
    --access-logfile - --error-logfile -
ExecReload=/bin/kill -HUP $MAINPID
KillSignal=SIGTERM
TimeoutStopSec=45
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

`systemctl reload api` → Gunicorn cycles workers without dropping connections.

## Logging in production

- Use `structlog` or a JSON logger so logs are machine-parseable.
- Forward `X-Request-ID` from the request-id middleware into every log line.
- Suppress `/healthz` access logs (custom log format that drops 200s on that path).
- Log slow requests above a threshold (e.g., 500 ms) at WARN level.

OpenTelemetry has first-class FastAPI instrumentation (`opentelemetry-instrumentation-fastapi`) for distributed tracing — set up in lifespan.

## Anti-patterns

- ❌ `--workers N` without a process supervisor in a long-running VM — one OOM kill takes the service down.
- ❌ `pool_size × workers` greater than Postgres `max_connections` — connection storms.
- ❌ Lifespan-time migrations (`alembic upgrade head` in `lifespan`) with multiple workers — race condition.
- ❌ `client_max_body_size` 1m by default in Nginx/Angie while the route accepts 50 MB uploads — silent 413 from the proxy.
- ❌ Swallowing SIGTERM or using `os._exit()` in a shutdown handler — orchestrator can't drain cleanly.
