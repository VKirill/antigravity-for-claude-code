# Troubleshooting

Common failure modes and how to fix them fast.

## "fixture 'X' not found"

```
E       fixture 'db' not found
```

Causes (in order of likelihood):

1. Typo in fixture name. Run `pytest --fixtures path/to/test_file.py` to list all visible fixtures.
2. Fixture is in a `conftest.py` that doesn't cover the test's directory. Move it up the tree or add a closer one.
3. Plugin providing the fixture isn't installed. Check `pytest --version --version` for active plugins.
4. Fixture is defined inside a `class` — fixtures must be module-level functions (or class-level with `@pytest.fixture`).

## "Collection error" / `ERROR collecting`

Collection errors come from import-time exceptions in test files or `conftest.py`. The test never gets a chance to run.

Read the traceback — it points at the import that failed. Common causes:

- Syntax error in conftest.py
- Importing from a missing module (forgot to install a dep, or it's a circular import)
- Top-level code that requires runtime state (`os.getenv("X") + 1` where X is unset)

Fix the import, re-run.

## Tests pass locally, fail in CI

| Cause | Diagnosis |
|---|---|
| Order-dependent test | Install `pytest-randomly`, reproduce locally with the same seed (`--randomly-seed=N`) |
| Time-dependent assertion | Replace `datetime.now()` calls with frozen time (`pytest-freezer`) |
| Working directory differs | Use `tmp_path` / paths relative to `__file__`, never `os.getcwd()` |
| Env var present locally only | Set in CI or assert it via `assume_env()` |
| Filesystem case sensitivity | macOS is case-insensitive by default; Linux CI catches it |
| Locale | Pin `LANG=C.UTF-8` in CI; set `locale.setlocale` in conftest |
| Random seed | If using `random`/`numpy`, seed deterministically per test |

## Async test hangs

Diagnose:

```bash
pytest --timeout=10 -v -s
```

Likely causes:

1. `pytest-asyncio` not installed.
2. Test uses `async def` but no `@pytest.mark.asyncio` (strict mode) and no `asyncio_mode = "auto"`.
3. Awaiting a coroutine that never resolves (missing mock, deadlock, infinite retry).
4. `loop_scope` mismatch between fixture and test — they share state but on different loops.

## Parametrize ID encoding issues

```
test_email[é-False]   ← unreadable
```

When params contain non-ASCII or `/`, `:`, `[`, `]`:

```python
@pytest.mark.parametrize(
    "email,valid",
    [
        ("a@b.c", True),
        ("café@example.com", True),
        ("no-at-sign", False),
    ],
    ids=["plain", "unicode", "missing-at"],
)
```

Always provide `ids=` for non-trivial param values.

## Slow test suite

```bash
pytest --durations=10
```

Shows the 10 slowest tests + their setup/teardown time. Then:

- Promote fixtures to wider scope (`function` → `module` → `session`) if creation cost dominates.
- Replace real I/O with mocks where coverage isn't testing the integration.
- Add `pytest-xdist` for parallelism.
- Mark genuinely slow tests `@pytest.mark.slow` and skip them in fast loops.

## Flaky tests

Symptoms: passes sometimes, fails sometimes, no code change.

Common causes:

| Cause | Fix |
|---|---|
| Test relies on dict/set ordering | Sort before comparing |
| Test depends on system time | `pytest-freezer` |
| Shared module-level mutable state | Reset in fixture; install `pytest-randomly` to surface |
| Race condition in concurrent code | Add explicit sync; widen timeouts; isolate test from real concurrency |
| External service (HTTP, DB) | Mock with `pytest-httpx` / DB transaction rollback |
| Random data not seeded | `random.seed(0)` in autouse fixture |

Do not use `pytest-rerunfailures` to mask flakes — find the root cause.

## Isolation issues from shared state

Pattern: test A leaves cache populated, test B fails because cache wasn't fresh.

```python
# conftest.py
@pytest.fixture(autouse=True)
def _clear_global_cache():
    yield
    my_module._cache.clear()
```

If you find yourself adding many such autouse cleanups, refactor the module to remove global state — that's a design smell pytest is surfacing.

## `PytestUnknownMarkWarning`

```
PytestUnknownMarkWarning: Unknown pytest.mark.slowww - is this a typo?
```

Register the mark in `pyproject.toml`:

```toml
[tool.pytest.ini_options]
markers = ["slow: marks slow tests"]
addopts = "--strict-markers"
```

`--strict-markers` promotes the warning to an error, catching typos at collection.

## "test was collected but never ran"

Usually a fixture raised at setup. Check earlier in the output for `ERROR at setup of test_x`.

## `assert ==` shows useless repr

For custom classes, define `__repr__`. pytest uses repr in the failure message; the stdlib default (`<MyClass at 0x...>`) is useless. Even better — define `__eq__` to delegate to fields you care about.

## Memory leak across tests

Tests aggregate memory until OOM. Causes:

- Session-scoped fixture creates instances that don't get GC'd
- `caplog` keeps log records — `caplog.clear()` between tests
- Mock objects retain references via `mock.call_args_list`

Inspect with `pytest --tb=short -p memray` or `tracemalloc`.

## Investigation playbook

1. `pytest -x -vv` — first failure with verbose diff
2. `pytest --tb=long -l` — full traceback + locals
3. `pytest --pdb -x` — drop into debugger on first failure
4. `pytest --lf` — only re-run last-failed tests
5. `pytest -p no:randomly --randomly-dont-shuffle` — disable randomization to bisect
6. `pytest -k test_specific -s` — isolate one test, don't capture output
