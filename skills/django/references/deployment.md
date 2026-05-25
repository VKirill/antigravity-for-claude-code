# Deployment

Production Django runs as **N application processes** behind a reverse proxy. The reverse proxy terminates TLS, serves static files (or delegates to Whitenoise), and forwards dynamic requests to the app processes.

## WSGI vs ASGI — pick once

| Mode | Server | Picks |
|---|---|---|
| **WSGI** | Gunicorn (sync workers) | Default. Sync views, no WebSockets, no per-request async I/O |
| **ASGI** | Gunicorn + UvicornWorker, or standalone Uvicorn | Async views, Channels (WebSockets), heavy concurrent I/O |

Don't run async views under WSGI in production — each request spins up a one-off event loop and pays the penalty.

## Gunicorn (WSGI) — the canonical sync deploy

```bash
gunicorn config.wsgi:application \
  --workers 4 \
  --threads 2 \
  --bind 127.0.0.1:8000 \
  --timeout 60 \
  --graceful-timeout 30 \
  --max-requests 1000 \
  --max-requests-jitter 100 \
  --access-logfile - --error-logfile -
```

- `--workers`: typically `2 * CPU + 1`; tune by load test
- `--threads`: only for `gthread` worker class; raise for I/O-bound apps
- `--max-requests` + `--max-requests-jitter`: recycle workers periodically to dodge memory leaks
- `--timeout`: request wall-clock kill; raise for legitimately slow endpoints
- `--graceful-timeout`: how long to wait for in-flight requests on `SIGTERM`

## Gunicorn + UvicornWorker (ASGI)

```bash
gunicorn config.asgi:application \
  --worker-class uvicorn.workers.UvicornWorker \
  --workers 4 \
  --bind 127.0.0.1:8000 \
  --timeout 60 \
  --graceful-timeout 30 \
  --access-logfile - --error-logfile -
```

You lose per-worker `--threads` (irrelevant for async) but keep Gunicorn's process management.

## Standalone Uvicorn

```bash
uvicorn config.asgi:application \
  --host 127.0.0.1 \
  --port 8000 \
  --workers 4 \
  --proxy-headers \
  --forwarded-allow-ips=127.0.0.1
```

Simpler, fewer moving parts; lacks Gunicorn's graceful-reload niceties. Good fit for container-orchestrated setups where the orchestrator handles process lifecycle.

## Static files with Whitenoise

In production, Django itself does not serve static files. Two options:

1. Serve them from the reverse proxy (Angie/Nginx) — fastest
2. Serve them from the Django process via Whitenoise — simplest

Whitenoise pattern:

```python
# settings/prod.py
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",       # right after SecurityMiddleware
    # ...
]

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
```

Deploy step:

```bash
python manage.py collectstatic --noinput
```

`CompressedManifestStaticFilesStorage` produces hashed filenames (`app.abc123.css`) for cache busting and ships gzip + brotli variants automatically.

## Media uploads

User-uploaded files (`FileField`, `ImageField`) go to `MEDIA_ROOT` and are served at `MEDIA_URL`. **Never** serve `MEDIA_ROOT` from Django in production — point the reverse proxy at the directory, or upload to object storage (S3, GCS) via `django-storages`.

```python
# settings/prod.py
DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"
AWS_S3_REGION_NAME = os.environ["AWS_S3_REGION"]
AWS_STORAGE_BUCKET_NAME = os.environ["AWS_S3_BUCKET"]
AWS_S3_FILE_OVERWRITE = False
AWS_QUERYSTRING_AUTH = False
```

## Behind Angie / Nginx

Minimal upstream config:

```nginx
upstream django_app {
    server 127.0.0.1:8000 fail_timeout=0;
}

server {
    listen 443 ssl http2;
    server_name myshop.example;

    ssl_certificate     /etc/letsencrypt/live/myshop.example/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/myshop.example/privkey.pem;

    client_max_body_size 25M;

    location /static/ {
        alias /srv/myshop/staticfiles/;
        access_log off;
        expires 30d;
    }

    location /media/ {
        alias /srv/myshop/media/;
    }

    location / {
        proxy_pass http://django_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

Then in settings:

```python
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True
```

For WebSockets / ASGI, add the `Upgrade` headers on the relevant `location`:

```nginx
location /ws/ {
    proxy_pass http://django_app;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
}
```

## `DEBUG=False` production checklist

Run before any production push:

```bash
python manage.py check --deploy
python manage.py migrate --check         # exits nonzero if pending migrations
python manage.py collectstatic --noinput --dry-run
```

Settings that must be set:

- [ ] `DEBUG = False`
- [ ] `SECRET_KEY` from env, never in source
- [ ] `ALLOWED_HOSTS` is a real list, not `["*"]`
- [ ] `CSRF_TRUSTED_ORIGINS` includes your scheme + host
- [ ] `SECURE_SSL_REDIRECT = True`
- [ ] `SECURE_HSTS_SECONDS` ≥ 1 year, with `SECURE_HSTS_INCLUDE_SUBDOMAINS` and `SECURE_HSTS_PRELOAD`
- [ ] `SESSION_COOKIE_SECURE = True`, `CSRF_COOKIE_SECURE = True`
- [ ] `SESSION_COOKIE_HTTPONLY = True`, `CSRF_COOKIE_HTTPONLY = True`
- [ ] `SECURE_CONTENT_TYPE_NOSNIFF = True`, `SECURE_REFERRER_POLICY = "same-origin"`
- [ ] Logging configured to stdout (for systemd / Docker journald)
- [ ] Database `CONN_MAX_AGE` set (see [recommended-defaults.md](recommended-defaults.md))
- [ ] Error reporting (Sentry) wired up

## `SECRET_KEY` rotation

```python
# settings/prod.py
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
SECRET_KEY_FALLBACKS = [
    os.environ.get("DJANGO_SECRET_KEY_OLD", ""),
]
```

`SECRET_KEY_FALLBACKS` (added years ago, still relevant) lets old signed cookies / password reset tokens continue to verify during rotation. Promote new → primary, demote old → fallback, leave for one cookie-lifetime, then remove.

## systemd unit example

```ini
# /etc/systemd/system/myshop.service
[Unit]
Description=MyShop Django
After=network.target postgresql.service redis.service

[Service]
Type=notify
User=myshop
WorkingDirectory=/srv/myshop
Environment="DJANGO_SETTINGS_MODULE=config.settings.prod"
EnvironmentFile=/etc/myshop/env
ExecStart=/srv/myshop/venv/bin/gunicorn config.wsgi:application \
  --workers 4 --bind 127.0.0.1:8000 \
  --timeout 60 --graceful-timeout 30 \
  --access-logfile - --error-logfile -
ExecReload=/bin/kill -s HUP $MAINPID
Restart=on-failure
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=35

[Install]
WantedBy=multi-user.target
```

Reload, not restart, on config-only changes: `systemctl reload myshop` (sends SIGHUP — Gunicorn re-execs workers without dropping the listener).

## Docker / containers

```dockerfile
FROM python:3.14-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --frozen --no-dev

COPY . .
RUN python manage.py collectstatic --noinput

EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--workers", "4", "--bind", "0.0.0.0:8000"]
```

Multi-stage builds, non-root user, healthcheck — all worth adding. Run `migrate` in an init container, not at app start.

## Healthcheck endpoint

```python
# config/urls.py
from django.http import JsonResponse
from django.db import connection

def healthz(request):
    try:
        connection.cursor().execute("SELECT 1")
    except Exception:
        return JsonResponse({"status": "degraded"}, status=503)
    return JsonResponse({"status": "ok"})

urlpatterns += [path("healthz/", healthz)]
```

Bypass CSRF and auth for this view; keep the DB check shallow.

## Logging

Send structured logs to stdout/stderr; let systemd / Docker collect them.

```python
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {"()": "pythonjsonlogger.jsonlogger.JsonFormatter",
                 "format": "%(asctime)s %(levelname)s %(name)s %(message)s"},
    },
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "json"}},
    "loggers": {
        "django.request": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "django.db.backends": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "": {"handlers": ["console"], "level": "INFO"},
    },
}
```

## Deploy order — zero-downtime sketch

1. Build artifact (Docker image / virtualenv tarball)
2. Run `migrate --check` against prod DB; abort if pending need attention
3. Run `migrate --noinput` (single one-shot process, not per-worker)
4. `collectstatic --noinput`
5. Roll workers: graceful reload (systemd reload / Gunicorn SIGHUP / orchestrator rolling update)
6. Verify `/healthz/`
7. Verify a real request path

Never let N web processes race to apply migrations on boot.
