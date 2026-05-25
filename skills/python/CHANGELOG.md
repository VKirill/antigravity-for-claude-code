# Changelog

All notable changes to the `python` skill are documented here. This skill follows SemVer at the skill level: MAJOR.MINOR.PATCH.

## 1.0.0 — Initial release

Foundation skill for all Python work in the skills repo. Sibling skills (cuda-python, pytorch, pandas, polars, scikit-learn, fastapi, django, pydantic) layer on top.

### Added

- `SKILL.md` — navigator with `Use this skill when` / `Do not use this skill when`, capabilities, behavioral traits, important constraints, related-skills cross-links, API reference table
- `references/REFERENCE.md` — decision map and quick-glance commands
- `references/syntax-and-types.md` — Python 3.12 → 3.14 modern syntax: PEP 695 type parameters, `type` statement, PEP 649/749 deferred annotations, PEP 750 t-strings, PEP 701 f-strings, PEP 758 except without parens, structural pattern matching, walrus, `Self`, `Annotated`, `override`, ExceptionGroup primer
- `references/type-hints-and-mypy.md` — full type system: `Protocol`, `TypedDict`, generics (PEP 695), `ParamSpec`, `Self`, `Annotated`, narrowing patterns, type guards, mypy strict config, mypy vs pyright comparison
- `references/packaging-and-uv.md` — uv as primary tool (init, add, sync, lock, tool, run), pyproject.toml schema (PEP 621 + PEP 735 dependency groups), uv vs pip vs poetry vs pdm vs conda, Docker integration
- `references/ruff-and-formatting.md` — ruff check + ruff format as one-tool replacement for flake8/black/isort/pyupgrade/etc., rule families, pre-commit, CI integration, migration
- `references/dataclasses-and-data.md` — decision tree across dataclass, NamedTuple, TypedDict, Pydantic, attrs; field options, `__post_init__`, frozen/slots/kw_only
- `references/async-and-concurrency.md` — asyncio fundamentals, TaskGroup (PEP 654), timeouts, cancellation, `to_thread`, anyio bridge, threading vs multiprocessing vs subinterpreters (PEP 734), free-threaded build (PEP 703/779)
- `references/error-handling.md` — exception hierarchy, custom `AppError`, `raise ... from`, `ExceptionGroup` + `except*`, contextlib (`@contextmanager`, `ExitStack`, `suppress`, `closing`), PEP 765 (3.14) on `return` in `finally`
- `references/stdlib-essentials.md` — pathlib, itertools, functools, collections, json, datetime/zoneinfo, subprocess, logging, argparse vs click vs typer
- `references/testing-with-pytest.md` — foundation only: fixtures, conftest.py, parametrize, mocking via `unittest.mock`, async tests via pytest-asyncio, coverage; pointer to dedicated pytest skill (planned)
- `references/performance.md` — GIL state in 3.14, PEP 703/779 free-threaded, PEP 744 JIT, profiling (cProfile, py-spy, scalene, tracemalloc, memray), NumPy/Cython/Numba/mypyc/PyO3 pointers
- `references/troubleshooting.md` — symptom-indexed: ModuleNotFoundError vs ImportError, circular imports, venv pollution, encoding errors, async-in-sync, mutable defaults, KeyError patterns, GIL deadlocks, slow imports, SIGPIPE, RecursionError, AssertionError under `-O`, memory growth
- `references/eval-cases.md` — routing eval prompts: positive (skill loads), negative (sibling Python skill loads instead), non-Python (skip), edge cases
- `CHANGELOG.md` — this file

### Cross-checked against

- Python 3.14 What's New (docs.python.org/3.14/whatsnew/3.14.html)
- uv official docs (docs.astral.sh/uv)
- ruff official docs (docs.astral.sh/ruff)
- mypy official docs (mypy.readthedocs.io)
- STACK_VERSIONS.md (Python 3.14.x pin)

### Notes

- This is the **foundation** Python skill. Siblings (fastapi, django, pandas, polars, scikit-learn, pytorch, cuda-python, pydantic) reference it and assume packaging/typing/async fundamentals are correctly in place.
- No version block in SKILL.md body — the sync script (`sync_skill_versions.py`) injects the `<!-- versions:start -->...<!-- versions:end -->` block after frontmatter when the skill is registered in `SKILL_STACKS`.
- No `risk: high-stakes` — Python is medium-stakes (type/perf decisions matter but no payment/auth lifecycle). Troubleshooting reference is provided regardless because Python failure modes are highly recognizable.
