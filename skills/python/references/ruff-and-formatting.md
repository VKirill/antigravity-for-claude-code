# Ruff: lint + format

Ruff is the default Python lint+format tool in 2026 — a single Rust binary that replaces flake8, pycodestyle, pyflakes, isort, pyupgrade, pep8-naming, black, autoflake, yapf, and many smaller tools. Runs 10–100x faster than the originals.

## One tool, one config

Configure in `pyproject.toml` under `[tool.ruff]` (or in a standalone `ruff.toml` / `.ruff.toml` if you prefer):

```toml
[tool.ruff]
line-length = 100
target-version = "py314"
src = ["src", "tests"]
extend-exclude = ["migrations", "build", "dist"]

[tool.ruff.lint]
select = [
    "E",    # pycodestyle errors
    "W",    # pycodestyle warnings
    "F",    # pyflakes
    "I",    # isort (import sorting)
    "UP",   # pyupgrade (modernize syntax for target-version)
    "B",    # flake8-bugbear
    "C4",   # flake8-comprehensions
    "SIM",  # flake8-simplify
    "RUF",  # ruff-specific rules
    "N",    # pep8-naming
    "ANN",  # flake8-annotations (require type hints — strict)
    "ASYNC",  # flake8-async
    "S",    # flake8-bandit (security)
    "PTH",  # flake8-use-pathlib
    "PL",   # pylint (subset)
]
ignore = [
    "E501",   # line too long (handled by formatter)
    "ANN101", # missing type annotation for self (legacy)
    "ANN102", # missing type annotation for cls
]

[tool.ruff.lint.per-file-ignores]
"tests/**/*.py" = ["S101", "ANN", "PLR2004"]  # tests can use assert and magic numbers
"__init__.py" = ["F401"]                        # unused imports OK in __init__

[tool.ruff.lint.isort]
known-first-party = ["myproject"]
combine-as-imports = true

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
skip-magic-trailing-comma = false
docstring-code-format = true
```

## Commands

```bash
ruff check .                # lint
ruff check --fix .          # lint + auto-fix
ruff check --fix --unsafe-fixes .  # apply risky fixes too
ruff format .               # format
ruff format --check .       # check-only, exit 1 on diff
ruff check --select I --fix .   # only fix import order
```

With uv: `uv run ruff check .` or `uvx ruff check .`.

## Rule families (most useful)

| Code | Family | Why |
|---|---|---|
| `E`, `W` | pycodestyle | PEP 8 baseline |
| `F` | pyflakes | unused imports, undefined names |
| `I` | isort | import sorting (replaces isort) |
| `UP` | pyupgrade | use new syntax (`X | None` over `Optional[X]`) |
| `B` | flake8-bugbear | likely bugs (mutable defaults, `assert` against tuples) |
| `C4` | comprehensions | `list(filter(...))` → comprehension |
| `SIM` | simplify | `if x: return True else: return False` → `return bool(x)` |
| `RUF` | ruff-specific | misc useful checks |
| `N` | naming | PEP 8 names (CamelCase classes, snake_case funcs) |
| `ANN` | annotations | enforce type hints on signatures |
| `S` | bandit | basic security (no `eval`, no `shell=True`) |
| `PTH` | pathlib | `open("x")` → `Path("x").open()` |
| `ASYNC` | async | async pitfalls (`time.sleep` in async fn) |
| `D` | pydocstyle | docstring conventions (opt-in per project) |
| `PL` | pylint | high-value subset |

## Formatter — replaces black

`ruff format` is a black-compatible formatter. Same defaults: 88 columns, double quotes, trailing commas. Override via `[tool.ruff.format]`:

```toml
[tool.ruff.format]
quote-style = "double"          # or "single"
indent-style = "space"          # or "tab"
line-ending = "auto"            # or "lf", "crlf"
skip-magic-trailing-comma = false
docstring-code-format = true    # format code blocks in docstrings
docstring-code-line-length = 80
```

Don't run black separately; ruff format covers it.

## Replaces isort

Import sorting lives under `[tool.ruff.lint.isort]`:

```toml
[tool.ruff.lint.isort]
known-first-party = ["myproject", "mypackage"]
known-third-party = ["pydantic"]
combine-as-imports = true
force-sort-within-sections = true
split-on-trailing-comma = true
```

Enable with `select = ["I"]`. Don't run isort separately.

## Pre-commit hook

`.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.0     # pin a specific version
    hooks:
      - id: ruff-check
        args: [--fix]
      - id: ruff-format
```

Two hooks: `ruff-check` (lint) and `ruff-format` (format). Run order matters — check first (with `--fix`), then format. Pinning the `rev:` is required; track updates via `pre-commit autoupdate`.

## CI integration

GitHub Actions:

```yaml
- name: Install uv
  uses: astral-sh/setup-uv@v7

- name: Install deps
  run: uv sync --dev

- name: Lint
  run: uv run ruff check .

- name: Format check
  run: uv run ruff format --check .

- name: Type check
  run: uv run mypy src
```

Or with `astral-sh/ruff-action` (Marketplace) for a slimmer install.

## Migration from black/flake8/isort

```bash
# Remove old configs
rm -f .flake8 setup.cfg.flake8 .isort.cfg
# Remove old hooks from .pre-commit-config.yaml (black, isort, flake8)

# Generate ruff config
ruff config > .ruff.toml   # interactive (use TOML output)
# Or copy the template above into pyproject.toml
```

Run `ruff check --add-noqa .` to add `# noqa` comments to all current violations — gives you a clean baseline that surfaces only new issues.

## Common rule subset

For a balanced default without going strict:

```toml
[tool.ruff.lint]
select = ["E", "F", "W", "I", "UP", "B", "SIM", "RUF"]
ignore = ["E501"]
```

For strict (security + types + naming):

```toml
[tool.ruff.lint]
select = [
    "E", "F", "W", "I", "UP", "B", "C4", "SIM", "RUF",
    "N", "ANN", "S", "PTH", "ASYNC", "PL"
]
ignore = ["E501", "ANN101", "ANN102", "PLR0913"]
```

## Suppressing violations

Inline:

```python
import os  # noqa: F401  # used by type-check imports

def fn():  # noqa: ANN201  # legacy untyped, see TODO-1234
    return 42
```

Always include the rule code (`F401`, `ANN201`) so blanket `# noqa` doesn't hide future bugs.

## Anti-patterns

- ❌ Running ruff alongside black/isort/flake8 — pick ruff and remove the others
- ❌ Disabling `F401` globally — almost always means dead imports
- ❌ `# noqa` without a rule code — masks future violations
- ❌ Putting `[tool.ruff]` rules in `pyproject.toml` AND `.ruff.toml` — uv reads one, you'll get drift
- ❌ Skipping `select = [...]` and relying on the default ruleset — the default is intentionally tiny (`E4`, `E7`, `E9`, `F`); pick rules explicitly
- ❌ Enforcing line-length via `E501` AND running `ruff format` — pick one (the formatter is canonical)
