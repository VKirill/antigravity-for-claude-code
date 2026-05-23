# Plugins

pytest has ~1300 third-party plugins. The shortlist below covers ~95% of real-world needs.

## Tier 1 — install in every Python project

### pytest-cov

Coverage measurement. See [coverage.md](coverage.md).

```bash
uv add --dev pytest-cov
pytest --cov=src --cov-report=term-missing
```

### pytest-xdist

Parallel test execution.

```bash
uv add --dev pytest-xdist
pytest -n auto           # one worker per CPU
pytest -n 4              # explicit count
pytest -n auto --dist=loadgroup  # group tests by @pytest.mark.xdist_group
```

Key options:

- `--dist=load` (default): distribute by test
- `--dist=loadfile`: same file on same worker (needed if module-level state isn't safe to split)
- `--dist=loadgroup`: respects `@pytest.mark.xdist_group("name")`

Workers can't share state — fixtures with `scope="session"` run per worker, not globally.

### pytest-randomly

Randomizes test order on every run. Catches order-dependence bugs. Install and it's automatic — no config.

```bash
uv add --dev pytest-randomly
```

Reproduce a failure: `pytest --randomly-seed=1234567` (seed printed at suite start).

### pytest-mock

The `mocker` fixture. See [mocking.md](mocking.md).

```bash
uv add --dev pytest-mock
```

### pytest-asyncio

Async test support. See [async-testing.md](async-testing.md).

```bash
uv add --dev pytest-asyncio
```

## Tier 2 — most projects eventually need

### pytest-timeout

Per-test timeout to catch hangs:

```bash
uv add --dev pytest-timeout
```

```toml
[tool.pytest.ini_options]
timeout = 60                    # default seconds per test
timeout_method = "thread"       # or "signal" (POSIX only)
```

Per-test override:

```python
@pytest.mark.timeout(5)
def test_fast():
    ...
```

### hypothesis

Property-based testing. See [property-based.md](property-based.md).

```bash
uv add --dev hypothesis
```

### syrupy

Snapshot testing. See [snapshot-and-approval.md](snapshot-and-approval.md).

```bash
uv add --dev syrupy
```

### pytest-freezer (or freezegun)

Freeze time in tests:

```bash
uv add --dev pytest-freezer
```

```python
def test_now(freezer):
    freezer.move_to("2026-01-01")
    assert today() == date(2026, 1, 1)
```

`freezegun` is the underlying engine; `pytest-freezer` provides the fixture wrapper.

## Tier 3 — framework-specific

### pytest-django

```bash
uv add --dev pytest-django
```

```toml
[tool.pytest.ini_options]
DJANGO_SETTINGS_MODULE = "myproject.settings.test"
```

Fixtures: `client`, `db`, `transactional_db`, `admin_client`, `settings`, `live_server`.

### pytest-httpx

Mock httpx (sync + async):

```bash
uv add --dev pytest-httpx
```

```python
def test_call(httpx_mock):
    httpx_mock.add_response(url="https://api/", json={"ok": True})
    assert httpx.get("https://api/").json() == {"ok": True}
```

### pytest-flask, pytest-starlette, pytest-aiohttp, pytest-tornado

Same shape — framework-specific test clients and fixtures.

### pytest-postgresql, pytest-redis

Spin up real (or process-managed) services for integration tests.

## Tier 4 — niche but high-value

| Plugin | Purpose |
|---|---|
| `pytest-benchmark` | Benchmark fixture; perf regression detection |
| `pytest-repeat` | `--count=N` to re-run tests (flake hunting) |
| `pytest-rerunfailures` | Auto-retry flakes in CI (use cautiously — hides real bugs) |
| `pytest-instafail` | Show failures inline instead of waiting for end |
| `pytest-sugar` | Prettier output |
| `pytest-clarity` | Better diff output for `assert a == b` |
| `pytest-icdiff` / `pytest-pretty` | Alternative diff formatters |
| `pytest-env` | Set env vars from config |
| `pytest-dotenv` | Load `.env` files before tests |
| `pytest-subtests` | Sub-test cases inside one test (pytest 9 has native support — prefer that) |

## Picking plugins responsibly

Each plugin adds collection-time cost and a maintenance dependency. Defaults:

- Install Tier 1 unconditionally.
- Install Tier 2 once you hit the specific pain (slow suite → xdist + timeout; need fakes → mock + freezer).
- Tier 3 only when using the matching framework.
- Avoid stacking five output-formatting plugins (sugar + clarity + icdiff + pretty + ...) — pick one.

Check plugin compatibility: `pytest --version --version` lists every active plugin and version after pytest 9.
