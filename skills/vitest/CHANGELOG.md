# vitest skill — CHANGELOG

All notable changes to this skill follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and SemVer.

## [2.0.0] — 2026-05-16

### Changed
- Rewrote `references/eval-cases.md` to v3 format: user-voice prompts + Expected behavior + How-to-verify
- Added `risk: medium-stakes` frontmatter — test infra affects release confidence but doesn't crash runtime

### Fixed
- API Reference table: corrected template paths `templates/vitest.config.ts` / `templates/test-setup.ts` → `*.template` (matches actual filenames on disk)

## [1.0.0] — 2026-05-15

### Added

- `SKILL.md` — full Pattern 2 navigator (250 lines) with Vitest 4 scope
- `references/REFERENCE.md` — decision map + quick-lookup tables
- `references/config.md` — full `vitest.config.ts` API (environment, pool, setupFiles, globalSetup, reporters, typecheck)
- `references/mocking.md` — `vi.mock`, `vi.fn`, `vi.spyOn`, hoisting rules, `vi.mocked`, v4 spy isolation change
- `references/snapshots.md` — file vs inline snapshots, v2 format, update workflow, custom serializers
- `references/projects-api.md` — `workspace` → `projects` rename, inline/glob/mixed project configs, coverage across projects
- `references/browser-mode.md` — `@vitest/browser`, Playwright provider, `page` fixture, browser vs E2E distinction
- `references/coverage.md` — v8 vs istanbul providers, thresholds, `perFile`, `all`, CI integration
- `references/migration-3-to-4.md` — step-by-step v3 → v4 migration guide with all breaking changes
- `references/eval-cases.md` — routing tests: positive, negative, and edge cases
- `templates/vitest.config.ts` — production preset with `{{placeholder}}` markers
- `templates/test-setup.ts` — `setupFiles` template with spy restore, env vars, custom matchers
- `examples/factory-pattern.md` — typed data factories with overrides, sequential IDs, Zod-powered variant
- `examples/db-test-fixture.md` — three DB isolation patterns: transaction rollback, schema-per-test, SQLite in-memory
- `checklists/test-stability.md` — flake reduction checklist: timers, mocks, async, snapshots, DB, CI
- Version block wired into `sync_skill_versions.py` → `vitest: ['Vitest', 'TypeScript']`
