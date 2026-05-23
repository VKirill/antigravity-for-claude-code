# Marks

Marks attach metadata to tests for filtering, skipping, and behavior modification.

## Built-in marks

### `@pytest.mark.skip`

Unconditional skip:

```python
@pytest.mark.skip(reason="awaiting backend fix")
def test_payment():
    ...
```

### `@pytest.mark.skipif(condition, reason=...)`

Conditional skip:

```python
import sys

@pytest.mark.skipif(sys.platform == "win32", reason="POSIX only")
def test_signal_handling():
    ...
```

The condition is evaluated at collection. For per-call skipping inside the test body, use `pytest.skip("reason")`.

### `@pytest.mark.xfail`

The test is expected to fail (e.g., a known bug, or a feature not yet implemented):

```python
@pytest.mark.xfail(reason="bug #4242", strict=True)
def test_known_issue():
    assert broken()
```

- Default: `strict=False` — xfail passes (`XFAIL`) on failure; if the test unexpectedly passes, it's `XPASS` and **does not fail the suite**.
- `strict=True` — unexpected pass becomes `XPASS(strict)` and **fails the suite**. Recommended.

Set globally with `xfail_strict = true` in config.

`raises=ExceptionType` narrows the expected failure mode:

```python
@pytest.mark.xfail(raises=NotImplementedError, reason="planned for v2")
def test_not_yet():
    feature()
```

### `@pytest.mark.parametrize`

Covered in [parametrize.md](parametrize.md).

### `@pytest.mark.usefixtures`

Apply a fixture without taking it as a parameter (useful when only side-effects matter):

```python
@pytest.mark.usefixtures("freeze_time", "clear_cache")
def test_idempotent():
    ...
```

### `@pytest.mark.filterwarnings`

Per-test warning control:

```python
@pytest.mark.filterwarnings("ignore::DeprecationWarning")
def test_uses_old_api():
    ...
```

## Custom marks

Define and register custom marks in `pyproject.toml`:

```toml
[tool.pytest.ini_options]
markers = [
    "slow: marks tests as slow (deselect with '-m \"not slow\"')",
    "integration: requires external services",
    "smoke: minimal suite for pre-commit",
]
```

Use:

```python
@pytest.mark.slow
def test_full_simulation():
    ...
```

Run filtered: `pytest -m slow`, exclude: `pytest -m "not slow"`, combine: `pytest -m "smoke or integration"`.

## `--strict-markers`

Without it, a typo'd marker (`@pytest.mark.slwo`) silently does nothing. With it, the unknown marker fails collection.

Put it in `addopts`:

```toml
[tool.pytest.ini_options]
addopts = "--strict-markers --strict-config"
```

Now every custom mark must be registered.

## Applying marks at module / class scope

```python
# module-level
pytestmark = pytest.mark.slow

# class-level
class TestSlow:
    pytestmark = [pytest.mark.slow, pytest.mark.integration]

    def test_a(self): ...
```

`pytestmark` (a list or single mark) applies to every test in the scope.

## Applying via `pytest_collection_modifyitems`

Programmatic mark application — common pattern: auto-mark slow tests in a folder:

```python
# conftest.py
def pytest_collection_modifyitems(config, items):
    for item in items:
        if "integration/" in item.nodeid:
            item.add_marker(pytest.mark.integration)
```

## Composing with parametrize

```python
@pytest.mark.parametrize("payload", [
    pytest.param({"v": 1}, marks=pytest.mark.smoke),
    pytest.param({"v": 999}, marks=pytest.mark.slow),
])
def test_process(payload):
    ...
```

Mix per-row marks (`pytest.param(..., marks=...)`) with whole-test marks for fine-grained CI grouping.

## Common pitfalls

- **`@pytest.mark.skip` without parens**: `@pytest.mark.skip` (no call) decorates with the mark *object*, which still works for `skip` but is fragile. Always call: `@pytest.mark.skip(reason="...")`.
- **`xfail(strict=False)` masking regressions**: a fixed test silently keeps passing under `XPASS`. Always set `xfail_strict = true`.
- **Unregistered custom mark + no `--strict-markers`**: `PytestUnknownMarkWarning` warnings drown in noise. Strict markers fail fast.
