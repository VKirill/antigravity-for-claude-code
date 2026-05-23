# Property-Based Testing with Hypothesis

Hypothesis generates inputs from declared **strategies** and shrinks failures to minimal counter-examples. Pair with pytest naturally.

```bash
uv add --dev hypothesis
```

## Basics

```python
from hypothesis import given, strategies as st

@given(st.integers(), st.integers())
def test_add_commutative(a, b):
    assert add(a, b) == add(b, a)
```

Hypothesis runs the test ~100 times (default) with generated values. On failure, it shrinks: it searches for the smallest/simplest input that still fails, then prints that as the canonical failing example.

## Strategies — the building blocks

```python
st.integers(min_value=0, max_value=1000)
st.floats(allow_nan=False, allow_infinity=False)
st.text(min_size=1, max_size=20)
st.booleans()
st.none()
st.lists(st.integers(), min_size=1, max_size=10)
st.sets(st.integers())
st.dictionaries(st.text(), st.integers())
st.tuples(st.integers(), st.text())
st.sampled_from(["red", "green", "blue"])
st.one_of(st.integers(), st.none())
st.datetimes()
st.uuids()
```

Compose:

```python
@st.composite
def user_strategy(draw):
    return {
        "id": draw(st.uuids()),
        "age": draw(st.integers(min_value=0, max_value=120)),
        "name": draw(st.text(min_size=1, max_size=50)),
    }

@given(user_strategy())
def test_user_invariants(user):
    assert user["age"] >= 0
```

## settings

```python
from hypothesis import given, settings, strategies as st

@settings(max_examples=500, deadline=200)
@given(st.lists(st.integers()))
def test_sort_idempotent(lst):
    assert sorted(sorted(lst)) == sorted(lst)
```

- `max_examples` — number of cases per test
- `deadline` — ms per case; failure if exceeded (set `deadline=None` for inherently slow tests)
- `verbosity` — `Verbosity.normal`, `verbose`, `debug`
- `database` — set to `None` to disable, or a path

Apply globally with a profile:

```python
# conftest.py
from hypothesis import HealthCheck, settings, Verbosity

settings.register_profile("ci", max_examples=1000, deadline=None,
                         suppress_health_check=[HealthCheck.too_slow])
settings.register_profile("dev", max_examples=50)
settings.load_profile("dev")
```

Switch in CI: `HYPOTHESIS_PROFILE=ci pytest`.

## Examples database

Hypothesis stores past failures in `.hypothesis/` (gitignored). On the next run, it replays those examples first — regression test for free. To reset: delete the directory.

```toml
[tool.hypothesis]
database_file = ".hypothesis/examples"
```

## Shrinking

When a test fails on `[7, 3, 1, 9, 2]`, Hypothesis searches for a shorter / smaller-element list that still fails. The minimal counter-example is what gets reported:

```
Falsifying example: test_sort([0, -1])
```

Shrinking can take time — that's why `deadline` matters: each shrink iteration runs the test.

## Working with pytest fixtures

Fixtures and `@given` parameters compose; `@given` must come **after** `@pytest.fixture` consumption:

```python
@pytest.fixture
def db():
    yield create_test_db()

@given(value=st.integers())
def test_insert(db, value):
    db.insert(value)
    assert db.get(value) == value
```

Hypothesis runs the test body many times against the **same** fixture — so the fixture should be either idempotent or reset internally. For per-example reset, use `hypothesis.strategies.data` or manage state inside the test.

## assume — discard invalid inputs

```python
from hypothesis import assume, given, strategies as st

@given(st.integers(), st.integers())
def test_div(a, b):
    assume(b != 0)
    assert (a / b) * b == pytest.approx(a)
```

`assume(condition)` rejects the example without failing. Use sparingly — heavy filtering slows generation.

## Stateful testing (RuleBasedStateMachine)

For systems with internal state (queues, stacks, databases), `RuleBasedStateMachine` generates sequences of operations:

```python
from hypothesis.stateful import RuleBasedStateMachine, rule, invariant

class StackMachine(RuleBasedStateMachine):
    def __init__(self):
        super().__init__()
        self.stack = []

    @rule(value=st.integers())
    def push(self, value):
        self.stack.append(value)

    @rule()
    def pop(self):
        if self.stack:
            self.stack.pop()

    @invariant()
    def size_non_negative(self):
        assert len(self.stack) >= 0

TestStack = StackMachine.TestCase
```

## Common pitfalls

- **Shared mutable state across examples**: fixture not reset → first example passes, hundredth fails. Always reset.
- **Heavy `assume(...)`**: most generated examples filtered out → "could not satisfy filter" failure. Use a narrower strategy instead.
- **`deadline` too tight**: real code may legitimately take >200ms per call. Set `deadline=None` or a realistic budget.
- **Generated text containing surrogate pairs / NUL bytes**: many real systems can't handle these. Restrict alphabets: `st.text(alphabet=st.characters(blacklist_categories=("Cs",)))`.
- **No regression after fix**: delete `.hypothesis/` if you fix the bug — old failures might still replay but no longer be canonical.
