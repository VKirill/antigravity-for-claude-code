---
name: tdd
description: "Test-driven development discipline for workers — write failing test first, minimal implementation, green, refactor. Applies to behavior-testable changes (API endpoints, pure functions, business logic). Replaces superpowers:test-driven-development. Use when: implementing a feature with testable behavior, before writing implementation code."
---

# TDD — Test First Discipline

For any change whose behavior can be expressed as `input → output`, write the test before the code. Not after. Not "I'll add tests later".

## When TDD applies

✅ Pure functions, business logic, validators, parsers, math, data transforms
✅ API endpoints (with `supertest`/`TestClient`/`fetch`)
✅ DB queries (with real DB or `testcontainers`)
✅ State machines, reducers, finite-state logic
✅ Bug fixes — write a regression test that reproduces the bug FIRST

## When TDD doesn't apply

❌ UI visual components (use visual regression tests separately, but don't TDD CSS)
❌ Glue code that wires components together
❌ Throwaway exploration / spike code
❌ Config file changes
❌ Refactors with NO behavior change (existing tests catch regressions)

## The cycle

```
1. RED    — write a failing test
2. (verify it fails for the right reason — not a syntax error)
3. GREEN  — write minimum code to pass
4. (verify it passes)
5. REFACTOR — only if the design pain is real, not speculative
6. (verify still green)
7. Commit. Move to next test.
```

**Per cycle ≤ 5 minutes of clock time.** If the cycle takes longer, the test is too big — split it.

## How to write the test first

1. **Name the behavior** in plain language. "When the JWT is invalid, return 401."
2. **Translate to assertion.** `expect(response.status).toBe(401)`.
3. **Set up the input.** Minimum fixture that triggers the behavior.
4. **Run it.** It must fail. If it passes, you're testing the wrong thing.
5. **Read the failure message.** Does it tell you what's missing? If not, fix the test, not the code.

## Anti-patterns

- ❌ **Writing code, then writing tests around it.** That's test-after, not TDD. The code's shape biases the tests.
- ❌ **Writing 10 tests upfront, then implementing.** Cycle = one test at a time.
- ❌ **Skipping RED.** "I'm sure it'll fail" — run it anyway. Sometimes the test infrastructure is broken and you'd write code against a green test.
- ❌ **Over-mocking.** Test the real thing when feasible. Mock external boundaries (HTTP, time, randomness), not your own code.
- ❌ **Snapshot tests as primary assertions.** Snapshots catch regressions, not behavior. Write explicit `expect(x).toBe(y)` for the behavior you care about.
- ❌ **Negative tests as afterthoughts.** Every function has a "what if input is wrong" path. Test it.

## Refactor phase

The refactor step is **optional**. Apply ONLY when:
- Code duplication you can extract cleanly
- A name became misleading after the change
- A function grew past ~30 lines

Do NOT refactor:
- Surrounding code that wasn't part of this cycle (scope creep)
- Code style you'd write differently (matches-existing-style rule)
- Premature abstraction for a hypothetical future case (YAGNI)

## How this fits with `worker-coder`

When `worker-coder` receives a task contract with `acceptance_criteria` and testable behavior:

1. Open or create the test file from `files_to_touch` (usually `*.test.*`).
2. Write one test per criterion.
3. Run `verification_commands` — confirm tests fail with meaningful errors.
4. Implement minimum code in the source file.
5. Re-run — confirm green.
6. Repeat for next criterion.

The contract's `verification_commands` typically include the test runner. That makes TDD natural — verification is the same command you'd run during RED/GREEN.

## Bug fix variant

For bug fixes:
1. Read the bug report.
2. Write a test that **reproduces the bug** — it must fail today.
3. Confirm it fails with the right symptom.
4. Fix the code.
5. Confirm test passes.
6. This test becomes a regression guard.

Without step 2, you can't prove you fixed anything. The user can't either.
