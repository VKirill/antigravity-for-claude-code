---
name: pytest
description: "pytest 9 — Python's #1 testing framework. Use when: pytest, unit test python, fixture, parametrize, @pytest.mark, mocker, MagicMock, patch, conftest.py, pytest-cov, coverage, pytest-asyncio, pytest-xdist, pytest-mock, pytest 9, async test, pytest fixture scope, hypothesis, monkeypatch, tmp_path, capsys, pyproject.toml [tool.pytest.ini_options]. SKIP: JavaScript/TypeScript unit tests (→vitest), E2E browser automation (→playwright), Django built-in TestCase only (→django)."
stacks:
  - pytest
  - Python
packages:
  - pytest
  - pytest-cov
  - pytest-asyncio
  - pytest-mock
  - pytest-xdist
  - hypothesis
manifests:
  - pyproject.toml
  - pytest.ini
tags:
  - pytest
  - testing
  - python
source: vechkasov-global-skills
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- pytest: `9.x`
- Python: `3.14.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need, then follow the link to the relevant reference file.

## Use this skill when

- Setting up pytest in a new project (`pyproject.toml [tool.pytest.ini_options]`, `testpaths`, `addopts`, `conftest.py`)
- Writing tests with `assert`, `pytest.raises`, `pytest.warns`, `pytest.approx`, `pytest.mark.*`
- Designing fixtures: scopes (function/class/module/package/session), `yield` cleanup, `autouse`, parametrized fixtures, factory fixtures
- Parametrizing tests with `@pytest.mark.parametrize`, stacked params, `pytest.param` with marks, `indirect=True`
- Mocking with `unittest.mock.patch`, `MagicMock`, `autospec`, `side_effect`, or the pytest-mock `mocker` fixture
- Testing async code with `pytest-asyncio` (`@pytest.mark.asyncio`, `@pytest_asyncio.fixture`, `loop_scope`)
- Measuring coverage with `pytest-cov` (`--cov`, `--cov-report=term-missing`, branch coverage, thresholds)
- Running tests in parallel with `pytest-xdist` (`-n auto`, load distribution, group isolation)
- Property-based testing with Hypothesis (`@given`, strategies, settings, shrinking)
- Snapshot testing with `syrupy` (assertion-style snapshots, update workflow)
- Debugging flaky tests: collection errors, fixture-not-found, async hangs, shared state
- Migrating from pytest 8 → 9 (Python 3.9 dropped, duplicate path handling, `PytestRemovedIn9Warning` → error, native TOML)

## Do not use this skill when

- Task is JS/TS unit testing (Vitest/Jest semantics, not pytest) — use `vitest`
- Task is browser E2E automation — use `playwright`
- Task is Django built-in `TestCase`/`Client` without pytest involved — use `django` directly
- Task is `unittest` module (stdlib) idiom without pytest — different runner, different conventions
- Task is load testing, BDD (`pytest-bdd` only marginally — confirm scope), or contract testing

## Purpose

pytest is the de-facto Python test framework in 2026. It replaces `unittest` boilerplate with plain `assert`, rich introspection on failure, and a fixture system that composes deterministic test state without inheritance hierarchies. Around pytest sits the most mature plugin ecosystem in Python testing: `pytest-cov` for coverage, `pytest-asyncio` for `async def` tests, `pytest-xdist` for parallel runs, `pytest-mock` for the `mocker` fixture, Hypothesis for property-based generation.

pytest 9 dropped Python 3.9, promoted `PytestRemovedIn9Warning` to errors, added native TOML support (`pytest.toml` / `[tool.pytest]` in `pyproject.toml` with real TOML types — not the legacy INI-compat mode), shipped first-party subtests, and tightened duplicate-path collection. This skill covers v9 specifics, the full fixture + parametrize + mark surface, mocking (with the common `unittest.mock` vs pytest-mock `mocker` confusion resolved), async testing, coverage, parallelism, and the most common failure modes encountered when scaling a test suite.

## Capabilities

### Test discovery & invocation

pytest discovers files named `test_*.py` or `*_test.py`, classes named `Test*` (no `__init__`), and functions/methods named `test_*`. Layout: `src/<pkg>/` for code, `tests/` for tests at repo root; `tests/conftest.py` shares fixtures across the tree. Run with `pytest`, narrow with `pytest tests/test_foo.py::TestClass::test_method`, filter by keyword `-k 'login and not legacy'`, by marker `-m 'slow'`, fail fast `-x`, show locals on failure `-l`, control traceback style `--tb=short|long|line|native|no`.

> See [references/basics.md](references/basics.md).

### Fixtures

`@pytest.fixture` produces test inputs and cleanup. Scopes: `function` (default), `class`, `module`, `package`, `session`. `yield`-style fixtures run teardown after the yield. `autouse=True` applies a fixture to every test in its scope — use sparingly. Fixtures resolve by name in the test signature; `conftest.py` files share fixtures hierarchically (closest `conftest.py` wins). Factory pattern: a fixture returns a callable that builds objects on demand. Parametrized fixtures (`params=[...]`) multiply downstream tests; `request.param` reads the current value. `indirect=True` on `@pytest.mark.parametrize` routes params through the fixture.

> See [references/fixtures.md](references/fixtures.md).

### Parametrize

`@pytest.mark.parametrize("a,b,expected", [(1, 2, 3), ...])` produces one test per row. Stack multiple `@parametrize` decorators for cartesian product. `pytest.param(value, marks=pytest.mark.xfail, id="case-name")` attaches per-row marks and stable IDs. `ids=` accepts a list or callable. `indirect=("fixture_name",)` makes a param flow through the fixture instead of being injected directly.

> See [references/parametrize.md](references/parametrize.md).

### Marks

Built-ins: `skip`, `skipif(condition, reason=...)`, `xfail` (run but expect failure; `strict=True` fails on unexpected pass), `parametrize`, `usefixtures`, `filterwarnings`. Custom marks register in `pyproject.toml` under `[tool.pytest.ini_options].markers`, run via `pytest -m slow`. **Always set `--strict-markers`** so typos in mark names raise instead of silently passing.

> See [references/marks.md](references/marks.md).

### Mocking — `unittest.mock` vs `pytest-mock`

Two equivalent paths, different ergonomics:

- **`unittest.mock.patch`** (stdlib): use as decorator `@patch("pkg.mod.func")`, context manager `with patch(...)`, or `patch.object(cls, "method")`. Mocks are torn down automatically. `autospec=True` enforces the target's signature.
- **`pytest-mock`** `mocker` fixture: `mocker.patch("pkg.mod.func", return_value=...)`. No decorator stacking, no nested `with`, automatic teardown via fixture scope. Preferred in pytest-native code.

Both wrap the same `MagicMock`. `side_effect=callable | exception | iterable`, `return_value=...`, `mock.assert_called_with(...)`, `mock.assert_called_once_with(...)`, `ANY` for "don't care" args. Always patch where the name is **looked up**, not where it's defined.

> See [references/mocking.md](references/mocking.md).

### Async testing

Install `pytest-asyncio`. Default mode is `strict` — mark each async test with `@pytest.mark.asyncio` and async fixtures with `@pytest_asyncio.fixture`. Set `asyncio_mode = "auto"` in config to auto-mark every `async def test_*`. Control event-loop sharing with `loop_scope="session"` etc. For libraries using `anyio`, use the `anyio_backend` fixture instead.

> See [references/async-testing.md](references/async-testing.md).

### Configuration

Preferred: `pyproject.toml` under `[tool.pytest.ini_options]`. Alternatives: `pytest.ini`, `tox.ini [pytest]`, `setup.cfg [tool:pytest]`. Pytest 9 adds native TOML data types via `[tool.pytest]` or standalone `pytest.toml` (not yet universal — keep `[tool.pytest.ini_options]` for compatibility). Common keys: `testpaths`, `python_files`, `python_classes`, `python_functions`, `addopts`, `markers`, `filterwarnings`, `asyncio_mode`, `xfail_strict`.

> See [references/configuration.md](references/configuration.md).

### Plugins

Most-loaded plugins in 2026: `pytest-cov` (coverage), `pytest-xdist` (parallel `-n auto`), `pytest-mock` (`mocker` fixture), `pytest-asyncio` (async), `pytest-randomly` (random test order — catches order dependencies), `pytest-timeout` (per-test timeout), `hypothesis` (property-based), `pytest-django` / `pytest-flask` (framework integration), `pytest-httpx` (mock httpx), `pytest-freezer` / `freezegun` (frozen time), `syrupy` (snapshots).

> See [references/plugins.md](references/plugins.md).

### Coverage

`pytest --cov=src --cov-report=term-missing --cov-report=html`. Branch coverage with `--cov-branch`. Threshold with `--cov-fail-under=80`. Configure exclusions in `[tool.coverage.run]` (`source`, `branch`, `omit`) and `[tool.coverage.report]` (`exclude_lines`, `fail_under`, `show_missing`) inside `pyproject.toml`. `.coveragerc` works too; pyproject is preferred.

> See [references/coverage.md](references/coverage.md).

### Property-based testing

Hypothesis generates inputs from `@given(st.integers(), st.text())` and shrinks failing cases to minimal counter-examples. `settings(max_examples=200, deadline=500)` tunes per-test budget. Example database persists past failures for regression. Works with pytest fixtures via `@given(...)` applied **after** `@pytest.fixture`-using parameters in the signature.

> See [references/property-based.md](references/property-based.md).

### Snapshots & approval testing

`syrupy` provides a `snapshot` fixture: `assert result == snapshot`. First run records, subsequent runs compare. Update with `--snapshot-update`. Use snapshots for stable serialized output (HTML, JSON dumps, rendered text); avoid for values where any change is meaningful — use explicit assertions instead.

> See [references/snapshot-and-approval.md](references/snapshot-and-approval.md).

### Troubleshooting

Common failures: collection errors from `conftest.py` import-time exceptions, `fixture 'X' not found` (typo or wrong conftest layer), async test hangs (missing `pytest-asyncio` install or wrong mode), parametrize ID encoding for non-ASCII values, flaky tests from shared module state or time-dependent assertions, slow suite detection with `--durations=10`.

> See [references/troubleshooting.md](references/troubleshooting.md).

### Recommended defaults

Use `pytest-randomly` always (order independence is a feature, not a chore). Use `pyproject.toml` for config. Keep `--strict-markers` and `xfail_strict = true` in `addopts`. Put `conftest.py` at the **lowest common ancestor** of tests that share fixtures — not at the repo root by default. Treat `autouse` as a code smell unless the fixture is truly always-on (e.g., DB transaction rollback).

> See [references/recommended-defaults.md](references/recommended-defaults.md).

## Behavioral Traits

- Writes tests with plain `assert` — never `self.assertEqual(...)` (pytest's introspection handles assertion messages)
- Names tests for the behavior under test, not the function: `test_login_rejects_expired_token`, not `test_login`
- Puts shared fixtures in `conftest.py` at the lowest common ancestor of the tests using them
- Prefers `mocker` fixture (pytest-mock) over `unittest.mock.patch` in pytest-native code — fewer decorator stacks, automatic teardown
- Uses `autospec=True` whenever patching — prevents tests passing on misspelled attributes
- Uses `pytest.raises(SpecificError, match="regex")` — never bare `pytest.raises(Exception)`
- Registers every custom mark in `pyproject.toml` — runs with `--strict-markers` so typos fail loud
- Sets `xfail_strict = true` — an "expected failure" that passes should fail the suite
- Reaches for parametrize before duplicating test bodies — one signature, many cases
- Keeps fixture scope as narrow as possible (`function` default) — promotes only with measured wins
- Patches at the **import site**, not the definition site (`patch("myapp.service.requests.get")`, not `patch("requests.get")`)

## Important Constraints

- NEVER use `@pytest.fixture` on `async def` and expect it to work in strict mode — use `@pytest_asyncio.fixture` (or set `asyncio_mode = "auto"`)
- NEVER patch the thing under test — patch its **collaborators** only
- NEVER share mutable module-level state across tests — random order (`pytest-randomly`) will surface the bug eventually
- NEVER assume `tmp_path` content persists across tests — it's function-scoped by design; use `tmp_path_factory` for session scope
- NEVER commit `.coverage` files or `htmlcov/` — add to `.gitignore`
- NEVER run `pytest --cov` in watch loops — it slows the suite ~2x; use it in CI only
- ALWAYS run `--strict-markers` and `--strict-config` — typos in marker names or ini keys should fail loud
- ALWAYS use `pytest.approx(value, rel=..., abs=...)` for floating-point — never raw `==`
- ALWAYS pin `pytest-asyncio` mode (`strict` or `auto`) explicitly in config — implicit defaults shift between versions
- ALWAYS scope `mocker.patch` to the smallest surface — over-mocking hides real integration bugs

## Related Skills

**90%-filter applied** — only mainstream 2026 choices.

### Language
- ✓ `python` — Python 3.14 (parent runtime; tooling, packaging via uv, type hints)

### Frameworks that consume pytest
- ✓ `fastapi` — FastAPI 0.136 (downstream consumer; TestClient + pytest async patterns)
- ✓ `pydantic` — Pydantic 2.13 (validation testing patterns via parametrize)

### Peer-language testing
- ✓ `vitest` — Vitest 4 (JS/TS equivalent; same role, different ecosystem)
- ✓ `playwright` — Playwright 1.60 (E2E layer; pytest covers unit + integration)

### Data testing targets
- ✓ `pandas` — pandas 3.0 (DataFrame test patterns)
- ✓ `polars` — Polars 1.40 (LazyFrame test patterns)

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Index, decision map, quick-lookup tables | [references/REFERENCE.md](references/REFERENCE.md) |
| Test discovery, file/class/function naming, CLI flags, layout, IDs | [references/basics.md](references/basics.md) |
| `@pytest.fixture`, scopes, `yield`, `autouse`, `conftest.py`, factories, indirect | [references/fixtures.md](references/fixtures.md) |
| `@pytest.mark.parametrize`, stacked, `pytest.param`, `ids=`, `indirect=` | [references/parametrize.md](references/parametrize.md) |
| Built-in marks (`skip`/`skipif`/`xfail`), custom marks, `--strict-markers` | [references/marks.md](references/marks.md) |
| `unittest.mock` vs `pytest-mock`, `patch`, `autospec`, `side_effect`, matchers | [references/mocking.md](references/mocking.md) |
| `pytest-asyncio` modes, `@pytest.mark.asyncio`, async fixtures, `loop_scope`, `anyio` | [references/async-testing.md](references/async-testing.md) |
| `pyproject.toml` vs `pytest.ini`, `testpaths`, `addopts`, `filterwarnings`, layering | [references/configuration.md](references/configuration.md) |
| Plugin ecosystem: cov, xdist, mock, asyncio, randomly, timeout, hypothesis, django | [references/plugins.md](references/plugins.md) |
| `pytest-cov` flags, `[tool.coverage.run]`, `[tool.coverage.report]`, branch, CI | [references/coverage.md](references/coverage.md) |
| Hypothesis `@given`, strategies, `settings`, shrinking, example database, fixtures | [references/property-based.md](references/property-based.md) |
| `syrupy` snapshot fixture, update workflow, when snapshots fit vs explicit asserts | [references/snapshot-and-approval.md](references/snapshot-and-approval.md) |
| Collection errors, fixture-not-found, async hangs, ID encoding, flake patterns | [references/troubleshooting.md](references/troubleshooting.md) |
| Defaults: pytest-randomly, pyproject config, autouse care, conftest placement | [references/recommended-defaults.md](references/recommended-defaults.md) |
| Wrong vs right code pairs: mock layer, fixture scope, time, async await, isolation | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Routing eval cases — positive/negative/edge prompts | [references/eval-cases.md](references/eval-cases.md) |

**How to use**: open the specific topic file for your task. Don't read everything — look up only the relevant reference.
