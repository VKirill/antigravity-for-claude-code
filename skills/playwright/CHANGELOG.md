# playwright — CHANGELOG

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and SemVer.

## [2.0.0] — 2026-05-16

### Changed
- Compressed `SKILL.md` Capabilities into reference-pointer bullets (parity with `bullmq` exemplar) — 238 → ~165 lines
- Rewrote `references/eval-cases.md` to v3 format: user-voice prompts + Expected behavior + How-to-verify
- Added `risk: medium-stakes` frontmatter — test infra affects release confidence but doesn't crash runtime

### Fixed
- API Reference table: corrected template paths `templates/playwright.config.ts` / `templates/auth.setup.ts` → `*.template` (matches actual filenames on disk)

## [1.0.0] — 2026-05-15

### Added

- SKILL.md — navigator with full capability descriptions, behavioral traits, constraints, related skills, API reference table
- `references/REFERENCE.md` — decision map, locator flowchart, assertion cheat sheet, config quick-lookup, anti-patterns
- `references/locators.md` — complete Locator API: getByRole/getByLabel/getByText/getByTestId, chaining, filter, actions, soft assertions, anti-patterns
- `references/fixtures-and-auth.md` — test.extend, built-in fixtures, storageState auth, multi-role auth, worker-scope fixtures, test.use()
- `references/parallel-sharding.md` — fullyParallel, serial describes, sharding, GitHub Actions matrix, worker isolation, parallelIndex
- `references/network-mocking.md` — page.route(), URL patterns, fulfill/abort/continue/modify, error simulation, HAR record/replay, context-level routing
- `references/visual-regression.md` — toHaveScreenshot, toMatchAriaSnapshot, tolerance options, masking, CI OS considerations, Docker baseline generation
- `references/ci-integration.md` — GitHub Actions (single + sharded), browser caching, Docker, env vars, webServer auto-start, pre-merge checks
- `references/eval-cases.md` — routing tests (positive, negative, edge, output behavior)
- `templates/playwright.config.ts` — production preset with retries, parallel, projects (5 browsers), storageState, trace
- `templates/auth.setup.ts` — storageState login fixture boilerplate
- `examples/login-fixture.md` — multi-role auth walkthrough: user + admin, setup projects, fixture extension, .gitignore
- `examples/page-object-model.md` — complete POM: BasePage, 4 page classes, fixture integration, test examples
- CHANGELOG.md (this file)
- Version block wired into sync_skill_versions.py (Playwright 1.60.x + TypeScript 5.9.x)
