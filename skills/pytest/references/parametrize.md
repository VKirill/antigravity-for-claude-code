# Parametrize

`@pytest.mark.parametrize` turns one test body into many test cases.

## Basic shape

```python
import pytest

@pytest.mark.parametrize("a,b,expected", [
    (1, 2, 3),
    (0, 0, 0),
    (-1, 1, 0),
])
def test_add(a, b, expected):
    assert add(a, b) == expected
```

Three tests are reported: `test_add[1-2-3]`, `test_add[0-0-0]`, `test_add[-1-1-0]`.

## ids — stable test names

Auto-generated IDs combine repr of each value. For complex objects they get ugly:

```python
@pytest.mark.parametrize(
    "payload,expected",
    [({"role": "admin"}, True), ({"role": "guest"}, False)],
    ids=["admin-can", "guest-cannot"],
)
def test_permission(payload, expected):
    ...
```

`ids=` accepts a list or a callable `lambda v: f"case-{v}"`.

## pytest.param — per-row marks and IDs

```python
@pytest.mark.parametrize("n,result", [
    pytest.param(1, 1, id="one"),
    pytest.param(2, 2, id="two"),
    pytest.param(0, 0, id="zero", marks=pytest.mark.xfail(reason="known bug")),
    pytest.param(-1, None, id="negative", marks=pytest.mark.skip(reason="not supported")),
])
def test_double(n, result):
    assert double(n) == result
```

`pytest.param` is the only way to attach marks to a single row.

## Stacking parametrize (cartesian)

Two stacked decorators produce the cross-product:

```python
@pytest.mark.parametrize("user_role", ["admin", "member"])
@pytest.mark.parametrize("resource", ["post", "comment"])
def test_can_delete(user_role, resource):
    # runs 4 times
    ...
```

The lower decorator iterates fastest — convention is to put the broader axis on top.

## Multiple values per row

```python
@pytest.mark.parametrize("input,expected", [
    ("hello", "HELLO"),
    ("", ""),
    ("123", "123"),
])
def test_upper(input, expected):
    assert input.upper() == expected
```

The first arg is a comma-separated string of names; the second is an iterable of tuples (or single values when there's one name).

## indirect=True — route through a fixture

By default, parametrize injects values directly into the test. With `indirect=True`, the value goes through a fixture of the same name first:

```python
@pytest.fixture
def db_user(request):
    return User.objects.get(id=request.param)

@pytest.mark.parametrize("db_user", [1, 42, 99], indirect=True)
def test_user_active(db_user):
    assert db_user.is_active
```

Selective indirect: `indirect=("db_user",)` lets you mix direct and fixture-routed params.

## Parametrizing fixtures themselves

```python
@pytest.fixture(params=[1, 2, 3], ids=["one", "two", "three"])
def number(request):
    return request.param

def test_square(number):
    assert number * number == number ** 2  # runs 3 times
```

Useful when many tests share the same variation axis.

## Generating params dynamically

`pytest_generate_tests` hook in `conftest.py` builds params from config or external sources:

```python
def pytest_generate_tests(metafunc):
    if "browser" in metafunc.fixturenames:
        metafunc.parametrize("browser", metafunc.config.getoption("--browsers").split(","))
```

Reach for this only when static parametrize can't express the cases.

## ID encoding pitfalls

Non-ASCII or special characters in param values can produce surprising IDs. Provide explicit `ids=` when:

- Values are dicts/objects (default ID = repr, often unreadable)
- Values contain `/`, `[`, `]`, `:` (collide with node ID syntax)
- Tests run in CI tools that munge non-ASCII

## Common pitfalls

- **Parametrize argument count mismatch**: `"a,b"` with rows of length 3 raises at collection. Count names = count of values per row.
- **Mutable param values**: a list passed as a param is shared across all instances. Use `pytest.param(lambda: [1,2,3])` and call inside the test, or deepcopy in the test.
- **Stacked parametrize with shared name**: two decorators using the same name override silently. Use distinct names.
- **Forgetting `indirect=True`**: param ends up as the literal value when a fixture exists with that name — silent override of the fixture.
