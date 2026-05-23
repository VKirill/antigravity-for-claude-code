---
name: vitest
description: "Vitest 4 unit testing — Vite-native, ESM-first, fast HMR. Use when: vitest, unit tests, integration tests, vi.mock, vi.fn, vi.spyOn, vi.useFakeTimers, expect, toMatchSnapshot, toMatchInlineSnapshot, projects API, pool config, browser mode, coverage, vitest.config.ts, test setup, beforeEach, afterEach, describe, it, suite. SKIP: E2E testing (→playwright), pure node:test runner without Vite (→nodejs)."
stacks:
  - frontend
  - nodejs-backend
  - fullstack
packages:
  - vitest
  - "@vitest/coverage-v8"
  - "@vitest/coverage-istanbul"
  - "@vitest/browser"
  - "@vitest/ui"
tags:
  - testing
  - vitest
  - unit-test
  - vite
  - esm
  - coverage
  - mocking
source: vechkasov-global-skills
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Vitest: `4.x`
- TypeScript: `6.0.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need, then follow the link to the relevant reference file for full detail.

## Use this skill when

- Setting up Vitest in a new or existing project (vitest.config.ts, test environment, globals, setup files)
- Writing unit tests with `describe`, `it`/`test`, `expect`, `beforeEach`, `afterEach`, `beforeAll`, `afterAll`
- Mocking modules with `vi.mock`, `vi.fn`, `vi.spyOn`, `vi.importMock`, factory patterns, hoisting
- Working with fake timers: `vi.useFakeTimers`, `vi.advanceTimersByTime`, `vi.runAllTimers`
- Snapshot testing: inline snapshots (`toMatchInlineSnapshot`), file snapshots (`toMatchSnapshot`), snapshot v2 format
- Configuring test isolation: pool settings, `--isolate`, `--singleFork`, per-test file environments
- Using the `projects` API (renamed from `workspace` in Vitest 3.2; old key removed entirely in v4) for monorepo or multi-environment test configs
- Running browser mode tests via `@vitest/browser` with Playwright or WebDriver provider
- Measuring coverage: v8 provider, Istanbul provider, per-file thresholds, coverage overhaul in v4
- Migrating from Vitest 3 to 4: pool config flattening, spy behavior changes, snapshot v2, projects rename
- Debugging flaky tests, watch mode, UI mode (`@vitest/ui`), concurrent test strategies
- Creating test fixtures, data factories, and DB isolation patterns for integration tests

## Do not use this skill when

- Task is Playwright E2E browser automation (page navigation, network mocking, full browser tests) — use `playwright`
- Task is `node:test` runner without Vite or Vitest involved — use `nodejs`
- Task is Jest-specific (jest.config.js, @jest/globals, Jest transform pipeline) — consult jest docs directly
- Task is Vitest UI design/component testing in React/Vue beyond test infrastructure — use `react` or `vue`
- Task is CI pipeline orchestration (matrix, artifact upload) — спроси пользователя, какая система CI используется; **GitHub Actions YAML не предлагать по умолчанию**, тесты в нашем стеке гоняются локально.

## Purpose

Vitest 4 is the standard test framework for Vite-based projects. It shares Vite's config, plugin pipeline, and transformer, meaning tests run with the same module resolution, aliases, and environment as production code — zero duplication. Hot module replacement makes watch mode near-instant even on large suites.

Vitest 4 introduced breaking changes worth knowing: the `workspace` config key was renamed to `projects`, pool configuration was flattened (forks/threads/vmForks/vmThreads → unified pool options), snapshot format v2 adds shadow-root support, and spy `.mock.calls` no longer mutates between test files in isolation mode. This skill covers all v4 specifics, the full mocking API surface, coverage providers, browser mode, and production patterns for data factories and DB test isolation.

## Capabilities

### vitest.config.ts — Core Configuration

Config lives in `vitest.config.ts` (or inside `vite.config.ts` under `test:`). Key options: `environment` (`node` default, `jsdom`, `happy-dom`, `edge-runtime`), `globals: true` (inject describe/it/expect without imports), `setupFiles` (runs before each test file), `globalSetup` (runs once per worker), `include`/`exclude` globs, `testTimeout`, `hookTimeout`.

Pool options were **flattened in v4**: use `pool: 'forks' | 'threads' | 'vmForks' | 'vmThreads'` plus `poolOptions.forks.*` / `poolOptions.threads.*`. The old `forks: {}` / `threads: {}` top-level keys are removed.

> Full config reference: [references/config.md](references/config.md)

### Mocking — vi.mock, vi.fn, vi.spyOn

`vi.mock('module-path')` replaces an entire module before test execution. Hoisting: Vitest auto-hoists `vi.mock()` calls to the top of the file — no manual `jest.mock` hoist workarounds needed. Factory functions receive no arguments; use `vi.importActual` inside factory for partial mocks.

`vi.fn()` creates a standalone mock function with `.mock.calls`, `.mock.results`, `.mock.instances`. `vi.spyOn(obj, 'method')` wraps an existing method; restore with `vi.restoreAllMocks()` in `afterEach`. **v4 breaking**: spy state no longer bleeds across test files when running in isolation (correct behavior, was a bug in v3).

> Full mocking reference: [references/mocking.md](references/mocking.md)

### Snapshots v2

`toMatchSnapshot()` writes to `__snapshots__/*.snap`. `toMatchInlineSnapshot()` writes the snapshot directly into the source file. Vitest 4 snapshot format v2: adds support for shadow-root serialization, changes the serialization of custom elements. Update snapshots with `vitest --update-snapshots` or `u` key in watch mode.

> Full snapshot reference: [references/snapshots.md](references/snapshots.md)

### Projects API (renamed from workspace)

Vitest 4 renames `workspace` → `projects`. Define multiple projects in `vitest.config.ts` via `test.projects: [...]` — each entry is a config object or a glob. Use for: running browser + node tests in one `vitest` invocation, per-package configs in a monorepo, separate environments (dom vs node) without separate runs.

> Full projects reference: [references/projects-api.md](references/projects-api.md)

### Browser Mode

`@vitest/browser` runs tests inside a real browser (Chromium/Firefox/WebKit via Playwright, or WebdriverIO). Import from `vitest/browser` (not `@vitest/browser`) in test files. Configure `browser.provider: 'playwright'`, `browser.name: 'chromium'`. Use `page` fixture from `@vitest/browser/context` for DOM interaction. Different from Playwright E2E: still unit-test semantics (describe/it/expect), no full navigation.

> Full browser mode reference: [references/browser-mode.md](references/browser-mode.md)

### Coverage

Two providers: `@vitest/coverage-v8` (fast, uses Node's built-in V8 coverage, less accurate for branches) and `@vitest/coverage-istanbul` (slower, more accurate branch coverage, works with any environment). Configure via `coverage.provider`, `coverage.include`, `coverage.exclude`, `coverage.thresholds`. Vitest 4 overhauled threshold reporting — per-file thresholds now work correctly; `coverage.thresholds.perFile: true` enforces minimums on each file independently.

> Full coverage reference: [references/coverage.md](references/coverage.md)

### Migration: Vitest 3 → 4

Key breaking changes: (1) `test.workspace` → `test.projects`; (2) pool config keys flattened; (3) snapshot v2 format — run `--update-snapshots` once after upgrade; (4) spy isolation fixed — tests that relied on cross-file spy state mutation will fail (fix: reset spies in `afterEach`); (5) several deprecated `vi.*` aliases removed. Run `npx vitest@4 --reporter=verbose` to surface new failures quickly.

> Migration guide: [references/migration-3-to-4.md](references/migration-3-to-4.md)

### Fake Timers

`vi.useFakeTimers()` replaces `setTimeout`, `setInterval`, `Date`, `clearTimeout`, `clearInterval`. Advance with `vi.advanceTimersByTime(ms)`, `vi.runAllTimers()`, `vi.runAllTimersAsync()`. Restore with `vi.useRealTimers()` or `afterEach(() => vi.useRealTimers())`. Configure which globals to fake via `vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] })`.

### Watch Mode & UI

Watch mode: `vitest` (no flag) — re-runs only affected tests on file change via Vite's module graph. Interactive commands: `f` filter, `u` update snapshots, `r` re-run all, `q` quit. UI mode: `vitest --ui` starts `@vitest/ui` on a local port — visual test explorer with pass/fail, logs, coverage overlay. Useful for navigating large suites.

## Behavioral Traits

- Uses `vitest.config.ts` as the source of truth — does not split config across multiple files without reason
- Writes tests with explicit imports (`import { describe, it, expect, vi } from 'vitest'`) unless `globals: true` is configured project-wide
- Prefers `vi.mock` with a factory function for module mocks — avoids `vi.mock` without factory (produces `undefined` auto-mocks)
- Always restores spies in `afterEach` with `vi.restoreAllMocks()` — never relies on cross-test spy state
- Uses `toMatchInlineSnapshot` for small/stable values, file snapshots for large serialized objects
- Reaches for `v8` coverage first; switches to `istanbul` only when branch coverage accuracy is blocking
- Places shared fixtures and factories in `test/` or `src/__tests__/` — not scattered in test files
- Uses `projects` API instead of separate `vitest` invocations for multi-environment monorepos
- Runs `--reporter=verbose` when debugging, `--reporter=dot` in CI for minimal output

## Important Constraints

- NEVER use `workspace` key in Vitest 4 config — it is `projects` now; `workspace` silently does nothing
- NEVER mutate `vi.fn` mock state across test files expecting it to persist — spy isolation is per-file in v4
- NEVER call `vi.mock` inside a describe/it block — it must be at module top level for hoisting to work
- NEVER run coverage in watch mode for CI — use `vitest run --coverage` for single-pass CI runs
- ALWAYS call `vi.useRealTimers()` in `afterEach` when using fake timers — leaking fakes breaks subsequent tests
- ALWAYS install the correct coverage package (`@vitest/coverage-v8` or `@vitest/coverage-istanbul`) — Vitest errors without it
- ALWAYS update snapshots after upgrading to v4 — snapshot format v2 changes serialization output
- NEVER put `globalSetup` logic in `setupFiles` — `globalSetup` runs once per worker, `setupFiles` runs per test file

## Related Skills

**90%-filter applied** — mainstream 2026 choices only.

✓ marks **active** skills; the rest are **cascade markers** — generate on first real touch.

### Testing
- ✓ `playwright` — Playwright 1.60 (E2E counterpart; vitest/browser does unit-level DOM, playwright does full E2E)
- ✓ `nodejs` — node:test runner, zero-install alternative for non-Vite projects

### Language / types
- ✓ `typescript` — TypeScript 6.0 (dominant pairing; vitest has first-class TS support)

### Frameworks that commonly use Vitest
- ✓ `react` — React 19 (most common component-test target)
- ✓ `vue` — Vue 3.5 (Vitest is official Vue testing recommendation)
- ✓ `nextjs` — Next.js 16 (uses vitest for unit layer, playwright for E2E)

### Build tooling
- ✓ `vite` — Vite 7 (Vitest 4 supports Vite 6 + 7; Vite 8 deferred — Vitest 4.1.1 dropped Vite 8 beta support, Vitest 5 still in beta)

### Validation / fixtures
- ✓ `zod` — Zod 4 (common in test fixture schema validation)

## API Reference

| Topic | File |
|---|---|
| Index + decision map, quick-lookup table | [references/REFERENCE.md](references/REFERENCE.md) |
| vitest.config.ts: environments, pool, globals, setupFiles, coverage, reporters | [references/config.md](references/config.md) |
| vi.mock, vi.fn, vi.spyOn, hoisting, factory patterns, importActual, module mocks | [references/mocking.md](references/mocking.md) |
| toMatchSnapshot, toMatchInlineSnapshot, snapshot v2 format, update workflow | [references/snapshots.md](references/snapshots.md) |
| projects API (v4), multi-environment monorepo, per-package config | [references/projects-api.md](references/projects-api.md) |
| @vitest/browser, playwright provider, page fixture, browser vs E2E distinction | [references/browser-mode.md](references/browser-mode.md) |
| v8 vs istanbul providers, thresholds, perFile, exclude patterns, CI setup | [references/coverage.md](references/coverage.md) |
| Breaking changes v3 → v4, migration steps, snapshot update, pool rename | [references/migration-3-to-4.md](references/migration-3-to-4.md) |
| Routing tests: positive/negative/edge cases | [references/eval-cases.md](references/eval-cases.md) |

### Templates

| Template | File |
|---|---|
| Production vitest.config.ts preset (environments, coverage, pool, projects) | [templates/vitest.config.ts.template](templates/vitest.config.ts.template) |
| test-setup.ts: global mocks, env vars, cleanup hooks | [templates/test-setup.ts.template](templates/test-setup.ts.template) |

### Examples

| Scenario | File |
|---|---|
| Data factory pattern: typed factories with overrides, no magic strings | [examples/factory-pattern.md](examples/factory-pattern.md) |
| DB isolation per test: transaction rollback or schema-per-test with Postgres | [examples/db-test-fixture.md](examples/db-test-fixture.md) |

### Checklists

| Checklist | File |
|---|---|
| Test stability: flake reduction, timer hygiene, isolation hygiene, CI settings | [checklists/test-stability.md](checklists/test-stability.md) |

**How to use**: navigate to the specific file for the topic you need. Don't read all files — look up only what's relevant to the current task.
