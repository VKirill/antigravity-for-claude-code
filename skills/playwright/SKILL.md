---
name: playwright
description: "Playwright 1.60 E2E testing — Chromium/Firefox/WebKit, auto-wait, web-first assertions, fixtures, trace viewer. Use when: playwright, e2e, end-to-end, browser test, getByRole, getByText, getByTestId, locator, expect.toHaveText, fixtures, page.goto, page.evaluate, codegen, trace viewer, HAR, network mocking, sharding, parallel, projects, browser context, storageState, auth fixture. SKIP: unit testing (→vitest), node-only API tests (→vitest), Cypress migration questions."
stacks:
  - testing
  - frontend
  - nodejs-backend
packages:
  - "@playwright/test"
  - playwright
tags:
  - e2e
  - testing
  - browser
  - automation
  - typescript
source: vechkasov-global-skills
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Playwright: `1.60.x`
- TypeScript: `6.0.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need, then follow the link to the relevant reference file for full detail.

## Use this skill when

- Writing or debugging Playwright E2E tests (`.spec.ts` files, `test()` blocks, `expect()` assertions)
- Choosing the right locator: `getByRole`, `getByText`, `getByLabel`, `getByTestId`, etc.
- Setting up authentication fixtures with `storageState` — log in once, reuse session across all tests
- Configuring `playwright.config.ts`: projects (Chromium/Firefox/WebKit), retries, parallelism, sharding
- Mocking network requests with `page.route()`, recording/replaying HAR files
- Using trace viewer, UI mode (`--ui`), or codegen (`playwright codegen`) for debugging
- Running visual regression tests with `toHaveScreenshot()` or `toMatchAriaSnapshot()`
- Component testing with `@playwright/experimental-ct-react`, `ct-vue`, `ct-svelte`
- Setting up CI with sharding across GitHub Actions matrix jobs
- Page Object Model pattern — encapsulating locators and actions in reusable classes

## Do not use this skill when

- Task is unit or integration testing (component logic, utilities, hooks) without a real browser — use `vitest`
- Task is Node.js API testing without a browser (supertest, fetch calls) — use `vitest`
- Task is about migrating from Cypress, TestCafe, or Selenium — scope stays in Playwright; redirect
- Task is about Puppeteer-only APIs — Playwright supersedes Puppeteer for new projects
- Task is mobile app UI testing (iOS/Android native) — Playwright targets web only

## Purpose

Playwright is the dominant browser automation framework for E2E testing in 2026. It ships with full cross-browser support (Chromium, Firefox, WebKit), built-in auto-waiting that makes flaky-test-inducing explicit sleeps unnecessary, and a web-first assertion library that retries until the expected state is true. The `@playwright/test` runner integrates fixtures, parallelism, sharding, and the trace viewer — a complete E2E testing platform in a single package.

This skill covers everything from writing your first test to production CI configuration: locator selection strategy, authentication fixtures via `storageState`, network mocking and HAR replay, visual regression with `toHaveScreenshot`, accessibility snapshots, component testing, sharding for CI speed, and the Page Object Model for large test suites. It hands off to `vitest` for unit testing and `typescript` for TypeScript type-system questions.

What this skill does NOT do: test React component logic in isolation (use Vitest + Testing Library), run backend API contract tests without a browser, or advise on Cypress/Selenium migration strategy.

## Capabilities

Each line below points to the canonical reference. The reference owns code, edge cases, and gotchas.

- **Locators** — semantic priority: `getByRole(role, { name })` → `getByLabel` → `getByPlaceholder` → `getByText` → `getByAltText` → `getByTitle` → `getByTestId`. Avoid CSS/XPath. Lazy + auto-wait. `locator.filter()` for narrowing. → [references/locators.md](references/locators.md)
- **Fixtures & auth** — `test.extend` replaces `beforeEach` boilerplate. Built-ins: `page`/`browser`/`browserContext`/`request`. Auth pattern: `auth.setup.ts` saves `storageState` JSON; dependent project consumes it (login once per worker). → [references/fixtures-and-auth.md](references/fixtures-and-auth.md)
- **Parallel & sharding** — `fullyParallel: true` parallelizes per test; `test.describe.parallel()` within file; `test.describe.serial()` for ordered. CI shard: `--shard=1/4`; merge with `playwright merge-reports`. → [references/parallel-sharding.md](references/parallel-sharding.md)
- **Network mocking** — `page.route(url, handler)` → `route.fulfill({ json })` / `abort` / `continue`. HAR via `page.routeFromHAR('fixtures/api.har', { update: true })` for record; remove `update` to replay. → [references/network-mocking.md](references/network-mocking.md)
- **Visual + ARIA snapshots** — `expect(page).toHaveScreenshot('name.png')` for pixel diff; `expect(locator).toMatchAriaSnapshot()` for accessibility tree (resilient to styling changes). → [references/visual-regression.md](references/visual-regression.md)
- **CI** — shard matrix, cache `~/.cache/ms-playwright`, upload traces/screenshots on failure, `--forbid-only`, `playwright install --with-deps`. → [references/ci-integration.md](references/ci-integration.md)
- **Debugging** — `--trace on` + `playwright show-trace`; `--ui` mode for interactive runner; `playwright codegen URL` to bootstrap then replace CSS selectors with semantic locators.
- **Component testing** — `@playwright/experimental-ct-react` / `-vue` / `-svelte`. Mounts in real browser (not jsdom); use for canvas/real-CSS/browser-API dependencies.

## Behavioral Traits

- Chooses `getByRole` first — it exercises real accessibility semantics, not implementation details
- Never uses `page.waitForTimeout()` — uses web-first assertions or `waitForSelector` with a meaningful condition instead
- Uses `storageState` fixtures for auth in every project — never logs in per-test
- Runs `playwright codegen` to bootstrap a test, then manually replaces CSS selectors with semantic locators
- Applies `test.step()` for long tests to make trace viewer navigation readable
- Always uploads traces and screenshot artifacts in CI — never ships a CI job that silently swallows failures
- Uses `toHaveScreenshot` with a named file argument, not unnamed (prevents ordering-dependent names)
- Scopes `page.route()` mocks to the narrowest URL pattern possible — avoids accidental over-mocking
- Prefers `expect(locator).toBeVisible()` over `locator.isVisible()` — the former retries; the latter is a one-shot snapshot

## Important Constraints

- NEVER use `page.waitForTimeout(ms)` — it causes flaky tests; use web-first assertions instead
- NEVER select by CSS class names or XPath in new tests — coupling to markup makes tests brittle
- NEVER share a `page` object between tests in parallel mode — each test must own its page
- NEVER store auth credentials in test files — use environment variables + `storageState` JSON
- NEVER commit `playwright/.auth/` to version control — it contains session tokens; add to `.gitignore`
- ALWAYS set `retries: 2` in CI config — network jitter causes false failures on first run
- ALWAYS add `--forbid-only` to CI `playwright test` command — prevents accidentally committed `test.only`
- ALWAYS use `playwright install --with-deps` in CI, not bare `playwright install` — installs system libs
- ALWAYS add `testIdAttribute` config if team uses a non-standard test-id attribute (e.g. `data-cy`)

## Related Skills

**90%-filter applied** — entries are dominant choices in 2026.

### Language
- ✓ `typescript` — TS 5.9 (default pairing; all Playwright examples are TypeScript-first)

### Unit testing (complementary, not competing)
- ✓ `vitest` — Vitest 4 (unit + component testing, same project as Playwright E2E)

### Frontend frameworks (common Playwright targets)
- ✓ `react` — React 19 (most common Playwright CT target)
- ✓ `nextjs` — Next.js 16 (most common full-stack Playwright target)

### CI/CD
- `github-actions` — mainstream CI where sharding + artifact upload is configured

### Node.js runtime
- ✓ `nodejs` — Node.js 24 (Playwright runs on Node; test utilities, fixtures use Node APIs)

## API Reference

Load only the file relevant to your current task:

| Topic | File |
|---|---|
| Index, decision map, locator selection flowchart, quick-lookup tables | [references/REFERENCE.md](references/REFERENCE.md) |
| Locator API — getByRole/getByText/getByLabel/filter/chaining, anti-patterns | [references/locators.md](references/locators.md) |
| Fixtures (test.extend), built-ins, storageState auth, multi-user flows | [references/fixtures-and-auth.md](references/fixtures-and-auth.md) |
| Parallel modes, fullyParallel, sharding, serial describes, worker isolation | [references/parallel-sharding.md](references/parallel-sharding.md) |
| page.route(), HAR record/replay, response modification, abort patterns | [references/network-mocking.md](references/network-mocking.md) |
| toHaveScreenshot, toMatchAriaSnapshot, thresholds, baseline management | [references/visual-regression.md](references/visual-regression.md) |
| GitHub Actions matrix sharding, browser cache, trace upload, Docker CI | [references/ci-integration.md](references/ci-integration.md) |
| Routing eval cases — positive/negative/edge prompts for routing verification | [references/eval-cases.md](references/eval-cases.md) |

### Templates

Production-ready configs with `{{placeholder}}` markers:

| Template | File |
|---|---|
| playwright.config.ts — retries, sharding, projects (Chromium/Firefox/WebKit), trace | [templates/playwright.config.ts.template](templates/playwright.config.ts.template) |
| auth.setup.ts — storageState login fixture boilerplate | [templates/auth.setup.ts.template](templates/auth.setup.ts.template) |

### Examples

End-to-end walkthroughs — complete flow, not just snippets:

| Scenario | File |
|---|---|
| Login fixture with storageState: setup project, fixture extension, multi-role | [examples/login-fixture.md](examples/login-fixture.md) |
| Page Object Model: class structure, locator encapsulation, composition | [examples/page-object-model.md](examples/page-object-model.md) |

**How to use**: open the specific file for your topic. Don't read all files — look up only what's relevant.
