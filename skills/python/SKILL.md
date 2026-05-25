---
name: python
description: "Python 3.14 foundation — syntax, type hints, packaging with uv, ruff/mypy, asyncio. Use when: python, pip, uv, pyproject.toml, ruff, mypy, type hints, dataclass, asyncio, TaskGroup, venv, poetry, поэтри, ImportError, ModuleNotFoundError, PEP 695, PEP 703 free-threading, PEP 750, typer, Protocol, TypedDict, Self. SKIP: fastapi/django, pandas/polars, scikit-learn/pytorch, cuda-python."
stacks:
  - python
risk: medium-stakes
packages:
  - uv
  - ruff
  - mypy
  - pytest
  - pip
tags:
  - python
  - language
  - runtime
  - typing
  - packaging
manifests:
  - pyproject.toml
  - requirements.txt
  - uv.lock
  - .python-version
source: generated-zero-baseline
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Python: `3.14.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->


## Usage

Loaded automatically when its description matches the active task. This is the **foundation skill** for all Python work — sibling skills (fastapi, django, pandas, polars, scikit-learn, pytorch, cuda-python) layer on top of these primitives. Read only the section you need, then follow the link to the relevant reference file.

## Use this skill when

- Writing Python from scratch — module structure, imports, `__main__`, entry points
- Adding type hints — `Protocol`, `TypedDict`, `ParamSpec`, `Self`, `Annotated`, generics
- Setting up a new project — `pyproject.toml`, choosing uv vs pip vs poetry, lockfiles, dependency groups
- Configuring ruff (lint+format) and mypy (type-check) for a repo
- Working with async — `asyncio.run`, `TaskGroup`, cancellation, gather, anyio bridge
- Modeling data — `dataclass` vs `TypedDict` vs `NamedTuple` vs Pydantic vs attrs decision
- Debugging Python errors — `ImportError`, circular imports, venv pollution, encoding, async-in-sync
- Profiling and optimizing — cProfile, py-spy, scalene; GIL vs free-threaded vs multiprocessing tradeoffs

## Do not use this skill when

- Building a FastAPI app — use `fastapi`
- Building a Django app — use `django`
- DataFrame work with pandas — use `pandas`
- DataFrame work with Polars — use `polars`
- ML / model training with scikit-learn — use `scikit-learn`
- Tensors / deep learning with PyTorch — use `pytorch`
- GPU compute / CUDA bindings — use `cuda-python`
- HTTP/web specifically — pick framework (`fastapi` / `django` / `flask`)

## Purpose

Python is a dynamic, gradually typed language with a strong ecosystem and a maturing toolchain. The 2026 baseline is **CPython 3.14** with deferred annotation evaluation (PEP 649/749), template strings (PEP 750), and officially-supported free-threaded builds (PEP 703 / PEP 779). The toolchain has consolidated around **uv** (Rust-based package/project manager, replaces pip+virtualenv+pip-tools+poetry), **ruff** (Rust linter+formatter, replaces flake8+isort+black), and **mypy** (or pyright) for static typing. This skill captures the language and toolchain decisions every Python project needs before any framework-specific work begins.

This is the **foundation skill** — narrower skills (FastAPI, Django, pandas, etc.) assume you have the basics right. Get packaging, types, async, and error handling correct here, and downstream skills can focus on their domain instead of relitigating which package manager or formatter to use.

## Capabilities

### Modern syntax and the type system

Python 3.12 introduced PEP 695 type parameter syntax (`def fn[T](x: T) -> T`) and the `type` statement; 3.14 adds deferred annotation evaluation and t-strings. Walrus (`:=`), structural pattern matching (`match`/`case`), and exception groups (`except*` + `ExceptionGroup`) are mainstream. The type system supports `Protocol` (structural typing), `TypedDict` (dict shapes), `Self`, `Literal`, `Annotated`, `ParamSpec`, and `override` from `typing` — covering most static-typing needs without third-party libraries.

→ [references/syntax-and-types.md](references/syntax-and-types.md) · [references/type-hints-and-mypy.md](references/type-hints-and-mypy.md)

### Packaging with uv

`uv` is the default in 2026 — it manages Python interpreters (`uv python install`), virtual environments (`uv venv`), dependencies (`uv add`/`uv remove`/`uv sync`), lockfiles (`uv.lock`), tool installations (`uv tool install ruff`), and one-shot script runs (`uv run script.py`). It is a drop-in replacement for `pip`, `virtualenv`, `pip-tools`, `pipx`, and most of `poetry`. `pyproject.toml` is the single configuration source (PEP 621 project metadata, PEP 735 dependency groups, build-system table).

→ [references/packaging-and-uv.md](references/packaging-and-uv.md)

### Linting and formatting with ruff

`ruff check` replaces flake8 + isort + pyupgrade + many smaller linters. `ruff format` replaces black. Configure via `[tool.ruff]` in `pyproject.toml`: `select` enables rule families (`E`, `F`, `I`, `UP`, `B`, `SIM`, `RUF`), `ignore` disables specific rules, `target-version` sets the Python version for upgrade fixes. One tool, one config, milliseconds-fast on a full repo.

→ [references/ruff-and-formatting.md](references/ruff-and-formatting.md)

### Data modeling

Four idiomatic options: `@dataclass` (stdlib, ergonomic with `slots=True`, `frozen=True`, `kw_only=True`), `NamedTuple` (immutable tuple subclass, lightweight), `TypedDict` (typed dict at the type-checker level only — no runtime enforcement), and Pydantic / attrs (when you need validation, parsing, or serialization). Pick by question: "do I need runtime validation?" → Pydantic. "Immutable record with equality?" → frozen dataclass. "Dict shape for an API payload?" → TypedDict.

→ [references/dataclasses-and-data.md](references/dataclasses-and-data.md)

### Async and concurrency

`asyncio` is the standard async runtime. The 2026 idiom is `asyncio.run(main())` at the entry point and `async with TaskGroup() as tg: tg.create_task(...)` for structured concurrency (PEP 654 — replaces `gather`-based patterns for most cases). `anyio` bridges asyncio and Trio. Decision matrix: I/O-bound concurrency → asyncio; CPU-bound parallelism → multiprocessing or free-threaded interpreter (PEP 703); throughput on many cores with shared state → `concurrent.interpreters` (PEP 734, new in 3.14).

→ [references/async-and-concurrency.md](references/async-and-concurrency.md)

### Error handling

Exceptions are the only sanctioned error-signaling mechanism. Build a small custom exception hierarchy rooted at one `AppError(Exception)` for your domain, use `raise NewError(...) from cause` to chain, and rely on `ExceptionGroup` + `except*` for concurrent or batched failures (PEP 654). `contextlib` covers context managers (`@contextmanager`, `ExitStack`, `suppress`). PEP 765 (3.14) now warns when `return`/`break`/`continue` exits a `finally` block.

→ [references/error-handling.md](references/error-handling.md)

### Stdlib essentials

Most Python work needs no third-party library: `pathlib.Path` (filesystem), `itertools` + `functools` (composition, `cache`, `partial`, `reduce`), `collections` (`Counter`, `defaultdict`, `deque`), `json` (with `default=` for custom types), `datetime` + `zoneinfo` (timezone-aware datetimes — never use naive `datetime.utcnow()`), `subprocess.run` (with `check=True`, never `shell=True` on untrusted input), `logging` (configure once at startup, never `print` in libraries), and `argparse` for CLIs (or `typer`/`click` for richer UX).

→ [references/stdlib-essentials.md](references/stdlib-essentials.md)

### Testing with pytest

`pytest` is the de facto runner. Fixtures (`@pytest.fixture`), parametrization (`@pytest.mark.parametrize`), monkeypatch, `tmp_path`, `caplog`, `conftest.py` for shared scope, `pytest-asyncio` for async tests. Mocking via `unittest.mock` (`patch`, `MagicMock`, `AsyncMock`). A separate `pytest` skill covers depth; this section gives the foundation.

→ [references/testing-with-pytest.md](references/testing-with-pytest.md)

### Performance

CPython has a Global Interpreter Lock (GIL) — one thread executes Python bytecode at a time. **In 3.14 the free-threaded build (no-GIL, PEP 703/779) is officially supported**; the experimental copy-and-patch JIT (PEP 744) shipped in 3.13 and stabilized in 3.14. Profile before optimizing: `cProfile` for call counts, `py-spy` for sampling without instrumentation, `scalene` for line-level CPU + memory + GPU. For CPU-bound work, prefer NumPy/Polars/Numba/Cython over hand-rolled optimization.

→ [references/performance.md](references/performance.md)

### Troubleshooting

Common Python failure modes are highly recognizable: `ModuleNotFoundError` vs `ImportError` (one is missing package, the other is the package itself failing to import), circular imports (move import to function scope or restructure), venv pollution (system site-packages bleeding in), encoding errors (always `encoding="utf-8"` on `open()`), `asyncio.run()` inside a running loop (you nested two event loops), and silent thread/coroutine swallows when exceptions don't propagate.

→ [references/troubleshooting.md](references/troubleshooting.md)

## Behavioral Traits

- Reaches for `uv` first for any package/venv/Python-version task — falls back to `pip` only inside containers or CI where uv isn't installed
- Adds type hints from day one — `from __future__ import annotations` is rarely needed in 3.14 (annotations are deferred by default per PEP 649)
- Uses `pathlib.Path` for filesystem work; never string-concatenates paths
- Uses `subprocess.run(..., check=True)` with a list argument; never `shell=True` on untrusted input
- Validates external input at the boundary (Pydantic for HTTP/JSON, `argparse`/`typer` for CLIs) — internal code trusts its types
- Chooses `dataclass` over `NamedTuple` when fields may need to mutate or grow; `frozen=True` + `slots=True` for value objects
- Configures `[tool.ruff]` and `[tool.mypy]` in `pyproject.toml` — never multiple separate config files
- Prefers `asyncio.TaskGroup` (PEP 654) over `asyncio.gather` for structured concurrency
- Pins Python version in `pyproject.toml` `requires-python` AND `.python-version` (for uv) — both, not one
- Uses `logging` (configured once at module entry) — never `print` in library code
- Raises specific exceptions (`ValueError`, `LookupError`, custom `AppError` subclass) — never bare `Exception` or `assert` for control flow

## Important Constraints

- NEVER `pip install` outside a virtual environment — global site-packages pollution corrupts the system Python
- NEVER mix package managers in one project (uv + poetry, pip + pipenv) — lockfile state diverges immediately
- NEVER use a bare `except:` clause — catches `SystemExit` and `KeyboardInterrupt`; use `except Exception:` at worst
- NEVER use mutable default arguments (`def f(x=[]):`) — the list is shared across all calls; use `None` + assign inside
- NEVER use `assert` for runtime checks in production code — `python -O` strips asserts
- NEVER call `asyncio.run()` from inside an already-running event loop — raises `RuntimeError`; use `await` instead
- NEVER catch and silently swallow exceptions (`except Exception: pass`) — at minimum log them with traceback
- NEVER use `eval`/`exec` on untrusted input — RCE vector
- NEVER claim "Python is single-threaded because of the GIL" — the GIL releases on I/O, and 3.14 free-threaded builds remove it entirely
- NEVER commit `__pycache__/`, `.venv/`, `*.pyc`, or `dist/` — gitignore them
- NEVER ship a `requirements.txt` without a corresponding lockfile (`uv.lock`, `requirements.lock`) — unpinned transitives are reproducibility bombs
- ALWAYS specify `encoding="utf-8"` on `open()` — platform default is `cp1252` on Windows
- ALWAYS use timezone-aware datetimes (`datetime.now(tz=UTC)`, `zoneinfo.ZoneInfo("Europe/Moscow")`) — naive datetimes silently lose timezone context

## Related Skills

90%-filter applied — mainstream 2026 choices only. Siblings marked with ↘ are being created in parallel and may not exist yet.

### Web frameworks (Python)
- ↘ `fastapi` — FastAPI for async HTTP APIs with Pydantic
- ↘ `django` — Django for full-stack web with ORM/admin

### Data / ML (Python)
- ↘ `pandas` — pandas DataFrames (mainstream)
- ↘ `polars` — Polars DataFrames (Rust-backed, fast)
- ↘ `scikit-learn` — classical ML pipelines
- ↘ `pytorch` — deep learning tensors and models
- ↘ `cuda-python` — NVIDIA CUDA Python bindings

### Validation
- ↘ `pydantic` — runtime validation, settings, BaseModel (de facto standard for API payloads)

### Peer languages
- ✓ `nodejs` — Node.js 24 (JS/TS backend counterpart)
- ✓ `typescript` — TypeScript 6 (peer type-system depth)

### Code discipline
- ✓ `karpathy-guidelines` — surgical changes, think before coding

### Tooling
- ✓ `git` · ✓ `linux-sysadmin` · ✓ `postgresql` · ✓ `redis`

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Index, decision map, when-to-use which doc | [references/REFERENCE.md](references/REFERENCE.md) |
| Modern syntax: PEP 695 type params, `type` statement, match/case, walrus, f-strings, t-strings | [references/syntax-and-types.md](references/syntax-and-types.md) |
| Type hints: Protocol, TypedDict, ParamSpec, Self, Annotated, mypy strict, pyright comparison, narrowing | [references/type-hints-and-mypy.md](references/type-hints-and-mypy.md) |
| Packaging: pyproject.toml, uv as primary tool, dependency groups, build-system, uv vs pip vs poetry | [references/packaging-and-uv.md](references/packaging-and-uv.md) |
| Linting + formatting: ruff check + ruff format, rule selection, pre-commit, replaces flake8/black/isort | [references/ruff-and-formatting.md](references/ruff-and-formatting.md) |
| Data modeling: dataclass vs NamedTuple vs TypedDict vs Pydantic vs attrs decision tree | [references/dataclasses-and-data.md](references/dataclasses-and-data.md) |
| Async: asyncio basics, TaskGroup PEP 654, cancellation, gather, anyio, threading vs asyncio vs multiprocessing | [references/async-and-concurrency.md](references/async-and-concurrency.md) |
| Error handling: exceptions, custom hierarchy, ExceptionGroup + except*, `raise from`, contextlib | [references/error-handling.md](references/error-handling.md) |
| Stdlib essentials: pathlib, itertools, functools, collections, json, datetime/zoneinfo, logging, argparse | [references/stdlib-essentials.md](references/stdlib-essentials.md) |
| Testing: pytest fixtures, parametrize, mocks, pytest-asyncio (foundation only — full skill comes separately) | [references/testing-with-pytest.md](references/testing-with-pytest.md) |
| Performance: GIL, PEP 703 free-threaded, PEP 744 JIT, cProfile/py-spy/scalene, NumPy/Cython pointers | [references/performance.md](references/performance.md) |
| Troubleshooting: ImportError, circular imports, venv, encoding, async-in-sync, GIL deadlocks | [references/troubleshooting.md](references/troubleshooting.md) |
| Routing eval cases: positive / negative / edge prompts for skill-routing tests | [references/eval-cases.md](references/eval-cases.md) |

**How to use**: open the specific topic file. Foundation skill — sibling skills (fastapi, django, pandas, polars, scikit-learn, pytorch, cuda-python) layer on top and assume packaging/types/async fundamentals are already in place.
