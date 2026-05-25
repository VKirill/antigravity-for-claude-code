# tailwind — CHANGELOG

All notable changes to this skill follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and SemVer.

## [2.0.0] — 2026-05-16

### Changed
- Compressed `SKILL.md` Capabilities into reference-pointer bullets (parity with `bullmq` exemplar) — 265 → ~165 lines
- Rewrote `references/eval-cases.md` to v3 format: user-voice prompts + Expected behavior + How-to-verify
- Added `risk: medium-stakes` frontmatter — styling layer affects UX but doesn't crash runtime

### Fixed
- Tailwind 4 dark-mode directive: `@variant dark (&:is(.dark *))` → `@custom-variant dark (&:where(.dark, .dark *))` across `references/REFERENCE.md`, `migration-3-to-4.md`, `variants.md`. v4 uses `@custom-variant` to register new variants; `@variant` applies an existing variant inside custom CSS.

## [1.0.0] — 2026-05-15

### Added
- Initial release — Tailwind CSS 4.3 full coverage
- `SKILL.md` — navigator with full Pattern 2 structure
- `references/REFERENCE.md` — decision map + quick-lookup table
- `references/config-css-first.md` — CSS-first config, Vite plugin, PostCSS, @source, @apply
- `references/theme-and-tokens.md` — oklch color scale, semantic tokens, @tailwindcss/typography
- `references/variants.md` — has-*, not-*, starting:, in-*, @utility, @variant, arbitrary variants
- `references/container-queries.md` — @container, named containers, units, style queries, patterns
- `references/integration-with-react.md` — cn() helper, CVA, shadcn/ui, class composition patterns
- `references/migration-3-to-4.md` — full breaking changes list, step-by-step upgrade path, gotchas
- `references/eval-cases.md` — routing test prompts (positive/negative/edge)
- `templates/globals.css` — production-ready CSS with oklch brand palette + semantic tokens
- `templates/postcss.config.mjs` — legacy PostCSS config template
- `examples/dark-mode-setup.md` — class strategy vs media strategy, flash prevention
- `examples/component-with-cn.md` — cn() + CVA + container queries component patterns
- Version block registered in `sync_skill_versions.py` under `"tailwind": ["Tailwind CSS"]`
