# Changelog — fastapi skill

All notable changes to this skill follow [Semantic Versioning](https://semver.org/) at the skill level.

## v1.0.0 — 2026-05-16

### Added

- Initial skill for FastAPI (high-stakes, async Python web framework).
- Pattern 2 references layout under `references/`:
  - `REFERENCE.md` — decision map / index.
  - `setup.md` — install via `uv`, project structure, Uvicorn vs Hypercorn, Gunicorn + UvicornWorker, app factory, hot reload.
  - `routing.md` — path operations, `Annotated` params, `response_model`, status codes, `APIRouter`, `include_router`, router-level dependencies.
  - `dependencies.md` — `Depends`, sub-dependencies, per-request caching, `yield` cleanup, classes as deps, global deps, `dependency_overrides`.
  - `pydantic-integration.md` — `BaseModel` request/response, `Field`, `ConfigDict`, `computed_field`, `AliasChoices`, discriminated unions.
  - `security.md` — `OAuth2PasswordBearer`, JWT issuance/validation (PyJWT and python-jose), Argon2/bcrypt password hashing, `SecurityScopes`, CORS, rate limiting via `slowapi`.
  - `middleware.md` — built-in middlewares, `@app.middleware("http")`, full ASGI middleware, `exception_handler`, request-id pattern.
  - `lifespan.md` — `@asynccontextmanager` replacing `on_event`, `app.state`, typed state, graceful shutdown.
  - `background-and-streaming.md` — `BackgroundTasks`, `StreamingResponse`, SSE via `EventSourceResponse`, `FileResponse`, WebSockets.
  - `databases.md` — async SQLAlchemy 2.0, per-request `AsyncSession`, pool sizing, Alembic, test rollback fixture.
  - `testing.md` — `TestClient` (sync), `httpx.AsyncClient` (async, `ASGITransport`), `dependency_overrides`, lifespan in tests, parametrized routes.
  - `openapi-and-clients.md` — schema customization, examples, `operation_id`, separate input/output schemas, client generation.
  - `deployment.md` — Uvicorn workers, Gunicorn + UvicornWorker, reverse proxy (Angie/Nginx), Dockerfile, healthcheck, systemd, SIGTERM.
  - `recommended-defaults.md` — single source of truth for workers, timeouts, body limits, JWT expiry, password hashing rounds, CORS, SQLAlchemy pool, rate limits.
  - `troubleshooting.md` (REQUIRED for high-stakes) — symptom-indexed: CORS preflight, 422 readability, event-loop stalls, DB session leak, JWT expiry mismatch, dep cycles, OpenAPI generation failures, SSE proxy timeout, silent worker exit, 502 from proxy.
  - `wrong-vs-right.md` (REQUIRED for high-stakes) — 10 code pairs covering blocking I/O in async, session leaks, missing `response_model`, unvalidated body, auth outside `Depends`, CORS `*`+credentials, weak password hashing, deprecated `on_event`, module-level singletons, `BackgroundTasks` misuse.
  - `eval-cases.md` — positive/negative routing prompts.

### Conventions

- Frontmatter: `risk: high-stakes`; trigger-rich description (~1200 chars) covering names, classes, decorators, libraries.
- Concrete numbers (worker counts, timeouts, expiries) live only in `recommended-defaults.md`; other references link there.
- Code samples cross-checked against FastAPI 0.128.0 / 0.136.x API surface via Context7 MCP and official docs.
- No hardcoded version numbers in body; version block is sync-script-owned.
