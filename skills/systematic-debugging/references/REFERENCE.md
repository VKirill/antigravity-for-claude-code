# References index — systematic-debugging

## Decision tree

```
A bug / test failure / unexpected behaviour
│
├─ Can you reproduce it on demand?
│   ├─ Yes → methodology.md (start at step 3: hypothesis)
│   └─ No → reproduction.md (make it reliable first)
│
├─ It worked yesterday / before commit X?
│   → bisection.md (binary-search the commit set)
│
├─ Only happens in production / under load?
│   → log-driven-debugging.md
│
├─ Need to trace data flow through many files?
│   → graph-aware-debugging.md
│
└─ Recognise the symptom? (NaN, timezone shift, lost event...)
    → common-bug-classes.md (match-and-fix)
```

## Quick map

| Symptom | Open |
|---|---|
| `expected X, got NaN` | [common-bug-classes.md](common-bug-classes.md#nan-propagation) |
| Times off by hours | [common-bug-classes.md](common-bug-classes.md#timezone--locale) |
| Works locally, fails in CI | [reproduction.md](reproduction.md#environment-differences) |
| "Sometimes" / "occasionally" | [reproduction.md](reproduction.md#intermittent-bugs) + [common-bug-classes.md](common-bug-classes.md#race-conditions) |
| Test passes, but feature still broken | [methodology.md](methodology.md#fix-vs-symptom-suppression) |
| Memory keeps growing | [common-bug-classes.md](common-bug-classes.md#memory-leaks) |
| Worked before refactor | [bisection.md](bisection.md) + [graph-aware-debugging.md](graph-aware-debugging.md) |
| Stack trace points to a library, not your code | [anti-patterns.md](anti-patterns.md#blame-the-library) |
| Got fix idea immediately | [anti-patterns.md](anti-patterns.md#premature-fix) |
| Async / promise / callback weirdness | [common-bug-classes.md](common-bug-classes.md#async-ordering) |

## Disciplines to apply

| Discipline | Why |
|---|---|
| Change ONE thing at a time | Otherwise you can't tell what fixed (or broke) what |
| Reproduce before fixing | Otherwise you can't verify the fix |
| Name root cause in one sentence | Forces you to actually understand |
| Add regression test that fails without fix | Locks in the fix; documents the bug |
| Re-verify in original scenario | Regression test ≠ original symptom |
