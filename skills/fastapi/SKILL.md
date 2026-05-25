---
name: fastapi
description: "FastAPI — modern async Python web framework on Starlette + Pydantic v2 with auto-generated OpenAPI 3.1. Use when: fastapi, fast api, FastAPI, async python api, python rest api, pydantic-backed api, async/await python web, path operation, APIRouter, include_router, Depends, sub-dependencies, dependencies with yield, BaseModel response, response_model, OAuth2PasswordBearer, OAuth2PasswordRequestForm, SecurityScopes, JWT python-jose PyJWT, passlib bcrypt argon2, CORSMiddleware, TrustedHostMiddleware, GZipMiddleware, lifespan asynccontextmanager, BackgroundTasks, StreamingResponse, EventSourceResponse, WebSocket, TestClient, AsyncClient httpx, dependency_overrides, uvicorn, gunicorn UvicornWorker, openapi auto-doc, Swagger UI, ReDoc. SKIP: Django (→django cascade), Flask (→flask cascade), Node frameworks (→fastify/hono), pure Pydantic schemas (→pydantic), SQLAlchemy ORM specifics (→sqlalchemy cascade)."
stacks:
  - fastapi
  - python
  - backend
tags:
  - fastapi
  - python
  - api
  - async
  - rest
  - pydantic
  - openapi
packages:
  - fastapi
  - uvicorn
  - gunicorn
  - python-multipart
  - python-jose
  - passlib
  - httpx
  - pydantic
manifests:
  - pyproject.toml
  - requirements.txt
source: vechkasov-global-skills
risk: high-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- FastAPI: `0.136.x`
- Pydantic: `2.13.x`
- Python: `3.14.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->


## Usage

Loaded automatically when its description matches the active task. Read only the section you need.

## Use this skill when

- Building or migrating a production HTTP API in Python with FastAPI (async-first, Pydantic v2)
- Designing path operations with typed `Annotated[T, Depends(...)]`, `Path`, `Query`, `Body`, `Form`, `File`, `Header`, `Cookie`
- Declaring request/response shapes with Pydantic `BaseModel` + `response_model`, status codes, multiple response types
- Composing modules via `APIRouter`, `include_router(..., prefix=, tags=, dependencies=)`
- Building dependency graphs — `Depends`, sub-dependencies, classes as dependencies, `yield` cleanup, global dependencies, `dependency_overrides` for tests
- Wiring security: `OAuth2PasswordBearer`, `OAuth2PasswordRequestForm`, `SecurityScopes`, JWT issuance/validation, password hashing
- Configuring middleware: `CORSMiddleware`, `TrustedHostMiddleware`, `GZipMiddleware`, `HTTPSRedirectMiddleware`, custom `@app.middleware("http")`, `exception_handler`
- Replacing legacy `@app.on_event("startup"/"shutdown")` with the `lifespan` async context manager
- Returning streamed data — `StreamingResponse`, SSE via `EventSourceResponse`, `FileResponse`, WebSockets
- Wiring async SQLAlchemy 2.0 + Alembic with a per-request `AsyncSession` dependency
- Generating OpenAPI 3.1 docs, customizing `/docs` (Swagger UI) and `/redoc`, generating typed clients
- Testing routes with `TestClient` (sync) and `httpx.AsyncClient` (async), using `dependency_overrides`
- Deploying behind Uvicorn workers / Gunicorn + UvicornWorker / Angie or Nginx reverse proxy / Docker with graceful SIGTERM

## Do not use this skill when

- Task is Django views / ORM / admin — use `django` (cascade)
- Task is Flask blueprints / extensions — use `flask` (cascade)
- Task is a Node.js HTTP framework — use `fastify`, `hono`, or `nodejs`
- Task is pure Pydantic schema authoring without HTTP context — use `pydantic` (sibling skill)
- Task is SQLAlchemy ORM mapping / query optimization in isolation — use `sqlalchemy` (cascade)
- Task is pytest authoring without HTTP testing — use `pytest` (cascade)
- Task is Anthropic/OpenAI SDK calls hosted behind FastAPI — use `claude-api` / OpenAI SDK skills for the LLM layer

## Purpose

FastAPI is the dominant async Python web framework for production REST/streaming APIs in 2026. It binds Pydantic v2 validation directly to path-operation type hints, generates OpenAPI 3.1 + Swagger UI / ReDoc automatically, and runs on the ASGI standard via Uvicorn or Hypercorn — async-native, no monkey-patching.

This skill covers the full server lifecycle: app construction with the lifespan context manager, path operations and routing modularity via `APIRouter`, the dependency-injection graph (including `yield` cleanup and `dependency_overrides`), Pydantic v2 integration patterns, OAuth2 + JWT security, middleware (built-in and custom), background tasks, streaming/SSE/WebSockets, async SQLAlchemy patterns, testing with `TestClient` and async `httpx.AsyncClient`, OpenAPI customization, and production deployment with Uvicorn workers behind a reverse proxy.

What this skill does NOT cover: Python language internals (see `python`), Pydantic schema authoring depth (see `pydantic`), SQLAlchemy ORM modeling (see `sqlalchemy` cascade), pytest test design (see `pytest` cascade), PostgreSQL operational concerns (see `postgresql`).

## Capabilities

Each line points to the canonical reference. The reference owns code, edge cases, and gotchas — do not duplicate them here.

- **Setup & project structure** — `uv` install, app factory pattern, Uvicorn vs Hypercorn, Gunicorn + `UvicornWorker`, hot-reload dev. → [setup.md](references/setup.md)
- **Routing** — path operations, `Annotated` params, `response_model`, status codes, additional responses, tags/summary/description, `APIRouter`, `include_router`, router-level dependencies. → [routing.md](references/routing.md)
- **Dependencies** — `Depends`, sub-dependencies, per-request caching, `yield` cleanup, classes as dependencies, global/router dependencies, `dependency_overrides`. → [dependencies.md](references/dependencies.md)
- **Pydantic v2 integration** — `BaseModel` as request body, `response_model`, `Field` validation, `model_config` / `ConfigDict`, `computed_field`, `AliasChoices`, body + path params, embedded body fields. → [pydantic-integration.md](references/pydantic-integration.md)
- **Security** — `OAuth2PasswordBearer`, JWT via `python-jose` / `PyJWT`, password hashing with `passlib[bcrypt]` / `argon2-cffi`, `SecurityScopes`, OpenAPI security schemes, CORS, `TrustedHostMiddleware`, rate limiting via `slowapi`. → [security.md](references/security.md)
- **Middleware** — built-in ASGI middlewares, `@app.middleware("http")`, `exception_handler`, `RequestValidationError`, GZip, HTTPS redirect, request-id pattern. → [middleware.md](references/middleware.md)
- **Lifespan** — `@asynccontextmanager` replacing `on_event`, dependency-free state init (`app.state`), async DB engine setup, graceful shutdown. → [lifespan.md](references/lifespan.md)
- **Background tasks & streaming** — `BackgroundTasks` fire-and-forget, `StreamingResponse`, SSE via `EventSourceResponse` / `sse-starlette`, `FileResponse`, WebSockets. → [background-and-streaming.md](references/background-and-streaming.md)
- **Databases** — async SQLAlchemy 2.0, `AsyncSession` dependency, transaction-per-request, Alembic migrations, pool sizing for asyncpg. → [databases.md](references/databases.md)
- **Testing** — `TestClient`, `httpx.AsyncClient` + `anyio`, `dependency_overrides`, pytest fixtures for app/DB rollback, parametrized routes. → [testing.md](references/testing.md)
- **OpenAPI & clients** — auto OpenAPI 3.1 schema, `/docs` Swagger / `/redoc`, custom OpenAPI hooks, `examples` and `openapi_extra`, generating typed clients. → [openapi-and-clients.md](references/openapi-and-clients.md)
- **Deployment** — Uvicorn `--workers N`, Gunicorn + `UvicornWorker`, behind Angie / Nginx, Dockerfile, healthcheck endpoint, graceful SIGTERM. → [deployment.md](references/deployment.md)
- **Recommended defaults** — workers, request timeouts, body size limits, `response_model_exclude_none`, JWT expiry, bcrypt rounds, CORS allowlist pattern. → [recommended-defaults.md](references/recommended-defaults.md)
- **Troubleshooting** — symptom-indexed: CORS preflight, 422 readability, dependency cycle, blocking sync in async endpoint, session leak, JWT expiry mismatch, OpenAPI generation failures. → [troubleshooting.md](references/troubleshooting.md)
- **Wrong vs Right** — blocking I/O in `async def`, leaking DB session, exposing internal models, missing `response_model`, trusting unvalidated body, auth logic outside `Depends`. → [wrong-vs-right.md](references/wrong-vs-right.md)
- **Eval cases** — routing tests, positive/negative prompts. → [eval-cases.md](references/eval-cases.md)

## Behavioral Traits

- Declares every parameter via `Annotated[T, ...]` — `Annotated[str, Query(...)]`, `Annotated[User, Depends(get_current_user)]`, never bare default-arg style
- Defines `response_model` on every public route — drives validation, OpenAPI schema, and field filtering
- Replaces `@app.on_event("startup"/"shutdown")` with a single `lifespan` async context manager
- Puts shared resources (DB engine, HTTP client, settings) on `app.state` inside `lifespan`, exposed via `Depends`
- Treats `Depends(...)` as the only injection mechanism — auth, DB session, settings, current user all flow through it
- Wraps DB session as a `yield` dependency so commit/rollback/close happen deterministically on every request
- Uses `dependency_overrides` for tests — never monkey-patches modules
- Never calls blocking I/O (sync `requests`, sync DB drivers, file I/O without `asyncio.to_thread`) inside `async def` endpoints
- Hashes passwords with `argon2-cffi` (or `passlib[bcrypt]`) — never plaintext, never SHA256
- Pins JWT `algorithms=["HS256"]` (or `RS256`) and refuses `alg: none`
- Sets explicit CORS allowlist — never `allow_origins=["*"]` with `allow_credentials=True`
- Defers numeric defaults (workers, timeouts, expiry) to [recommended-defaults.md](references/recommended-defaults.md) — no inline magic numbers
- Tests via `TestClient` for sync, `httpx.AsyncClient` for async — both can use `dependency_overrides`

## Important Constraints

- NEVER call sync blocking I/O inside an `async def` endpoint — it stalls the event loop for every request (see [wrong-vs-right.md](references/wrong-vs-right.md))
- NEVER return ORM model instances directly from a route without `response_model` — leaks internal fields and breaks OpenAPI schema
- NEVER skip `response_model` on public endpoints — Swagger UI shows the wrong schema and clients drift
- NEVER use `allow_origins=["*"]` together with `allow_credentials=True` — browsers silently drop the response
- NEVER trust `request.json()` data without a Pydantic body model — bypasses 422 validation
- NEVER place auth logic outside a `Depends` — duplicating the check is the #1 source of auth bypass bugs
- NEVER share a single `AsyncSession` across requests — sessions are stateful per-transaction
- NEVER pass `algorithms="HS256"` as a string to `jwt.decode` — must be a list; some libs accept both but it masks real bugs
- NEVER use the legacy `@app.on_event("startup"/"shutdown")` pair in new code — use `lifespan`
- NEVER hash passwords with MD5/SHA-1/SHA-256 — use Argon2id or bcrypt only
- ALWAYS validate `Authorization` header via `OAuth2PasswordBearer` (or an equivalent `Depends`) — never parse it manually
- ALWAYS close DB sessions via `yield ... finally: await session.close()` — leaked sessions exhaust the pool
- ALWAYS verify request size with `Content-Length` checks or a body-size middleware — see [recommended-defaults.md](references/recommended-defaults.md)
- ALWAYS set `app.openapi_tags`, route `tags`, and `summary/description` — they become the client SDK's namespace

## Related Skills

**90%-filter applied** — mainstream 2026 stack pairings with FastAPI in production.

### Language & runtime
- ✓ `python` — Python 3.14 LTS-aligned baseline
- ✓ `pydantic` — Pydantic v2 (FastAPI's validation engine)

### Alternative HTTP frameworks
- ✓ `fastify` — Node-native peer (same architecture: schema-based, async)
- ✓ `hono` — Web-Standards / edge peer

### Persistence
- `sqlalchemy` — SQLAlchemy 2.0 async ORM [cascade marker]
- ✓ `postgresql` — Postgres 18 (asyncpg / psycopg3 async)
- ✓ `redis` — Redis 8 (cache, rate-limit, session store)

### Auth (peer reference)
- ✓ `better-auth` — Node/TS auth library; useful as a feature parity reference

### Frontend consumers
- ✓ `nextjs`, ✓ `nuxt`, ✓ `react`, ✓ `vue` — clients consuming the OpenAPI schema

### Testing
- ✓ `pytest` — pytest 9 (fixtures, async tests, `dependency_overrides` plumbing)
- ✓ `playwright` — E2E against a live FastAPI server

### Deploy & ops
- ✓ `linux-sysadmin` — Ubuntu 24.04 / Angie / systemd / PM2 for managed Python processes
- `docker` — Docker 29 [cascade marker]

### Code discipline
- ✓ `karpathy-guidelines` — simplicity, surgical changes
- ✓ `skill-evaluation` — meta

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Index — decision map, reading order, conventions | [references/REFERENCE.md](references/REFERENCE.md) |
| Setup — uv install, project layout, Uvicorn/Hypercorn, Gunicorn+UvicornWorker, app factory, hot reload | [references/setup.md](references/setup.md) |
| Routing — path operations, Annotated params, response_model, status codes, APIRouter, include_router | [references/routing.md](references/routing.md) |
| Dependencies — Depends, sub-deps, yield, classes, caching, global, dependency_overrides | [references/dependencies.md](references/dependencies.md) |
| Pydantic v2 integration — BaseModel, response_model, Field, ConfigDict, computed_field, AliasChoices | [references/pydantic-integration.md](references/pydantic-integration.md) |
| Security — OAuth2PasswordBearer, JWT, password hashing, SecurityScopes, CORS, rate limiting | [references/security.md](references/security.md) |
| Middleware — built-ins, custom, exception_handler, GZip, HTTPS redirect, request-id | [references/middleware.md](references/middleware.md) |
| Lifespan — asynccontextmanager replacing on_event, app.state, async DB init | [references/lifespan.md](references/lifespan.md) |
| Background & streaming — BackgroundTasks, StreamingResponse, SSE, FileResponse, WebSockets | [references/background-and-streaming.md](references/background-and-streaming.md) |
| Databases — async SQLAlchemy 2.0, AsyncSession dependency, Alembic, asyncpg pool sizing | [references/databases.md](references/databases.md) |
| Testing — TestClient, httpx.AsyncClient + anyio, dependency_overrides, pytest fixtures | [references/testing.md](references/testing.md) |
| OpenAPI & clients — schema customization, examples, openapi_extra, typed client generation | [references/openapi-and-clients.md](references/openapi-and-clients.md) |
| Deployment — Uvicorn workers, Gunicorn, reverse proxy, Dockerfile, healthcheck, SIGTERM | [references/deployment.md](references/deployment.md) |
| **Recommended defaults** — workers, timeouts, body size, JWT expiry, bcrypt rounds, CORS | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Troubleshooting** — CORS, 422 readability, dep cycle, blocking sync, session leak, JWT expiry | [references/troubleshooting.md](references/troubleshooting.md) |
| **Wrong vs Right** — blocking I/O in async, leaking session, missing response_model, auth outside Depends | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases | [references/eval-cases.md](references/eval-cases.md) |

**How to use**: open the specific topic file. New project → `setup.md` + `routing.md` + `dependencies.md`. Adding auth → `security.md`. Database wiring → `databases.md` + `lifespan.md`. Production hardening → `recommended-defaults.md` + `deployment.md` + `troubleshooting.md`.
