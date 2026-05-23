# Test Stability Checklist

Reduce flaky tests, timer leaks, isolation problems, and CI-specific failures.

## Pre-checklist: define "flaky"

A flaky test fails on some runs and passes on others with no code changes. Root causes:
1. Timer/async ordering — test doesn't await all async work
2. Shared state — previous test mutates module-level data
3. External dependencies — real network calls, real clocks, real files
4. Non-deterministic data — random IDs, `Date.now()`, `Math.random()`
5. Parallel interference — tests that share a DB row or file path

---

## Timer hygiene

- [ ] `vi.useFakeTimers()` is called before the test that needs it (not in `beforeAll`)
- [ ] `vi.useRealTimers()` is called in `afterEach` — not `afterAll`
- [ ] All `vi.advanceTimersByTime()` calls are awaited when the callback is async
- [ ] `vi.runAllTimersAsync()` is used (not `vi.runAllTimers()`) for async timer callbacks
- [ ] No `setTimeout(() => {}, 0)` used to "fix" test ordering — find the real async gap

```ts
// Good: symmetric setup/teardown
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

// Bad: afterAll leaves timers faked for file's remaining tests
afterAll(() => { vi.useRealTimers() })
```

---

## Mock isolation

- [ ] `vi.restoreAllMocks()` is called in `afterEach` (not `afterAll`)
- [ ] No spy is set up in `beforeAll` and expected in a later test file — spy state is file-scoped in v4
- [ ] `vi.mock()` calls are at module top level — never inside `describe` or `it` blocks
- [ ] `vi.hoisted()` is used for variables that must be available inside `vi.mock` factories
- [ ] Module-level state (counters, caches, singleton instances) is reset in `beforeEach`

```ts
// Good: restore after each test
afterEach(() => { vi.restoreAllMocks() })

// Bad: restore only at suite end — leaks between tests
afterAll(() => { vi.restoreAllMocks() })
```

---

## Async correctness

- [ ] All async setup/teardown functions use `async/await` — no unhandled floating promises
- [ ] `expect.assertions(N)` used in tests with async branches to catch missing assertions
- [ ] No `setTimeout(done, 100)` for async tests — use `await` patterns
- [ ] `Promise.all` used when multiple independent async ops are awaited
- [ ] Rejections are expected explicitly: `await expect(fn()).rejects.toThrow(...)`

```ts
// Good: explicit rejection test
it('throws on invalid input', async () => {
  await expect(parseDate('not-a-date')).rejects.toThrow('Invalid date format')
})

// Bad: unhandled rejection causes "mysterious" test failure
it('throws on invalid input', async () => {
  parseDate('not-a-date')  // rejection is not awaited/checked
})
```

---

## External dependency isolation

- [ ] No real HTTP calls in unit tests — all fetch/axios/got calls are mocked
- [ ] No real filesystem writes in tests — use `os.tmpdir()` or mock `node:fs`
- [ ] No real `Date.now()` / `new Date()` in time-sensitive tests — use fake timers or fixed dates
- [ ] No `Math.random()` without a seed — use a seeded PRNG or mock for determinism
- [ ] No real environment variables leaking between tests — reset in `afterEach`

```ts
// Good: fixed date for deterministic test
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
})
afterEach(() => { vi.useRealTimers() })

// Bad: test fails on different days
it('shows "3 days ago"', () => {
  expect(formatRelativeTime(new Date('2024-01-12'))).toBe('3 days ago')
  // Passes on 2024-01-15, fails on 2024-01-20
})
```

---

## Snapshot stability

- [ ] Snapshots don't contain `Date`, `UUID`, `timestamp`, or stack trace content
- [ ] Asymmetric matchers (`expect.any(Date)`) used for dynamic fields in snapshot assertions
- [ ] Inline snapshots are used for values < ~10 properties
- [ ] Snapshot files are committed to version control and reviewed in PRs
- [ ] `--update-snapshots` is run after intentional changes, not to silence failures

---

## DB test stability (integration tests)

- [ ] Each test uses transaction rollback OR isolated schema (see `examples/db-test-fixture.md`)
- [ ] No test assumes specific row counts without owning all rows in the table
- [ ] Tests that share schema objects use unique names (randomized IDs, not hardcoded `'test-user'`)
- [ ] DB integration tests run with `poolOptions.forks.singleFork: true` (serial) to avoid connection contention
- [ ] `testTimeout` is at least 15s for DB tests (`30_000` recommended)

---

## CI-specific settings

- [ ] `retry: 1` is added for tests that fail rarely but aren't truly flaky (network-dependent)
- [ ] `--reporter=dot` in CI to reduce log noise
- [ ] Coverage runs with `vitest run` (not watch mode)
- [ ] Test result JUnit XML is exported for CI test result UI:
  ```ts
  reporters: [['junit', { outputFile: './junit.xml' }]]
  ```
- [ ] Parallel test workers don't share temp files (use `os.tmpdir()` + test-specific subdirs)

---

## Self-check before declaring tests stable

- [ ] Run `vitest run` 3 times in a row — same result every time
- [ ] Run `vitest run --pool=forks --poolOptions.forks.singleFork=false` — no new failures
- [ ] Run `vitest run --reporter=verbose` — no warnings about leaked handles or unresolved promises
- [ ] Run in CI environment once before merging — CI Node version may differ from local
