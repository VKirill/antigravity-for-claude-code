# Packaging and uv

The 2026 default: **uv** (Rust-based, from Astral) for everything packaging-related — Python install, venvs, dependencies, lockfiles, tool installs, script runs. Single binary, replaces pip + virtualenv + pip-tools + pipx + most of poetry.

## Project init

```bash
uv init myproject         # creates pyproject.toml, .python-version, src/myproject/, README
cd myproject
uv python pin 3.14        # writes .python-version
uv add fastapi pydantic   # adds runtime dep + updates uv.lock
uv add --dev pytest mypy ruff  # adds to [dependency-groups].dev
uv sync                   # creates .venv/ and installs from uv.lock
```

The generated `pyproject.toml`:

```toml
[project]
name = "myproject"
version = "0.1.0"
description = "Add your description here"
readme = "README.md"
requires-python = ">=3.14"
dependencies = [
    "fastapi>=0.136",
    "pydantic>=2.13",
]

[dependency-groups]
dev = [
    "pytest>=8",
    "mypy>=1.11",
    "ruff>=0.6",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

## Daily workflow

```bash
uv sync                       # install from uv.lock (deterministic)
uv sync --group dev           # include dev group
uv sync --no-dev              # production install only

uv run python script.py       # run inside managed venv (no manual activate)
uv run pytest
uv run --with rich python -c "from rich import print; print('hi')"

uv add httpx                  # add + sync + update lockfile
uv add 'sqlalchemy>=2'        # version constraint
uv remove httpx               # remove + sync
uv lock --upgrade             # bump everything respecting constraints
uv lock --upgrade-package pydantic  # bump one
```

## Python interpreters

uv manages CPython versions itself — no need for pyenv, conda, or system installs.

```bash
uv python install 3.14        # download standalone build
uv python list                # show installed + downloadable
uv python pin 3.14            # writes .python-version in current dir
uv python pin --global 3.14   # default for all uv projects
```

`uv run` honors `.python-version`, then `requires-python` in `pyproject.toml`. uv auto-installs missing versions.

## Tools (replaces pipx)

```bash
uv tool install ruff
uv tool install mypy
uv tool list
uv tool upgrade ruff
uv tool run ruff check .      # one-shot, no install
uvx ruff check .              # alias for `uv tool run`
```

Tools install into isolated environments and expose binaries on PATH.

## Scripts (PEP 723 inline metadata)

Single-file scripts with declared deps:

```python
# script.py
# /// script
# requires-python = ">=3.14"
# dependencies = ["httpx", "rich"]
# ///
import httpx
from rich import print

print(httpx.get("https://httpbin.org/get").json())
```

```bash
uv run script.py              # creates ephemeral venv, installs deps, runs
```

## Lockfile

`uv.lock` is the source of truth — commit it. It pins exact versions, hashes, platform markers, and source URLs. `uv sync` is deterministic given the lock.

To regenerate without changing constraints: `uv lock`. To upgrade: `uv lock --upgrade` or `uv lock --upgrade-package <name>`.

**Never** edit `uv.lock` by hand.

## pyproject.toml schema

The single config file. Key tables:

```toml
[project]                          # PEP 621 — project metadata
name = "myproject"
version = "0.1.0"                  # or use dynamic = ["version"]
description = "..."
readme = "README.md"
requires-python = ">=3.14"
license = { text = "MIT" }
authors = [{ name = "You", email = "you@example.com" }]
dependencies = ["httpx>=0.27", "pydantic>=2"]

[project.optional-dependencies]    # extras: pip install pkg[cli]
cli = ["typer", "rich"]
postgres = ["asyncpg"]

[project.scripts]                  # entry points (CLI commands)
mycli = "myproject.cli:main"

[project.urls]
Homepage = "https://example.com"
Repository = "https://github.com/you/myproject"

[dependency-groups]                # PEP 735 — dev/test/docs groups (uv-aware)
dev = ["pytest>=8", "mypy>=1.11"]
docs = ["sphinx", "myst-parser"]

[build-system]                     # build backend
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.uv]                          # uv-specific settings
package = true                     # treat as installable package
default-groups = ["dev"]
managed = true

[tool.ruff]                        # delegated to ruff
line-length = 100
target-version = "py314"

[tool.mypy]                        # delegated to mypy
strict = true
python_version = "3.14"

[tool.pytest.ini_options]          # delegated to pytest
testpaths = ["tests"]
asyncio_mode = "auto"
```

## Dependency groups (PEP 735)

PEP 735 standardizes dev/test/docs groups in `[dependency-groups]` (distinct from `[project.optional-dependencies]`, which are installable extras).

```toml
[dependency-groups]
dev = ["pytest", "mypy", "ruff"]
docs = ["sphinx"]
ci = [{ include-group = "dev" }, { include-group = "docs" }]
```

Sync specific groups:

```bash
uv sync --group dev               # include dev
uv sync --group docs              # include docs
uv sync --only-group ci           # only the ci group
uv sync --no-default-groups       # base + nothing
```

## uv vs pip vs poetry vs pdm

| Tool | Role | When to use |
|---|---|---|
| **uv** | Package + venv + Python + tools | Default in 2026 — pick this first |
| pip | Install packages | Inside containers or legacy scripts |
| pip-tools | Lockfile generation | Subsumed by uv |
| virtualenv | Venv creation | Subsumed by uv |
| pipx | Install CLI tools | Subsumed by `uv tool` |
| poetry | Package + venv | Mature alternative; pre-existing projects |
| pdm | Package + venv (PEP 582) | Niche; PEP 582 was withdrawn |
| pyenv | Python version manager | Subsumed by `uv python` |
| conda | Package + scientific stack | Specialty: data/ML with C extensions, GPU |

The migration trajectory in 2025–2026: most new projects pick uv. Migrating from poetry: `uvx migrate-to-uv` (community migrator) or manual conversion of `pyproject.toml`.

## Inside Docker

```dockerfile
FROM python:3.14-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY . .
RUN uv sync --frozen --no-dev
CMD ["uv", "run", "myproject"]
```

`--frozen` rejects lockfile updates (use for CI/Docker), `--locked` is similar but fails on missing lock. `--no-install-project` defers project install until source is copied.

## Anti-patterns

- ❌ Mixing `pip install` and `uv add` in the same project — lockfile state diverges
- ❌ Shipping `requirements.txt` without a lockfile — transitive versions drift
- ❌ Committing `.venv/` — venvs are reproducible from `uv.lock`
- ❌ Using `pip install -e .` for local dev — use `uv sync` (already editable for the project itself)
- ❌ Pinning every dep with `==1.2.3` in `pyproject.toml` — leave constraints loose, let the lockfile pin
- ❌ Running `pip install` as root in containers — install at build time with uv into a layer
- ❌ Forgetting `uv lock` after editing `pyproject.toml` manually — uv will detect drift and refuse
