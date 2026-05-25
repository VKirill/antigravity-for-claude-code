---
name: testing-craft
description: "Universal test-writing discipline from Meszaros + Osherove + Beck/GOOS. Use when: worker-tester writes/edits tests, adds coverage for new behavior, refactors a flaky/slow/obscure suite. Trigger terms: test double, stub mock fake spy, fixture, AAA, four-phase test, assertion roulette, mystery guest. SKIP: writing production code (use coder-craft), manual exploratory testing."
stacks:
  - stack-agnostic
tags:
  - testing
  - unit-tests
  - test-doubles
  - fixtures
  - test-smells
  - assertion-patterns
source: "3+ books — see ## Sources"
---

## Use this skill when

- worker-tester is dispatched to write tests for a new capability or fix.
- Writing a failing test first (TDD red → green → refactor).
- Adding a regression test after a bug fix (re-breaking proof).
- Refactoring a slow / flaky / obscure existing test suite.
- Choosing between stub / spy / mock / fake for an external dependency.

## Do not use this skill when

- Writing production code first (use coder-craft).
- Manual UX or exploratory testing (no programmatic assertion).
- The contract is doc-only or config-only — nothing to assert.

## Purpose

Translate decades of canonical test-writing wisdom into one stack-agnostic discipline for worker-tester. Three axes: anatomy (AAA, four-phase, naming), isolation (test doubles, fresh fixtures), maintainability (test smells, single-condition tests). Each rule cites consensus across canonical testing books so the agent has both rule and rationale.

## Capabilities

### Anatomy: AAA, four-phase, and naming

Every test follows AAA — Arrange, Act, Assert — as three visually-distinct blocks (Osherove Ch. 2). Meszaros formalizes this as the four-phase test: setup → exercise → verify → teardown. Test name encodes intent: `{UnitOfWork}_{Scenario}_{ExpectedBehavior}` (Osherove Ch. 7) or `should_X_when_Y` — pick one style and stay consistent across the suite. Tests are pure: same inputs → same outputs, no order dependency, no shared state.

Apply when:
- Writing a new test — sketch the assertion FIRST, then arrange + act backwards from it.
- Reviewing an existing test — can you see the 3 phases at a glance? If not, refactor for readability before adding logic.

### Test doubles: dummy, stub, spy, mock, fake

Five distinct kinds (Meszaros Ch. 11, refined by Osherove + GOOS):

- **Dummy** — passed but never used (placeholder for required arg).
- **Stub** — returns canned values for indirect inputs; *never fails the test*.
- **Spy** — records calls for after-the-fact inspection.
- **Mock** — pre-programmed expectations; *fails the test* if expectations missed.
- **Fake** — lightweight working implementation (in-memory DB, fake auth server).

Critical cross-source rules:
- Prefer **state verification** over interaction verification — mocks overspecify and create fragile tests (Osherove + GOOS).
- **One mock per test** maximum (Osherove Ch. 4) — more = test asserts too many things.
- **Don't mock what you don't own** (GOOS principle) — wrap third-party SDK in your own interface first, mock the wrapper.
- Use **fakes** for stateful collaborators (DB, queue), **stubs** for stateless responses.

Apply when:
- Tempted to mock the AWS / Stripe / Telegram SDK directly — wrap it in your own `PaymentGateway` interface, then mock that.
- A test has 3 mocks — it's testing too much; split.

### Fixture management

Fresh Fixture is the default: each test sets up its own data, tears down clean (Meszaros Ch. 8). Shared Fixture only when performance demands it — at the cost of risking Interacting Tests. Setup style preference: in-line > implicit (setUp method) > delegated. Use **Creation Methods** (`make_user(...)` factory in test utilities) instead of `new User(...)` scattered through tests. Avoid the General Fixture anti-pattern (one big fixture used everywhere with most fields unused per test).

Apply when:
- Multiple tests instantiate the same object structure — extract to a Creation Method.
- A test references data not visible in its body — Mystery Guest smell, refactor to in-line setup.

### Result verification patterns

State verification is the default — assert on observable state via public API after the action (Meszaros Ch. 10). Use **Expected Object** to compare whole objects rather than field-by-field — clearer diff messages on failure. Build **Custom Assertions** (`assertUserCanLogin(user)`) over chains of low-level asserts. Single logical assertion per test; multiple unrelated asserts = Eager Test smell. Every assert carries a meaningful failure message — bare `assert(x)` is a debugging black hole.

Apply when:
- One test has 3+ unrelated asserts — split into 3 tests.
- Asserting many fields of the same returned object — extract Expected Object.
- Tempted to assert on internal call count — first ask if observable state would tell the same story.

### Test smells diagnostics

Recognize and fix (Meszaros Ch. 2 + Osherove Ch. 7):

| Smell | Symptom | Fix |
|---|---|---|
| Mystery Guest | Hidden test data | In-line setup or named Creation Method |
| Eager Test | One test, many behaviors | Split into Single-Condition Tests |
| Assertion Roulette | Multiple asserts, no messages | Add messages or split |
| Fragile Test | Breaks on unrelated SUT changes | Switch from mocks to state verification |
| Slow Test | Hits file / DB / network | Isolate via stub or fake |
| Interacting Tests | Order-dependent passing | Fresh Fixture + automated teardown |
| Test Code Duplication | Boilerplate everywhere | Creation Methods + Custom Assertions |
| Conditional Test Logic | if/for/while inside test | Split into multiple tests |
| Hidden Test Call | One test calls another | Extract shared private helper |
| General Fixture | Setup creates unused data | Per-test in-line setup |

### Outside-in + TDD discipline

From GOOS + Beck TDD: start with the outermost test (acceptance / E2E thinnest slice), let it fail at the first missing layer, drill in. **Walking skeleton** = end-to-end runnable from day one, even if every layer is stubs. **Red → Green → Refactor** as three distinct steps, never two at once. Maintain a **test list** at the start of a task — jot every scenario you can think of, work them one-by-one. **Listen to the tests**: pain in test setup is design feedback — hard to test = production code too coupled.

Apply when:
- Implementing a new capability — write failing acceptance test FIRST.
- A test needs 8 lines of setup to call one method — that's a design smell in the production code, not in the test.

## Behavioral Traits

- Always AAA-visible: arrange, act, assert as distinct sections.
- Always assert on observable state via public API, not internals.
- Always one logical assertion per test.
- Always one mock per test maximum.
- Test names describe behavior, not implementation.
- Fresh fixture per test unless performance forbids.
- Always add a meaningful assertion message.
- Don't mock what you don't own — wrap third-party first.
- When a fix lands, the regression test it satisfies must EXIST and be green.

## Important Constraints

- NEVER let a unit test touch filesystem / network / real DB — that's an integration test, separate suite.
- NEVER allow tests to depend on each other's execution order.
- NEVER include conditional logic (if / while / for) inside a test body.
- NEVER mock what you don't own — wrap third-party in your own interface first.
- NEVER add a test that passes without first failing on un-fixed code.
- NEVER test private methods directly; exercise via public contract.
- NEVER use real timestamps / random / globals without injection or freezing.
- ALWAYS write the regression test before marking a bug fix complete.
- ALWAYS use Creation Methods for non-trivial fixture objects.
- ALWAYS prefer state verification; reach for interaction verification only when forced.

## Anti-patterns

### ❌ Mystery Guest

**Source:** Meszaros Ch. 8. **Why wrong:** Test depends on data not visible in the test body (shared fixture, external file). Reader can't reason about cause-effect.

**Fix:** In-line setup, OR named Creation Method that takes explicit arguments.

### ❌ Assertion Roulette

**Source:** Meszaros. **Why wrong:** Multiple asserts in one test without messages — when one fails, you can't tell which from the log.

**Fix:** Add descriptive messages, or split into Single-Condition Tests.

### ❌ Eager Test

**Source:** Meszaros. **Why wrong:** One test exercises many capabilities — defect localization fails (which capability broke?).

**Fix:** One logical assertion per test; split the test.

### ❌ Fragile Test

**Source:** Meszaros. **Why wrong:** Test breaks on unrelated SUT changes — usually because it mocks too much / verifies internal calls instead of observable behavior.

**Fix:** State verification via public API instead of interaction verification.

### ❌ Interacting Tests

**Source:** Meszaros. **Why wrong:** Order-dependent passing — leftover state from previous test makes this one pass or fail.

**Fix:** Fresh Fixture per test + automated teardown.

### ❌ Setup Monster

**Source:** Osherove. **Why wrong:** `[SetUp]` method does initialization only some tests need — implicit, hard to follow per-test.

**Fix:** Factory methods called per-test, not all-in shared setUp.

### ❌ Don't Mock What You Don't Own

**Source:** GOOS principle. **Why wrong:** Mocking AWS SDK, Stripe SDK, Telegram Bot API directly couples tests to third-party signatures that you can't refactor.

**Fix:** Wrap the third-party in your own interface (`PaymentGateway`, `MessageSender`); mock the wrapper.

## Related Skills

### Sibling methodology skills
- `coder-craft` — production-code discipline; tests exercise what coder-craft writes
- `debugging-craft` — when a test goes red, diagnose methodically
- `tdd` — global TDD skill: write failing test first, minimal impl, refactor
- `karpathy-guidelines` — anti-overcomplication; also applies to test setups

### Stack-specific test runners (load via skill_hints in YAML contract)
- `pytest` — Python's #1 test framework
- `vitest` — Vite-native unit testing for JS/TS
- `playwright` — E2E browser testing

## Citations from source

> Legacy code is code that has no tests.
> — *Osherove, Ch. 1, p. 10*

> The basic difference is that stubs can't fail tests, and mocks can.
> — *Osherove, Ch. 4, p. 85*

> If a test won't fail even when the code to implement the functionality doesn't exist, how useful is it for Defect Localization? Not very!
> — *Meszaros, Ch. 17, p. 274*

> Tests should require minimal maintenance as the system evolves around them.
> — *Meszaros, Ch. 3, p. 21*

> Tests are stories we tell the next generation of programmers on a project.
> — *Osherove, Ch. 7, p. 209*

> If you have logic in your test, you're testing more than one thing at a time, which isn't recommended, because the test is less readable and more fragile.
> — *Osherove, Ch. 7, p. 178*

## Sources

- Gerard Meszaros — *xUnit Test Patterns: Refactoring Test Code* (2007)
- Roy Osherove — *The Art of Unit Testing* (2009)
- Kent Beck — *Test-Driven Development by Example* (2002) — TDD red/green/refactor discipline integrated from model knowledge
- Steve Freeman & Nat Pryce — *Growing Object-Oriented Software, Guided by Tests* (2009) — outside-in TDD, walking skeleton (Ch. 4, p. 32), "Only Mock Types That You Own" (Ch. 8, p. 69), "listen to the tests" as design feedback (Ch. 20, p. 229), async testing via polling not sleeps (Ch. 27, p. 316)
- Michael Feathers — *Working Effectively with Legacy Code* (2005) — characterization tests, already extracted in coder-craft sources
