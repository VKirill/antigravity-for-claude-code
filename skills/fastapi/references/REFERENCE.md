# FastAPI Reference Index

Slim navigator for FastAPI topics. Open the specific file when you need depth.

## Decision map

| If you need to... | Open |
|---|---|
| Start a new project, pick uvicorn/gunicorn, install via `uv` | [setup.md](setup.md) |
| Define a route or split a module via `APIRouter` | [routing.md](routing.md) |
| Wire auth/DB/settings injection or write a `yield` cleanup dep | [dependencies.md](dependencies.md) |
| Bind Pydantic v2 models to request/response | [pydantic-integration.md](pydantic-integration.md) |
| Add OAuth2 + JWT, hash passwords, lock down CORS | [security.md](security.md) |
| Add CORS / GZip / custom middleware / global exception handler | [middleware.md](middleware.md) |
| Initialize DB engine / HTTP client on startup, clean up on shutdown | [lifespan.md](lifespan.md) |
| Stream JSON lines, send SSE, accept WebSockets, fire-and-forget tasks | [background-and-streaming.md](background-and-streaming.md) |
| Use async SQLAlchemy 2.0 as a per-request `AsyncSession` | [databases.md](databases.md) |
| Write tests with `TestClient` or `httpx.AsyncClient` | [testing.md](testing.md) |
| Customize OpenAPI schema, expose examples, generate clients | [openapi-and-clients.md](openapi-and-clients.md) |
| Ship to production with Uvicorn workers, Gunicorn, Docker | [deployment.md](deployment.md) |
| Pick concrete values for workers/timeouts/expiry/CORS | [recommended-defaults.md](recommended-defaults.md) |
| Debug a CORS error, 422 noise, hanging request, JWT mismatch | [troubleshooting.md](troubleshooting.md) |
| Avoid the most painful anti-patterns | [wrong-vs-right.md](wrong-vs-right.md) |
| Run routing/eval tests on the skill | [eval-cases.md](eval-cases.md) |

## Reading order for a new project

1. `setup.md` — install, structure, run.
2. `routing.md` — path operations + `APIRouter`.
3. `dependencies.md` — DI graph, including DB session pattern.
4. `lifespan.md` — initialize resources.
5. `pydantic-integration.md` — request/response shapes.
6. `security.md` — auth.
7. `testing.md` — `dependency_overrides` from day one.
8. `recommended-defaults.md` + `deployment.md` — before going to prod.

## Convention

- Imports always use `from typing import Annotated` — `Annotated[T, Depends(...)]` is the canonical injection form
- All concrete numbers (workers, timeouts, expiries) live in `recommended-defaults.md` — references link, never inline
- High-stakes reactive content lives in `troubleshooting.md`; preventive contrast lives in `wrong-vs-right.md`
