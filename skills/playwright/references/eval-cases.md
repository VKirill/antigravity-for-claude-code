# playwright — Eval Cases

v3 format: **user-voice phrasing** + **Expected behavior** column (which sub-files / templates should load, not just "skill activates").

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "тест на логин падает на CI, локально проходит" | Load `ci-integration.md` + `fixtures-and-auth.md`; flag `storageState` not committed/regenerated per CI run; suggest `retries: 2` + trace upload |
| "getByRole для кнопки 'Submit'" | Load `locators.md`; cite `getByRole('button', { name: /submit/i })` priority + accessible-name strategy |
| "storageState чтобы не логиниться на каждый тест" | Load `fixtures-and-auth.md` + `templates/auth.setup.ts.template`; cite setup-project dependency pattern |
| "playwright тест периодически flaky на анимациях" | Load `locators.md` web-first-assertions section; flag `waitForTimeout` anti-pattern; recommend `toBeVisible()` retry behaviour |
| "mock /api/users с фейковыми данными" | Load `network-mocking.md`; cite `page.route(url, route => route.fulfill({ json }))` + scope-narrow URL glob |
| "shard tests across 4 GH Actions jobs" | Load `parallel-sharding.md` + `ci-integration.md`; cite `--shard=1/4` matrix + `merge-reports` |
| "visual regression baseline что в git хранить" | Load `visual-regression.md`; cite `toHaveScreenshot('name.png')` baseline commit pattern + per-OS suffixes |
| "POM page object для длинной spec" | Cite `examples/page-object-model.md`; class+locator-encapsulation pattern |
| "playwright codegen для нового теста" | Reference SKILL.md Debugging bullet; flag: replace generated CSS selectors with semantic locators |
| "HAR record-and-replay для off-network тестов" | Load `network-mocking.md`; cite `routeFromHAR(path, { update: true })` recording → remove `update` to replay |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "vitest snapshot mismatch" | `vitest` | Unit test runner |
| "Jest setup для React Testing Library" | `vitest` / `react` | Unit/component test, not E2E |
| "Cypress migration to playwright" | (no skill — redirect inline) | Migration meta, no specific Playwright task |
| "Puppeteer scrape PDF" | (no skill) | Scraping, not testing |
| "supertest API contract тест" | `vitest` | Node-only API test |
| "Selenium WebDriver Java" | (no skill) | Different runtime |
| "Android Espresso test" | (no skill) | Mobile-native |
| "react component unit test useReducer" | `vitest` | Unit testing |
| "k6 load test scenarios" | (no skill) | Load testing, not E2E |
| "Storybook test runner" | (no skill — niche) | Storybook-specific |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "component testing playwright или vitest browser-mode" | **playwright** primary if real-browser CSS/canvas needed; **vitest** primary for unit-level component logic. Surface tradeoff from SKILL.md Component testing bullet. |
| "Playwright + Next.js App Router тесты" | **playwright** primary (`fixtures-and-auth.md` for server-action auth) + `nextjs` cross-link. Note: spin Next dev server in `webServer` config block. |
| "video record вместо trace" | **playwright** primary; flag both supported (`use.video = 'retain-on-failure'`); trace is preferred for debugging because it includes DOM snapshots. |
| "Playwright fixtures для базы данных перед тестом" | **playwright** primary (`fixtures-and-auth.md` test.extend) + `postgresql`/`prisma` cross-link for DB cleanup. Pattern: fixture seeds + tears down per worker. |
| "сравни playwright и cypress" | Ambiguous; surface key tradeoffs from SKILL.md Purpose (cross-browser, web-first auto-wait). Cypress not in scope. |

## How to verify (manual)

1. Open a fresh session with this skill in `~/.claude/skills/playwright/`.
2. Paste each Positive prompt → confirm:
   - The system reminder lists `playwright` as an active skill
   - The response references files matching the "Expected behavior" column
3. Paste each Negative prompt → confirm `playwright` does NOT appear in the routed skill response, and the suggested fallback skill is mentioned.
4. Edge cases: confirm response surfaces cross-link explicitly ("primary: playwright, see also: vitest/nextjs/prisma").

If a prompt routes wrong:
- Negative becoming Positive → tighten the `description` SKIP rules
- Positive becoming Negative → add the missing trigger term to `description`
- Edge routing only to one skill → enrich Related Skills cross-links

Run after any change to `SKILL.md` description or major reference restructure.
