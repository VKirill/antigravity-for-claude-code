# FastAPI — recommended defaults

Single source of truth for concrete numbers used elsewhere in this skill. Other references link here instead of hard-coding values.

## Server process

| Knob | Default | Tuning range | Why |
|---|---|---|---|
| Workers (CPU-bound mix) | `(2 × CPU_cores) + 1` | 2 .. CPU_cores × 4 | Gunicorn doc heuristic; covers I/O wait + CPU |
| Workers (mostly I/O-bound, async) | `CPU_cores` | 1 .. CPU_cores × 2 | Async doesn't benefit from many processes |
| Worker class | `uvicorn.workers.UvicornWorker` | — | The async-native worker |
| Keep-alive (seconds) | 5 | 2 .. 30 | Must be **less** than upstream LB idle timeout |
| Request timeout (seconds) | 60 | 10 .. 300 | Hard kill for stuck workers |
| Graceful timeout (seconds) | 30 | 15 .. 120 | Time given to finish in-flight requests on SIGTERM |
| Max requests per worker | 10_000 | 1_000 .. 100_000 | Recycles workers to bound memory creep |
| Max-requests jitter | 1_000 | 10–20% of max-requests | Prevents all workers cycling at once |

**Match the LB:** if your AWS ALB has `idle_timeout=60s`, set `keep-alive` to something like 5 and the server `--timeout-keep-alive` to 75 (above LB). Inversion causes 502 races.

## Body size limits

| Where | Default | Notes |
|---|---|---|
| Reverse proxy `client_max_body_size` | 10 MB | Bump per-route for upload endpoints |
| App-level body limit middleware | 10 MB (mirror the proxy) | Defense in depth |
| Multipart per-file limit | 50 MB | Stream large files; use a presigned-URL pattern for >100 MB |

## CORS

| Knob | Default | Tuning |
|---|---|---|
| `allow_origins` | explicit list from settings | NEVER `["*"]` with `allow_credentials=True` |
| `allow_credentials` | `True` only when needed | Default `False` — most APIs are bearer-token |
| `allow_methods` | `["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]` | Don't include `["*"]` with credentials |
| `allow_headers` | `["Authorization", "Content-Type", "X-Request-ID"]` | Extend as needed |
| `max_age` | 600 seconds | Preflight cache |

## JWT

| Knob | Default | Tuning |
|---|---|---|
| Algorithm | `HS256` (HMAC) for single-service; `RS256` for multi-service | Never `none`; never let the alg be client-controlled |
| Access token expiry | 15 minutes | 5 min .. 1 hour |
| Refresh token expiry | 7 days | 1 day .. 30 days |
| Secret length | ≥ 32 bytes (256 bits) for HS256 | Use `secrets.token_urlsafe(32)` |
| Required claims | `sub`, `iat`, `exp` | Add `aud`, `iss` for multi-service |
| Clock skew tolerance | 30 seconds (`leeway=30`) | 0 .. 120 seconds |

## Password hashing

| Algorithm | Setting | Notes |
|---|---|---|
| Argon2id (preferred) | `time_cost=3`, `memory_cost=64 MiB`, `parallelism=4` | passlib defaults are OK as a starting point; bench on your hardware |
| bcrypt | `rounds=12` | 12 is the sweet spot in 2026; bench should target ~250 ms per hash |

Rule of thumb: a password hash on production hardware should take **~250–500 ms**. Faster → too cheap to brute-force. Slower → DOS surface (each login burns CPU).

## Pydantic response defaults

| Knob | Recommended | Why |
|---|---|---|
| `response_model_exclude_none` | `True` for list endpoints | Smaller JSON; clients handle missing fields better |
| `response_model_by_alias` | `True` for camelCase APIs | Pydantic uses snake_case internally |
| `model_config["extra"]` on input models | `"forbid"` | Surfaces client typos as 422 |

## SQLAlchemy / Postgres

| Knob | Default | Notes |
|---|---|---|
| `pool_size` | 10 per worker | Connection-count math: `(pool_size + max_overflow) × workers + headroom ≤ pg max_connections` |
| `max_overflow` | 10 | Brief spike absorption |
| `pool_pre_ping` | `True` | Detect stale connections after idle |
| `pool_recycle` | 1800 (30 min) | Avoids server-side timeout drops |
| `expire_on_commit` (sessionmaker) | `False` | Required for async use; otherwise post-commit refetches break flow |
| `statement_timeout` (Postgres) | 30 seconds | Stops runaway queries; set per-session via `SET LOCAL statement_timeout` |

With **PgBouncer transaction pooling**:
- Disable SQLAlchemy prepared-statement cache (`connect_args={"prepared_statement_cache_size": 0}` for asyncpg).
- Keep `pool_pre_ping=True`.
- `pool_size` can be **smaller** since PgBouncer multiplexes.

## Rate limiting

| Tier | Limit | Notes |
|---|---|---|
| Auth endpoints (login, signup) | 5 / minute / IP | Aggressive; legitimate users rarely retry |
| Read endpoints | 60 / minute / user | Per-token, not per-IP |
| Write endpoints | 30 / minute / user | |
| Webhook receivers | 1000 / minute / source | High since they're machine-driven |

Backend: Redis via `slowapi` for distributed; in-memory for single-instance only.

## OpenAPI

| Knob | Default | Notes |
|---|---|---|
| `docs_url` in production | `None` or behind auth | `/openapi.json` leaks every route |
| `operation_id` per route | explicit, kebab-case | Stable SDK method names |
| `separate_input_output_schemas` | `True` (FastAPI default) | Clean SDKs |

## Logging

| Field | Default | Notes |
|---|---|---|
| Format | JSON | Machine-parseable |
| Correlate via | `X-Request-ID` middleware | Inject into every log line |
| Access log on `/healthz` | OFF | Drop the noise |
| Slow request threshold | 500 ms | Log at WARN above this |

## Where these numbers come from

- Gunicorn worker math: official Gunicorn deployment docs.
- Argon2id parameters: OWASP Password Storage Cheat Sheet.
- JWT expiry: RFC 7519 best practices; short access + longer refresh.
- SQLAlchemy pool sizing: SQLAlchemy 2.0 docs + PgBouncer interop notes.
- CORS quirks: WHATWG Fetch standard credentials rules.
