# Basics: Discovery, Invocation, Layout

## Test discovery rules

pytest auto-collects on these defaults (override in `[tool.pytest.ini_options]`):

| Setting | Default |
|---|---|
| `python_files` | `test_*.py` and `*_test.py` |
| `python_classes` | `Test*` (must have no `__init__`) |
| `python_functions` | `test_*` |
| `testpaths` | current dir (set this — usually `["tests"]`) |

Classes used for grouping cannot define `__init__` — pytest needs to instantiate them per-test.

## Project layout

Two layouts; both work, pick one per project.

### `src/` layout (recommended for libraries)

```
my_pkg/
├── pyproject.toml
├── src/
│   └── mypkg/
│       ├── __init__.py
│       └── core.py
└── tests/
    ├── conftest.py
    ├── test_core.py
    └── integration/
        ├── conftest.py
        └── test_api.py
```

Pros: ensures tests run against the installed package, not the source tree. Forces editable install (`pip install -e .` or `uv pip install -e .`).

### Flat layout

```
my_pkg/
├── pyproject.toml
├── mypkg/
│   └── core.py
└── tests/
    └── test_core.py
```

Simpler, but tests may import from the source dir even when the package is broken.

## conftest.py

`conftest.py` is auto-loaded for every test below its directory. Use it for:

- Shared fixtures across multiple test files
- Hooks (`pytest_collection_modifyitems`, `pytest_runtest_setup`)
- Plugin registration via `pytest_plugins = [...]` (only in **top-level** conftest)

Place each `conftest.py` at the **lowest common ancestor** of tests that use it. A repo-root `conftest.py` is fine for truly global fixtures, but tighter scoping reduces accidental coupling.

## Assertion rewriting

pytest rewrites `assert` statements at import time to produce rich diff output:

```python
def test_dict():
    actual = {"a": 1, "b": 2}
    expected = {"a": 1, "b": 3}
    assert actual == expected
```

Failure shows the dict diff with the differing key highlighted — no need for `assertEqual`.

For non-test helper modules that contain assertions you want introspected, register them:

```python
# conftest.py
import pytest
pytest.register_assert_rewrite("mypkg.test_helpers")
```

## CLI flags (most useful)

| Flag | Effect |
|---|---|
| `-x` | Stop at first failure |
| `--maxfail=N` | Stop after N failures |
| `-k EXPR` | Run tests matching keyword expression (`-k "login and not legacy"`) |
| `-m MARK` | Run tests with given marker (`-m slow`) |
| `-l` / `--showlocals` | Print local variables on failure |
| `--tb=short` | Compact traceback (also `long`, `line`, `native`, `no`) |
| `-v` / `-vv` | Verbose / very verbose |
| `-q` | Quiet |
| `-s` | Don't capture stdout (print() shows up) |
| `--lf` / `--last-failed` | Run only tests that failed last time |
| `--ff` / `--failed-first` | Run failures first, then the rest |
| `--ignore=path` | Skip a directory or file |
| `--collect-only` | Show what would run; don't execute |
| `--durations=N` | Show slowest N tests |
| `-n auto` | Parallel (requires `pytest-xdist`) |
| `--pdb` | Drop into pdb on failure |

## Running a specific test

Node IDs identify tests:

```bash
pytest tests/test_users.py                              # file
pytest tests/test_users.py::TestLogin                   # class
pytest tests/test_users.py::TestLogin::test_expired     # method
pytest tests/test_users.py::test_signup                 # function
pytest "tests/test_users.py::test_signup[case-2]"       # parametrized case
```

## pytest 9 — duplicate path handling

`pytest a/b a/` now collects `a/` only once (prefix coalesces). `pytest x.py x.py` runs the file once. Use `--keep-duplicates` to opt back into legacy behavior — usually a sign of a CI mistake.
