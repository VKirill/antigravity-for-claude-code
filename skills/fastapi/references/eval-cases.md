# FastAPI — eval cases

Routing tests for the skill. Positive prompts should cause the `fastapi` skill to load; negative prompts should route to another skill (Django, Flask, Fastify, etc.) or to none.

## Positive — should load `fastapi`

1. "How do I add JWT auth to a FastAPI app?"
2. "Show me a `lifespan` context manager that initializes an `httpx.AsyncClient` and an async SQLAlchemy engine."
3. "Migrate this `@app.on_event('startup')` to the new lifespan pattern."
4. "Why is my FastAPI endpoint hanging? It's an `async def` that calls `requests.get(...)`."
5. "Generate a typed TypeScript client from my FastAPI OpenAPI schema."
6. "How to override `get_current_user` in tests with `dependency_overrides`?"
7. "I'm getting 422 on POST /items with this Pydantic body — how do I customize the error response?"
8. "Add CORS middleware that allows `https://app.example.com` with credentials."
9. "How do I stream NDJSON from a FastAPI endpoint?"
10. "Sketch a Gunicorn + UvicornWorker config behind Nginx for a 4-core VM."
11. "Why does my `Depends(get_db)` session leak the connection?"
12. "Add `SecurityScopes` to a route that needs `read:items`."
13. "FastAPI + SQLAlchemy 2.0 async — how do I write the session dependency?"
14. "Customize the OpenAPI schema to add `x-logo` under `info`."
15. "Send a Server-Sent Events stream from FastAPI."

## Negative — should NOT load `fastapi`

1. "How do I write a Django REST framework viewset?" → `django` (cascade)
2. "Convert this Flask blueprint to a `Blueprint`-style route." → `flask` (cascade)
3. "Build a Fastify route with TypeBox validation." → `fastify`
4. "Set up a Hono Cloudflare Worker." → `hono`
5. "Write a pure Pydantic model without any HTTP framework." → `pydantic`
6. "Configure SQLAlchemy 2.0 ORM relationships." → `sqlalchemy` (cascade)
7. "How do I write a pytest fixture with `tmp_path`?" → `pytest`
8. "PostgreSQL `EXPLAIN ANALYZE` for a slow query." → `postgresql`
9. "Generate a Pydantic v2 settings class for env vars." → `pydantic`
10. "Use Anthropic SDK to call Claude with tool use." → `claude-api`

## Mixed — should load `fastapi` plus a sibling

1. "FastAPI + Pydantic v2 — how do I expose `AliasChoices`?" → `fastapi` (primary) + `pydantic`
2. "FastAPI app on Ubuntu 24.04 with Angie reverse proxy." → `fastapi` + `linux-sysadmin`
3. "FastAPI + Redis rate limiting via `slowapi`." → `fastapi` + `redis`
4. "Test a FastAPI endpoint with `httpx.AsyncClient` and `pytest-asyncio`." → `fastapi` + `pytest`
5. "FastAPI Dockerfile for a Python 3.14 multi-stage build." → `fastapi` + `linux-sysadmin`

## Expected routing behavior

The skill description includes:
- Specific verbs: `path operation`, `Depends`, `response_model`, `lifespan`, `BackgroundTasks`
- Specific classes: `OAuth2PasswordBearer`, `OAuth2PasswordRequestForm`, `SecurityScopes`, `WebSocket`
- Specific tools: `uvicorn`, `gunicorn UvicornWorker`, `TestClient`, `AsyncClient httpx`
- SKIP markers for: Django, Flask, Node frameworks, pure Pydantic, SQLAlchemy ORM specifics

If a positive case fails to load this skill, the description is missing a trigger term — add it.
If a negative case loads this skill, the SKIP markers are too weak — strengthen them.
