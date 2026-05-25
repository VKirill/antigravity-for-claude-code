# Routing Eval Cases

Test cases for verifying the python skill's routing behavior. Each case is a user prompt + expected skill behavior.

## v3 format

```yaml
- prompt: "<user message>"
  expected: <load|defer|skip>
  reason: "<one-line justification>"
```

- `load` — python skill should activate
- `defer` — another sibling Python skill is a better fit
- `skip` — non-Python question entirely

## Positive cases (skill should load)

```yaml
- prompt: "How do I add type hints to this function?"
  expected: load
  reason: "Type hints are core Python — covered in type-hints-and-mypy.md"

- prompt: "What's the difference between dataclass and NamedTuple?"
  expected: load
  reason: "Data modeling decision tree — dataclasses-and-data.md"

- prompt: "Set up a new Python project with uv"
  expected: load
  reason: "Packaging foundation — packaging-and-uv.md"

- prompt: "Configure ruff for my pyproject.toml"
  expected: load
  reason: "Lint/format tooling — ruff-and-formatting.md"

- prompt: "Why am I getting ModuleNotFoundError?"
  expected: load
  reason: "Common Python failure — troubleshooting.md"

- prompt: "How do I use asyncio TaskGroup?"
  expected: load
  reason: "Structured concurrency — async-and-concurrency.md"

- prompt: "Tell me about PEP 695 type parameter syntax"
  expected: load
  reason: "Modern syntax — syntax-and-types.md"

- prompt: "Can I use Python 3.14 free-threaded mode in production?"
  expected: load
  reason: "PEP 703/779 covered in performance.md"

- prompt: "Difference between pip, poetry, and uv?"
  expected: load
  reason: "Packaging tool comparison — packaging-and-uv.md"

- prompt: "What does ExceptionGroup do?"
  expected: load
  reason: "Error handling — error-handling.md"

- prompt: "What's mypy --strict actually enable?"
  expected: load
  reason: "Type-check tooling — type-hints-and-mypy.md"

- prompt: "Should I use Protocol or TypedDict for this dict shape?"
  expected: load
  reason: "Typing decision — type-hints-and-mypy.md"

- prompt: "Convert this code to use pathlib instead of os.path"
  expected: load
  reason: "Stdlib usage — stdlib-essentials.md"

- prompt: "How do I profile a slow Python script?"
  expected: load
  reason: "Profiling tools — performance.md"

- prompt: "Set up pytest fixtures in conftest.py"
  expected: load
  reason: "Testing foundation — testing-with-pytest.md (until dedicated pytest skill exists)"

- prompt: "Where do I put dev dependencies in pyproject.toml?"
  expected: load
  reason: "PEP 735 dependency groups — packaging-and-uv.md"

- prompt: "Replace flake8 and black with one tool"
  expected: load
  reason: "Ruff migration — ruff-and-formatting.md"
```

## Negative cases (sibling Python skill should load instead)

```yaml
- prompt: "Build a FastAPI endpoint with Pydantic validation"
  expected: defer
  reason: "FastAPI-specific — fastapi skill"

- prompt: "Create a Django model with a foreign key"
  expected: defer
  reason: "Django-specific — django skill"

- prompt: "Use pandas to group by date and sum values"
  expected: defer
  reason: "pandas DataFrame work — pandas skill"

- prompt: "Polars LazyFrame with scan_parquet"
  expected: defer
  reason: "Polars-specific — polars skill"

- prompt: "Train a RandomForestClassifier with cross-validation"
  expected: defer
  reason: "scikit-learn — scikit-learn skill"

- prompt: "Build a PyTorch training loop with mixed precision"
  expected: defer
  reason: "PyTorch deep learning — pytorch skill"

- prompt: "Detect CUDA availability and fall back to CPU"
  expected: defer
  reason: "GPU bindings — cuda-python skill"

- prompt: "Pydantic v2 BaseModel with custom validators"
  expected: defer
  reason: "Pydantic-specific — pydantic skill"
```

## Non-Python cases (skip)

```yaml
- prompt: "Configure ESLint flat config for a Next.js project"
  expected: skip
  reason: "JavaScript/TypeScript — eslint or nextjs skill"

- prompt: "Set up a Vue 3 component with script setup"
  expected: skip
  reason: "Vue frontend — vue skill"

- prompt: "Optimize my PostgreSQL query"
  expected: skip
  reason: "Database — postgresql skill"

- prompt: "How does Docker layer caching work?"
  expected: skip
  reason: "Infra — linux-sysadmin / docker skill"
```

## Edge cases

```yaml
- prompt: "Migrating a Python 2 codebase to modern Python"
  expected: load
  reason: "Language migration — syntax-and-types.md + packaging-and-uv.md"

- prompt: "Should I use mypy or pyright for my new project?"
  expected: load
  reason: "Tooling comparison — type-hints-and-mypy.md"

- prompt: "My async tests are hanging"
  expected: load
  reason: "Async troubleshooting — async-and-concurrency.md + troubleshooting.md"

- prompt: "Compare uv to pixi for ML projects"
  expected: load
  reason: "Packaging comparison sits in python; downstream ML skills assume packaging done"

- prompt: "Type-hint a decorator that wraps an async function"
  expected: load
  reason: "ParamSpec + async — type-hints-and-mypy.md + async-and-concurrency.md"

- prompt: "Set up Python in GitHub Actions with uv"
  expected: load
  reason: "Tooling — packaging-and-uv.md (CI integration section)"

- prompt: "What does PEP 750 t-string template do?"
  expected: load
  reason: "3.14 syntax — syntax-and-types.md"

- prompt: "Difference between `return` in finally and `try/finally` in 3.14"
  expected: load
  reason: "PEP 765 — error-handling.md"
```

## How to use

Manually walk through these prompts when refactoring the skill description or rule body. The `expected` outcome should match what Claude actually does. If you see a mismatch:

- **False negative** (`load` expected, didn't load) → strengthen trigger terms in description
- **False positive** (`skip` expected, loaded anyway) → add an explicit `SKIP:` clause to the description
- **Wrong domain skill** (`defer` expected, python loaded) → expand the `SKIP:` list with the sibling skill name

This is a living document — add new cases when you encounter new routing ambiguity in real use.
