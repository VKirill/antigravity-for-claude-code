# astro skill — CHANGELOG

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and SemVer.

## [2.0.0] — 2026-05-16

### Added (Pattern 2 retrofit)

- `CHANGELOG.md` (this file) — backfilled with v1.0.0 baseline + v2.0.0 retrofit
- `templates/astro.config.mjs.template` — production preset with adapter, `@tailwindcss/vite` integration, sitemap, image service
- `templates/content.config.ts.template` — Content Layer config with `glob` + `file` loaders, Zod schemas via `astro/zod`
- `examples/server-island-with-actions.md` — end-to-end: static page + `server:defer` greeting + Action form with `accept: 'form'` progressive enhancement
- `references/eval-cases.md` — routing tests in v3 format (10 positive / 10 negative / 5 edge) + How-to-verify section
- API Reference table extended with Templates + Examples + Eval cases rows

### Changed

- Compressed `SKILL.md` Capabilities section into reference-pointer bullets (parity with `bullmq` exemplar)
- Added `risk: medium-stakes` frontmatter — frontend framework affects UX/perf but doesn't crash runtime
- Content Collections path canonicalised: `src/content/config.ts` (Astro docs canonical) over `src/content.config.ts`
- Tailwind integration guidance: `@tailwindcss/vite` plugin (NOT legacy `@astrojs/tailwind` v3 integration)

### Fixed (hallucination audit, Context7-verified against `/withastro/astro/astro_6.3.1`)

- Zod import for Actions: `from 'astro:schema'` → `from 'astro/zod'` (framework-bundled re-export)
- View Transitions component name confirmed: `<ClientRouter />` (renamed from `<ViewTransitions />`)
- Server Islands directive confirmed: `server:defer`
- Action options confirmed: `defineAction({ accept: 'form', input, handler })` + `Astro.getActionResult` / `Astro.callAction`

## [1.0.0] — 2026-05-15

### Added

- Initial skill creation for Astro 6 (`6.x`)
- `SKILL.md` — Pattern 2 navigator with full capabilities, behavioral traits, constraints
- `references/REFERENCE.md` — index + decision map
- `references/islands-architecture.md` — `client:*` directives, hydration strategies, zero-JS defaults
- `references/routing.md` — file-based routing, dynamic routes, `getStaticPaths`, API endpoints
- `references/content-collections.md` — Content Layer API, Zod schemas, loaders, CMS sources
- `references/server-islands-and-actions.md` — `server:defer`, `defineAction`, form integration
- `references/view-transitions.md` — `<ClientRouter />`, `transition:name`, `transition:animate`
- `references/integrations.md` — framework integrations, MDX, Tailwind 4, RSS, sitemap, image
- `references/deploy-adapters.md` — Node, Vercel, Cloudflare, Netlify
- `references/performance.md` — Lighthouse, Image optimization, prefetch, SSR caching
- Version block registered for Astro 6.x + TypeScript 5.9.x
