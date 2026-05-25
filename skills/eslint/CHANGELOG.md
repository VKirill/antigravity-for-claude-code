# eslint skill — CHANGELOG

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and SemVer.

## [2.0.0] — 2026-05-16

### Changed

- Compressed SKILL.md Capabilities section into reference-pointer bullets (parity with `bullmq` exemplar)
- Rewrote `references/eval-cases.md` to v3 format: user-voice prompts + Expected behavior column + How-to-verify section
- Added `risk: medium-stakes` frontmatter — tooling affects code quality but doesn't crash runtime

## [1.0.0] — 2026-05-15

### Added

- Initial skill creation for ESLint 10 (`10.x`, tracking `10.2.x`)
- `SKILL.md` — Pattern 2 navigator with full capabilities, behavioral traits, constraints
- `references/REFERENCE.md` — decision map + CLI quick-lookup + supported file types
- `references/flat-config.md` — full flat config schema, `eslint.config.ts` patterns
- `references/recommended-rules.md` — `@eslint/js`, `typescript-eslint`, framework presets, severity tuning
- `references/typescript-eslint.md` — parser, `projectService`, type-aware rules, performance
- `references/framework-plugins.md` — React, Vue, Next.js, Nuxt, jsx-a11y, Astro, Storybook
- `references/prettier-coexistence.md` — `eslint-config-prettier` pattern, anti-pattern warning
- `references/migration-from-v8.md` — step-by-step `.eslintrc.*` → flat config
- `references/ci-integration.md` — GitHub Actions, caching, SARIF, lint-staged, lefthook
- `references/editor-integration.md` — VS Code, JetBrains, Neovim, Zed
- `references/eval-cases.md` — routing tests (10 positive, 10 negative, 5 edge)
- `templates/eslint.config.react.ts.template` — TS strict + React + Prettier coexistence
- `templates/eslint.config.node.ts.template` — Node.js backend (no React)
- `templates/package.json.scripts.json` — lint/format/CI scripts + lint-staged
- `examples/migrate-eslintrc-to-flat.md` — full end-to-end migration walkthrough
- Version block placeholder; register in `sync_skill_versions.py` as `["ESLint", "TypeScript"]`
