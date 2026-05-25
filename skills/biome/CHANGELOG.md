# biome skill — CHANGELOG

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and SemVer.

## [2.0.0] — 2026-05-16

### Changed

- Compressed SKILL.md Capabilities section into reference-pointer bullets (parity with `bullmq` exemplar) — 256 → ~158 lines
- Rewrote `references/eval-cases.md` to v3 format: user-voice prompts + Expected behavior column + How-to-verify section
- Added `risk: medium-stakes` frontmatter — formatter/linter affects code quality but doesn't crash runtime

## [1.0.0] — 2026-05-15

### Added

- Initial skill creation for Biome 2 (`2.x`, tracking `2.4.x`)
- `SKILL.md` — Pattern 2 navigator with full capabilities, behavioral traits, constraints
- `references/REFERENCE.md` — decision map + quick-lookup CLI table + supported languages
- `references/configuration.md` — full `biome.json`/`biome.jsonc` option reference
- `references/lint-rules.md` — rule catalog by category with recommended set and stack configs
- `references/formatter.md` — formatter options, Prettier compatibility matrix, suppression
- `references/migration-from-eslint-prettier.md` — step-by-step migration with unmapped rules
- `references/ci-integration.md` — GitHub Actions, GitLab CI, lefthook, husky integration
- `references/eval-cases.md` — routing tests (positive/negative/edge cases)
- `templates/biome.json` — production preset (recommended rules + organize imports)
- `templates/biome.jsonc` — same with inline explanatory comments
- `templates/.vscode/settings.json` — Biome as default formatter + format-on-save
- `examples/migrate-from-eslint.md` — full migration walkthrough from ESLint + Prettier
- `checklists/biome-adoption.md` — pre-flight, migration, acceptance, team rollout checklist
- Version block registered in `sync_skill_versions.py` as `["Biome", "TypeScript"]`
