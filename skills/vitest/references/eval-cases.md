# vitest — Eval Cases

v3 format: **user-voice phrasing** + **Expected behavior** column (which sub-files / templates should load, not just "skill activates").

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "Vitest 4 setup в виде проекте" | Load `config.md` + `templates/vitest.config.ts.template`; cite environment + pool + globals defaults |
| "vi.mock на дефолтный export модуля" | Load `mocking.md`; cite hoisting + factory pattern with `vi.importActual` for partial mock |
| "snapshot обновить после рефактора" | Load `snapshots.md`; cite `vitest --update-snapshots` / `u` key in watch mode + snapshot v2 changes |
| "монорепо: разные тестовые проекты для пакетов" | Load `projects-api.md`; cite `test.projects: [...]` (NOT old `workspace`), renamed in v3.2 |
| "browser mode chromium через @vitest/browser" | Load `browser-mode.md`; cite `provider: 'playwright'`, `import from 'vitest/browser'` |
| "coverage v8 vs istanbul, что выбрать" | Load `coverage.md`; cite tradeoff (v8 fast/branches less accurate, istanbul slow/accurate) + `perFile` threshold |
| "Vitest 3 → 4 апгрейд, что сломается" | Load `migration-3-to-4.md`; flag `workspace`→`projects` (renamed v3.2, old key removed v4), pool flatten, spy isolation, snapshot v2 |
| "vi.useFakeTimers и тесты после ломаются" | Cite SKILL.md Constraints (always `vi.useRealTimers()` in `afterEach`); load `mocking.md` |
| "tests pass locally fail CI" | Load `config.md` + `checklists/test-stability.md`; flag isolate/pool/CI single-fork patterns |
| "глобал setup vs setupFiles в чём разница" | Cite SKILL.md Constraints + `config.md`; flag `globalSetup` once per worker, `setupFiles` per test file |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "playwright e2e login flow" | `playwright` | E2E browser automation |
| "node:test runner без vite" | `nodejs` | Native runner, no Vitest |
| "jest.config.js setup" | (no skill — Jest docs) | Different runner |
| "Cypress component test" | `playwright` / (no skill) | Different stack |
| "Vitest UI design (как кнопка должна выглядеть)" | `tailwind` / `react` | UI design, not testing |
| "Github Actions matrix для тестов" | (no skill — github-actions cascade) | CI orchestration, not Vitest |
| "supertest API contract" | `nodejs` / `vitest` (if vitest-driven) | API tests usually fine in vitest, but supertest itself is library-specific |
| "Storybook addon-interactions" | (no skill) | Storybook |
| "Mocha + Chai legacy" | (no skill) | Different runner |
| "Karma config" | (no skill) | Legacy |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "vitest browser mode или playwright CT" | **vitest** primary if unit-level component with browser APIs; **playwright** primary for full E2E. Surface tradeoff from `browser-mode.md`. |
| "тестировать Next.js Server Action" | **vitest** primary (`config.md` environment `node`) + `nextjs` cross-link. Note: most server-action tests are integration, mock the DB layer. |
| "Vitest + Prisma transaction-per-test" | **vitest** primary (`examples/db-test-fixture.md`) + `prisma` cross-link. Wrap each test in a transaction, rollback in `afterEach`. |
| "shared fixture между projects" | **vitest** primary (`projects-api.md`); use `globalSetup` at root config or shared `setupFiles` per project. |
| "сравни vitest и jest" | Ambiguous; surface key tradeoffs from SKILL.md Purpose (Vite-native HMR, ESM-first). Jest not in scope. |

## How to verify (manual)

1. Open a fresh session with this skill in `~/.claude/skills/vitest/`.
2. Paste each Positive prompt → confirm:
   - The system reminder lists `vitest` as an active skill
   - The response references files matching the "Expected behavior" column
3. Paste each Negative prompt → confirm `vitest` does NOT appear in the routed skill response, and the suggested fallback skill is mentioned.
4. Edge cases: confirm response surfaces cross-link explicitly ("primary: vitest, see also: playwright/nextjs/prisma").

If a prompt routes wrong:
- Negative becoming Positive → tighten the `description` SKIP rules
- Positive becoming Negative → add the missing trigger term to `description`
- Edge routing only to one skill → enrich Related Skills cross-links

Run after any change to `SKILL.md` description or major reference restructure.
