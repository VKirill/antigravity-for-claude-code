# FastAPI — setup & project structure

## Install

Use `uv` (preferred) for fast resolution; `pip` works identically.

```bash
uv init my-api && cd my-api
uv add fastapi uvicorn[standard] pydantic
# optional production stack
uv add gunicorn python-multipart python-jose[cryptography] passlib[argon2] httpx
# dev
uv add --dev pytest pytest-asyncio anyio ruff mypy
```

`pip` equivalent:

```bash
pip install fastapi 'uvicorn[standard]' pydantic
pip install gunicorn python-multipart 'python-jose[cryptography]' 'passlib[argon2]' httpx
pip install --upgrade pytest pytest-asyncio anyio ruff mypy
```

Notes:
- `uvicorn[standard]` pulls `uvloop`, `httptools`, `watchfiles`, `python-dotenv` — wanted in production.
- `python-multipart` is required as soon as you use `Form` or `File`.
- Argon2id is preferred over bcrypt for new passwords; both are listed in [security.md](security.md).

## Project layout (recommended)

```
my-api/
├── pyproject.toml
├── src/
│   └── app/
│       ├── __init__.py
│       ├── main.py            # create_app() factory + uvicorn entry
│       ├── lifespan.py        # @asynccontextmanager
│       ├── settings.py        # pydantic-settings BaseSettings
│       ├── deps.py            # shared Depends (DB session, current_user, settings)
│       ├── security.py        # JWT issue/verify, password hashing
│       ├── routers/
│       │   ├── __init__.py
│       │   ├── users.py       # APIRouter(prefix="/users")
│       │   └── auth.py
│       ├── schemas/           # Pydantic BaseModel groups
│       └── db/
│           ├── engine.py      # async engine + sessionmaker
│           └── models.py      # SQLAlchemy 2.0 mapped classes
└── tests/
    ├── conftest.py            # app + AsyncClient fixtures, dependency_overrides
    └── test_users.py
```

The split is conventional, not enforced. Single-file `main.py` is fine for tiny services.

## App factory pattern

A factory makes tests cheap (fresh app per test, distinct `dependency_overrides`).

```python
# src/app/main.py
from fastapi import FastAPI
from app.lifespan import lifespan
from app.routers import auth, users

def create_app() -> FastAPI:
    app = FastAPI(
        title="My API",
        version="0.1.0",
        lifespan=lifespan,
        # docs_url=None,         # disable in prod if not public
        # redoc_url=None,
    )
    app.include_router(auth.router, prefix="/auth", tags=["auth"])
    app.include_router(users.router, prefix="/users", tags=["users"])
    return app

app = create_app()  # for `uvicorn app.main:app`
```

## Running locally

```bash
uvicorn app.main:app --reload --port 8000
# or with the factory pattern explicitly:
uvicorn 'app.main:create_app' --factory --reload --port 8000
```

The `fastapi` CLI (ships with `fastapi[standard]`) wraps Uvicorn:

```bash
fastapi dev src/app/main.py       # hot reload, dev defaults
fastapi run src/app/main.py       # prod-style, no reload
```

## Server choice: Uvicorn vs Hypercorn

| Concern | Uvicorn | Hypercorn |
|---|---|---|
| HTTP/1.1 + WebSocket | yes | yes |
| HTTP/2 | no | yes |
| HTTP/3 (QUIC) | no | yes (experimental) |
| Throughput on HTTP/1.1 | higher (uvloop + httptools) | lower |
| Default in FastAPI docs | yes | no |

Default to Uvicorn. Use Hypercorn only when you must terminate HTTP/2 inside Python (uncommon — usually the reverse proxy handles HTTP/2).

## Gunicorn + UvicornWorker (process manager)

Uvicorn has a `--workers N` flag, but Gunicorn gives proper process supervision, graceful reload, and per-worker memory bounds.

```bash
gunicorn app.main:app \
  -k uvicorn.workers.UvicornWorker \
  --workers 4 \
  --bind 0.0.0.0:8000 \
  --timeout 60 \
  --graceful-timeout 30 \
  --keep-alive 5 \
  --access-logfile - \
  --error-logfile -
```

Worker count math and timeout choices live in [recommended-defaults.md](recommended-defaults.md). Container deployments often skip Gunicorn (one container = one process); see [deployment.md](deployment.md).

## Hot-reload caveats

`--reload` watches the filesystem and respawns the worker. Two gotchas:

- It runs one worker. Don't measure throughput in reload mode.
- The lifespan context re-runs on every reload — a slow `init_db()` makes saves feel laggy. Guard expensive init behind `if not app.state.ready`.

## Settings via `pydantic-settings`

```python
# src/app/settings.py
from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="APP_", extra="ignore")
    database_url: str = Field(...)
    jwt_secret: str = Field(...)
    jwt_algorithm: str = "HS256"
    cors_origins: list[str] = []

@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
```

Inject in routes via `Depends(get_settings)`. The `lru_cache` makes it a singleton; override it in tests via `app.dependency_overrides[get_settings] = ...`. See [dependencies.md](dependencies.md).
