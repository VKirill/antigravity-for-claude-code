# Coverage with pytest-cov

`pytest-cov` wraps `coverage.py` as a pytest plugin.

```bash
uv add --dev pytest-cov
pytest --cov=src --cov-report=term-missing
```

## CLI flags

| Flag | Purpose |
|---|---|
| `--cov=PATH_OR_PKG` | Measure this path or installed package. Repeatable. |
| `--cov` (no value) | Measure everything imported during the test run |
| `--cov-report=TYPE` | `term`, `term-missing`, `html`, `xml`, `json`, `lcov`, `annotate`, `markdown`, `markdown-append`. Repeatable. |
| `--cov-branch` | Branch coverage (not just line) |
| `--cov-fail-under=N` | Exit non-zero if total < N% |
| `--cov-config=PATH` | Override coverage config file (default `.coveragerc`) |
| `--cov-append` | Append to existing data instead of replacing |
| `--cov-precision=N` | Reporting precision (decimal places) |
| `--no-cov` | Disable coverage (useful when invoking pytest under a wrapper that always adds `--cov`) |
| `--no-cov-on-fail` | Skip the coverage report when tests fail |

## Configuration in pyproject.toml

```toml
[tool.pytest.ini_options]
addopts = "--cov=src --cov-report=term-missing --cov-report=xml --cov-branch --cov-fail-under=85"

[tool.coverage.run]
source = ["src"]
branch = true
parallel = true              # required when using pytest-xdist
omit = [
  "src/migrations/*",
  "src/**/__main__.py",
]
dynamic_context = "test_function"

[tool.coverage.report]
fail_under = 85
show_missing = true
skip_covered = false
exclude_lines = [
  "pragma: no cover",
  "raise NotImplementedError",
  "if TYPE_CHECKING:",
  "if __name__ == .__main__.:",
  "\\.\\.\\.",                 # ellipsis-only function body
]

[tool.coverage.html]
directory = "htmlcov"

[tool.coverage.xml]
output = "coverage.xml"
```

`pytest-cov` overrides the `parallel` option of coverage internally; but having it on doesn't hurt and helps when running coverage.py outside pytest.

## Branch coverage

`--cov-branch` (or `branch = true` under `[tool.coverage.run]`) measures executed branches, not just lines:

```python
def grade(score):
    if score > 90:           # line covered
        return "A"           # also covered
    return "B"               # also covered
                             # BUT: branch where score > 90 is False never tested
```

Without branch coverage, both lines look "covered" even though one path is exercised.

## Thresholds

```bash
pytest --cov=src --cov-fail-under=80
```

Per-file thresholds are not built into `pytest-cov`. Workarounds:

- Use `coverage.py`'s `[tool.coverage.report] fail_under = 80` for total.
- For per-file gates, post-process `coverage.xml` in CI.

## Parallel & xdist

With `pytest -n auto` (xdist), each worker writes its own `.coverage.<host>.<pid>.<random>` file. `coverage combine` merges them; `pytest-cov` does this automatically at session end if `[tool.coverage.run] parallel = true`.

## What to exclude

```toml
[tool.coverage.run]
omit = [
  "*/migrations/*",          # generated
  "*/conftest.py",           # test infra, not product code
  "*/__main__.py",           # CLI entry, often shell-glue
  "*/tests/*",               # tests covering themselves is noise
]
```

```toml
[tool.coverage.report]
exclude_lines = [
  "pragma: no cover",
  "raise NotImplementedError",
  "if TYPE_CHECKING:",
  "@overload",
  "def __repr__",
  "if __name__ == .__main__.:",
]
```

## CI integration

GitHub Actions sketch:

```yaml
- run: pytest --cov=src --cov-report=xml --cov-report=term --cov-fail-under=85
- uses: codecov/codecov-action@v5
  with:
    files: ./coverage.xml
```

For self-hosted reports, archive `coverage.xml` and `htmlcov/` as artifacts.

## Common pitfalls

- **`--cov` with no value picks up `site-packages`**: results are noisy. Always pass a path or package name.
- **Forgetting `--cov-branch`**: 100% line coverage with broken branches reports green.
- **`fail_under` mismatch**: setting it in both `pyproject.toml` and `--cov-fail-under` — CLI wins. Pick one source.
- **`.coverage` files leaking across runs**: stale data inflates coverage. CI step before tests: `rm -f .coverage .coverage.*`.
- **Coverage measured against installed package, not src**: `pytest --cov=src` works only with `src/` layout + editable install; otherwise use `--cov=mypkg`.
