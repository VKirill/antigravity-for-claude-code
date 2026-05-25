# Python — Reference Index

Slim navigator. Use this map to decide which reference file to open.

## Decision map

| You want to… | Open |
|---|---|
| Write idiomatic 3.14 syntax (match, walrus, type params, t-strings) | [syntax-and-types.md](syntax-and-types.md) |
| Add type hints, configure mypy, choose between mypy/pyright | [type-hints-and-mypy.md](type-hints-and-mypy.md) |
| Set up a project, manage deps, lockfiles, virtual envs | [packaging-and-uv.md](packaging-and-uv.md) |
| Configure lint + format for a repo | [ruff-and-formatting.md](ruff-and-formatting.md) |
| Pick between dataclass, NamedTuple, TypedDict, Pydantic | [dataclasses-and-data.md](dataclasses-and-data.md) |
| Write async code, choose asyncio vs threads vs multiprocessing | [async-and-concurrency.md](async-and-concurrency.md) |
| Design exceptions, handle errors, use ExceptionGroup | [error-handling.md](error-handling.md) |
| Use pathlib/itertools/functools/collections/json/datetime | [stdlib-essentials.md](stdlib-essentials.md) |
| Get started with pytest (foundation only) | [testing-with-pytest.md](testing-with-pytest.md) |
| Profile, understand GIL, free-threaded, JIT | [performance.md](performance.md) |
| Diagnose ImportError, circular imports, venv, encoding | [troubleshooting.md](troubleshooting.md) |
| Test the skill's routing behavior | [eval-cases.md](eval-cases.md) |

## Sibling Python skills

When the question is domain-specific, route to the sibling skill instead:

| Domain | Sibling skill |
|---|---|
| Async HTTP API (Pydantic models, dependency injection) | `fastapi` |
| Full-stack web (ORM, admin, templates) | `django` |
| DataFrames (mainstream) | `pandas` |
| DataFrames (Rust, fast, lazy) | `polars` |
| Classical ML | `scikit-learn` |
| Deep learning | `pytorch` |
| GPU / CUDA | `cuda-python` |
| Runtime validation, settings, BaseModel | `pydantic` |

## Quick-glance commands

```bash
# Project setup with uv
uv init myproject && cd myproject
uv python pin 3.14
uv add fastapi pydantic
uv add --dev pytest mypy ruff

# Daily workflow
uv sync                       # install from uv.lock
uv run pytest                 # run inside managed venv
uv run python -m mymodule
uv lock --upgrade-package zod # upgrade a single dep

# Lint + format
uv run ruff check --fix .
uv run ruff format .
uv run mypy src/
```

## Foundation philosophy

This skill is the foundation — siblings layer on top. Get these right here:

1. **Packaging**: one tool (uv), one config (`pyproject.toml`), one lockfile (`uv.lock`)
2. **Typing**: hints from day one, mypy or pyright in CI, `Protocol` for structural duck-typing
3. **Async**: `asyncio.run()` at the boundary, `TaskGroup` for structured concurrency
4. **Errors**: small `AppError` hierarchy, `raise ... from cause`, never bare `except:`
5. **Tooling**: ruff for lint+format, mypy for types, pytest for tests — no flake8/black/isort/yapf
