# Configuration

pytest reads configuration from the first matching file (going up from the rootdir):

1. `pyproject.toml` → `[tool.pytest.ini_options]` (preferred)
2. `pytest.ini`
3. `tox.ini` → `[pytest]`
4. `setup.cfg` → `[tool:pytest]`
5. `pytest 9` adds: `pytest.toml` / `.pytest.toml` with native TOML types, and `[tool.pytest]` in pyproject (non-INI mode). Treat as opt-in until plugins catch up.

Use **`pyproject.toml`** in new projects.

## Recommended baseline

```toml
[tool.pytest.ini_options]
minversion = "9.0"
testpaths = ["tests"]
addopts = [
  "-ra",                  # short summary of all non-pass outcomes
  "--strict-markers",     # unknown marks fail
  "--strict-config",      # unknown ini keys fail
  "--showlocals",         # locals in tracebacks
]
xfail_strict = true
filterwarnings = [
  "error",                # warnings become errors
  "ignore::DeprecationWarning:third_party.*",
]
asyncio_mode = "strict"   # or "auto"
markers = [
  "slow: marks tests as slow (deselect with -m 'not slow')",
  "integration: requires external services",
]
```

## Key options

### `testpaths`

```toml
testpaths = ["tests", "src/integration_tests"]
```

Where pytest starts collecting. Without this, pytest collects from rootdir.

### `python_files`, `python_classes`, `python_functions`

Override discovery patterns:

```toml
python_files = ["test_*.py", "*_test.py", "check_*.py"]
python_classes = ["Test*", "Check*"]
python_functions = ["test_*", "check_*"]
```

### `addopts`

Always-applied CLI flags. List form preferred over string in TOML.

### `markers`

Required when `--strict-markers` is set. Each entry: `"name: description"`.

### `filterwarnings`

Per-test override available via `@pytest.mark.filterwarnings`. List entries follow Python's warning filter syntax: `"action:message:category:module:lineno"`.

Common values:

- `"error"` — promote all warnings to errors
- `"ignore::DeprecationWarning"` — silence one category
- `"error::pytest.PytestUnraisableExceptionWarning"` — error on a specific category

### `xfail_strict`

`true` makes any unexpected-pass `XPASS` fail the suite. **Set this.**

### `asyncio_mode`

`"strict"` or `"auto"`. Pin explicitly.

### `tmp_path_retention_count` / `tmp_path_retention_policy`

How many tmp dirs to keep on disk (default: 3 most recent failures). Set to `"all"`, `"failed"`, or `"none"`.

### `console_output_style`

`"progress"` (default), `"count"`, or `"classic"`.

### `log_cli`, `log_cli_level`

```toml
log_cli = true
log_cli_level = "INFO"
log_cli_format = "%(asctime)s %(levelname)s %(name)s: %(message)s"
log_cli_date_format = "%H:%M:%S"
```

Real-time log output during test runs.

### `log_file`, `log_file_level`

Write logs to a file in addition to stdout — useful in CI.

## conftest.py layering

`conftest.py` is config-as-code. Layered from rootdir downward:

```
repo/
├── conftest.py            ← global hooks, broad fixtures
├── tests/
│   ├── conftest.py        ← shared across tests/
│   ├── unit/
│   │   └── conftest.py    ← unit-only fixtures
│   └── integration/
│       ├── conftest.py    ← integration fixtures (DB, HTTP)
│       └── test_api.py
```

`pytest_plugins = [...]` works only in the **rootdir** `conftest.py` (or in `pyproject.toml` via `[tool.pytest.ini_options] required_plugins`).

## Plugin discovery

pytest auto-loads plugins from:

- Installed packages with the `pytest11` entry point (most plugins)
- `conftest.py` files
- `pytest_plugins = ["myproject.fixtures"]` in `conftest.py` or test modules

Disable auto-loading: `pytest -p no:cacheprovider`. Force-require a plugin:

```toml
[tool.pytest.ini_options]
required_plugins = ["pytest-asyncio>=0.23", "pytest-cov>=5"]
```

## Caching

pytest caches results between runs in `.pytest_cache/` (gitignored). Used by `--lf`, `--ff`, and stepwise tools. Clear with `pytest --cache-clear`.

## Common pitfalls

- **`pytest.ini` and `pyproject.toml` both present**: `pytest.ini` wins. Pick one.
- **`addopts` as a string with newlines**: parse errors in TOML. Use the list form.
- **No `--strict-config`**: typo in `pythn_files = ...` silently does nothing. Strict config fails loud.
- **Putting `pytest_plugins` in a subdirectory conftest**: pytest 9 raises — only rootdir conftest may declare plugins.
- **Forgetting to register custom marks under `--strict-markers`**: collection fails. Add every custom mark to `markers = [...]`.
