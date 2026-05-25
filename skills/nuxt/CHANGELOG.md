# nuxt — CHANGELOG

All notable changes to this skill follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and SemVer.

## [Unreleased]

## [2.0.0] — 2026-05-16

### Changed

- SKILL.md compressed 281 → ~170 lines per v3 standard (Pattern 2)
- `references/eval-cases.md` migrated to v3 format: user-voice + Expected behavior + How to verify (10/10/5)
- Added `risk: medium-stakes` frontmatter

### Added

- `references/recommended-defaults.md` — `nuxt.config.ts` baseline, `routeRules` patterns, `runtimeConfig` pattern, Nitro preset selection
- `references/troubleshooting.md` — double-fetch, `useState` reset, server route 404, wrong Nitro preset, hydration mismatch, `deep: false` reactivity, duplicate keys, server-only config access

## [1.0.0] — 2026-05-15

### Added

- Initial release — Nuxt 4.4.x coverage with `app/` directory layout
- `SKILL.md` — navigator with all sections, version block, audit-compliant structure
- `references/REFERENCE.md` — decision map and quick-lookup tables
- `references/app-directory-layout.md` — full Nuxt 4 project structure, file routing, layouts, plugins
- `references/data-fetching.md` — `useAsyncData`, `useFetch`, `$fetch`, `createUseAsyncData`, dedupe/deep defaults
- `references/server-routes.md` — h3 handlers, method suffix, `useStorage`, server middleware, Zod validation
- `references/modules.md` — `nuxt.config.ts` anatomy, `runtimeConfig`, `routeRules`, Pinia/UI/Tailwind modules, layers
- `references/deployment.md` — Nitro presets (Node, Vercel, Netlify, Cloudflare, static), Docker, PM2
- `references/migration-3-to-4.md` — all breaking changes with before/after code, codemod notes
- `references/eval-cases.md` — positive, negative, and edge case routing tests
- `templates/nuxt.config.ts.template` — production config template with all sections commented
- `templates/server-api-route.ts.template` — h3 handler template with Zod validation
- `examples/typed-server-api.md` — end-to-end: Zod-validated POST + typed client composable + page component
- `examples/pinia-with-nuxt.md` — SSR-safe Pinia store, hydration patterns, auth middleware
- `examples/seo-with-useseometa.md` — `useSeoMeta`, `useHead`, JSON-LD, title template, reactive SEO
- `checklists/migration-3-to-4.md` — pre-flight + step-by-step + acceptance checklist
- Version block managed by `sync_skill_versions.py` (Nuxt 4.x, Vue 3.5.x, TypeScript 5.9.x)
