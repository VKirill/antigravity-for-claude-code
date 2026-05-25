# Recommended defaults

Single source of truth for numeric / boolean knobs. Other reference files link here instead of inlining values.

## Database connection

```python
# settings/base.py
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME":     os.environ["POSTGRES_DB"],
        "USER":     os.environ["POSTGRES_USER"],
        "PASSWORD": os.environ["POSTGRES_PASSWORD"],
        "HOST":     os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        "PORT":     os.environ.get("POSTGRES_PORT", "5432"),
        "CONN_MAX_AGE": 60,            # seconds; persistent connections
        "CONN_HEALTH_CHECKS": True,    # check liveness before reuse — added recent Djangos
        "ATOMIC_REQUESTS": False,      # let views opt-in via transaction.atomic
        "OPTIONS": {
            "connect_timeout": 5,
            "options": "-c statement_timeout=30000",   # 30s server-side cap
        },
    },
}
```

**`CONN_MAX_AGE`**
- `0` (default) → close after every request. Safe; wastes TCP setup time.
- `60` → reuse for 60 s. Good baseline behind a stateful reverse proxy.
- `None` → reuse forever. Only with `CONN_HEALTH_CHECKS = True`; otherwise dead connections poison the pool.

**With PgBouncer in transaction-pooling mode**: set `CONN_MAX_AGE = 0`. Django can't manage persistent connections through a transaction-pooled bouncer.

## Pool sizing

Django doesn't use a connection pool — one connection per worker process. Postgres `max_connections` budget:

```
max_connections ≥ (gunicorn workers × N hosts) + (celery workers × N hosts) + headroom (20)
```

Plan to land **well below** that ceiling. PgBouncer (session or transaction mode) lets you over-subscribe safely.

## HTTPS / cookies / security headers

```python
# settings/prod.py
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 365       # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True

SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_AGE = 60 * 60 * 24 * 14         # 14 days

CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_TRUSTED_ORIGINS = os.environ["DJANGO_CSRF_TRUSTED_ORIGINS"].split(",")
```

Roll HSTS out gradually: start at 1 hour, prove no mixed-content issues, raise to 1 day, then 1 year. Once you submit to the preload list, you can't roll back without out-of-band browser updates.

## File upload limits

```python
DATA_UPLOAD_MAX_MEMORY_SIZE  = 5 * 1024 * 1024     # 5 MB — non-file form data
FILE_UPLOAD_MAX_MEMORY_SIZE  = 5 * 1024 * 1024     # 5 MB — file in memory; larger goes to temp
DATA_UPLOAD_MAX_NUMBER_FIELDS = 1000               # DoS guard
DATA_UPLOAD_MAX_NUMBER_FILES  = 100
```

For genuinely large uploads (videos, archives), use direct-to-S3 / GCS presigned URLs — don't proxy through Django.

## Password hashing

Django 6 raises PBKDF2 iterations to 1,200,000. Keep the default:

```python
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
    "django.contrib.auth.hashers.ScryptPasswordHasher",
]
```

For new projects without legacy hashes, prefer Argon2 first (install `argon2-cffi`). Never write a custom hasher.

## CORS (django-cors-headers)

```python
CORS_ALLOWED_ORIGINS = os.environ["DJANGO_CORS_ALLOWED_ORIGINS"].split(",")
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_HEADERS = ["accept", "authorization", "content-type", "x-csrftoken", "x-requested-with"]
```

Never combine `CORS_ALLOW_ALL_ORIGINS = True` with `CORS_ALLOW_CREDENTIALS = True` — browsers silently drop the response.

## Gunicorn defaults

```bash
gunicorn config.wsgi:application \
  --workers $((2 * NPROC + 1)) \
  --threads 2 \
  --timeout 60 \
  --graceful-timeout 30 \
  --max-requests 1000 \
  --max-requests-jitter 100 \
  --keep-alive 5 \
  --bind 127.0.0.1:8000
```

Tune from load tests. `--max-requests` rotates workers to dodge memory leaks; jitter prevents synchronized restarts.

## Logging level

| Env | Root level | `django.request` | `django.db.backends` |
|---|---|---|---|
| dev | `DEBUG` | `DEBUG` | `WARNING` (set to `DEBUG` only when chasing N+1) |
| staging | `INFO` | `WARNING` | `WARNING` |
| prod | `INFO` | `WARNING` | `WARNING` |

Never run `django.db.backends` at `DEBUG` in production — every SQL statement gets logged.

## Cache TTLs (defaults, not laws)

| Use | TTL |
|---|---|
| Computed list (search results, leaderboards) | 60–300 s |
| Stable lookup (settings, categories) | 1 h |
| Reference data (countries, currencies) | 1 d |
| User session cache | matches `SESSION_COOKIE_AGE` |

## Celery defaults

```python
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_TASK_TIME_LIMIT = 60 * 5
CELERY_TASK_SOFT_TIME_LIMIT = 60 * 4
CELERY_TASK_DEFAULT_QUEUE = "default"
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_WORKER_MAX_TASKS_PER_CHILD = 1000
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
```

## Naming conventions

- App name: short lowercase noun (`shop`, `billing`, `auth`) — singular
- Model name: PascalCase singular (`Product`, `Order`, not `Products`)
- Field name: `snake_case`
- URL name: `<verb>_<noun>` or `<noun>_<view>` (`product_list`, `create_order`)
- URL pattern path: `kebab-case` (`/product-list/`, `/create-order/`)
- Template path: `<app>/<noun>_<page>.html` (`shop/product_list.html`)
- Signal handler: `on_<event>` (`on_order_paid`)
- Celery task: `<verb>_<noun>` (`send_receipt`, `index_product`)
- Migration: auto-generated; supplement with a slug (`0007_add_archive_flag`)
- Settings flag (project-specific): `MYAPP_<NAME>` (`SHOP_DEFAULT_CURRENCY`)
