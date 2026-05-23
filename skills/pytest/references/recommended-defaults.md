# Recommended Defaults

Single source of truth for pytest-shaped knobs we set on every new Python project. Reference these from other files — don't restate the numbers.

## Always install (Tier 1)

| Plugin | Why |
|---|---|
| `pytest` | The runner. Pin `>=9.0,<10` |
| `pytest-cov` | Coverage. Required in CI. |
| `pytest-mock` | `mocker` fixture. Cleaner than raw `unittest.mock`. |
| `pytest-randomly` | Random test order. Surfaces order dependencies. |
| `pytest-asyncio` | Async tests. Install even if not using yet — cheap. |
| `pytest-xdist` | Parallelism. Use in CI even if local runs are sequential. |
| `pytest-timeout` | Catches hangs. Set a default. |

## Baseline `pyproject.toml`

```toml
[tool.pytest.ini_options]
minversion = "9.0"
testpaths = ["tests"]
addopts = [
  "-ra",
  "--strict-markers",
  "--strict-config",
  "--showlocals",
]
xfail_strict = true
asyncio_mode = "strict"          # explicit; switch to "auto" only project-wide
filterwarnings = ["error"]       # promote warnings, allowlist exceptions
timeout = 60                     # pytest-timeout
markers = [
  "slow: marks slow tests (deselect with -m 'not slow')",
  "integration: requires external services",
]

[tool.coverage.run]
source = ["src"]
branch = true
parallel = true
omit = ["*/migrations/*", "*/__main__.py"]

[tool.coverage.report]
show_missing = true
exclude_lines = [
  "pragma: no cover",
  "raise NotImplementedError",
  "if TYPE_CHECKING:",
  "if __name__ == .__main__.:",
]
```

## Defaults to set, with rationale

| Knob | Default | Why |
|---|---|---|
| `--strict-markers` | on | Typos in mark names fail loud |
| `--strict-config` | on | Typos in ini keys fail loud |
| `xfail_strict` | `true` | Unexpected-pass is a real failure |
| `filterwarnings = ["error"]` | on | New deprecations caught at write time |
| `asyncio_mode` | explicit (`"strict"` or `"auto"`) | Never rely on implicit defaults |
| `timeout` | `60` seconds | Catches hangs; set higher in slow CI |
| `pytest-randomly` | always installed | Order-independence is a quality bar |
| coverage `branch` | `true` | Line-only coverage misses entire branches |
| coverage `--cov-fail-under` | `80` minimum, target `90` | Threshold should fail CI |

## conftest.py placement

- **Repo root**: only genuinely global fixtures (e.g., env setup, plugin registration).
- **Lowest common ancestor** of tests that share a fixture: every other case.
- **Per-package** (unit/, integration/): when fixture cost or shape differs significantly.

Avoid a single megafile `tests/conftest.py` with 50 fixtures. Split.

## autouse fixtures

Use `autouse=True` only when:

- The fixture is **truly invariant** across every test in scope (e.g., DB transaction rollback in an integration suite).
- The test signature would otherwise be polluted: `def test_x(reset_random, freeze_logging, clear_cache, ...)`.

Default position: **don't** autouse. An explicit fixture in the signature documents intent.

## Marker registry

Register every custom mark:

```toml
markers = [
  "slow: marks slow tests",
  "integration: requires external services",
  "smoke: minimal pre-commit suite",
  "flaky: known intermittent — quarantine",
]
```

Run subsets in CI:

```bash
pytest -m "not slow and not integration"     # fast PR check
pytest -m "integration"                       # nightly
pytest -m "smoke"                             # pre-commit hook
```

## CI invocation

```bash
pytest \
  -n auto \                       # xdist parallelism
  --dist=loadgroup \              # respect @pytest.mark.xdist_group
  --cov=src \
  --cov-report=xml \
  --cov-report=term \
  --cov-branch \
  --cov-fail-under=85 \
  --junitxml=reports/junit.xml \
  --timeout=120 \
  -v
```

## What we don't do by default

- **`pytest-rerunfailures`** — masks real flakes. Only install for a measured, time-boxed quarantine.
- **`pytest-sugar` / pretty output plugins** — fine locally, off in CI to keep logs grep-able.
- **`pytest-cov` in watch loops** — slow. Run coverage only in CI or on-demand.
- **Coverage on `tests/`** — covers the test code itself. Add to `omit`.
