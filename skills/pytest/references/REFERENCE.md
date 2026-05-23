# pytest — Reference Index

Decision map: open the file that matches your current task. Don't read everything.

## Decision map

| If you're doing... | Open |
|---|---|
| First-time setup or layout question | [basics.md](basics.md) + [configuration.md](configuration.md) |
| Designing test inputs / cleanup | [fixtures.md](fixtures.md) |
| Many cases for one test body | [parametrize.md](parametrize.md) |
| Conditional skip, expected fail, custom tags | [marks.md](marks.md) |
| Replacing dependencies with fakes | [mocking.md](mocking.md) |
| `async def` tests / asyncio coroutines | [async-testing.md](async-testing.md) |
| `pyproject.toml` / `pytest.ini` keys | [configuration.md](configuration.md) |
| Picking a plugin from the ecosystem | [plugins.md](plugins.md) |
| Coverage measurement and thresholds | [coverage.md](coverage.md) |
| Generating inputs, finding edge cases | [property-based.md](property-based.md) |
| Recording serialized output as gold | [snapshot-and-approval.md](snapshot-and-approval.md) |
| Failing collection / hangs / flakes | [troubleshooting.md](troubleshooting.md) |
| Sensible defaults for a new project | [recommended-defaults.md](recommended-defaults.md) |
| Common mistakes with side-by-side fix | [wrong-vs-right.md](wrong-vs-right.md) |
| Routing eval cases for this skill | [eval-cases.md](eval-cases.md) |

## Quick lookup

| Task | Snippet |
|---|---|
| Run one test | `pytest path/to/test_file.py::TestClass::test_name` |
| Filter by keyword | `pytest -k "login and not legacy"` |
| Filter by marker | `pytest -m slow` |
| Stop at first failure | `pytest -x` |
| Show locals on failure | `pytest -l` |
| Slowest 10 tests | `pytest --durations=10` |
| Parallel | `pytest -n auto` (requires `pytest-xdist`) |
| Random order | install `pytest-randomly`, automatic |
| Coverage | `pytest --cov=src --cov-report=term-missing` |
| Update snapshots | `pytest --snapshot-update` (syrupy) |

## Configuration anchor

```toml
# pyproject.toml
[tool.pytest.ini_options]
minversion = "9.0"
testpaths = ["tests"]
addopts = "-ra --strict-markers --strict-config"
xfail_strict = true
filterwarnings = ["error"]
asyncio_mode = "strict"
markers = [
  "slow: marks tests as slow",
  "integration: requires external services",
]
```
