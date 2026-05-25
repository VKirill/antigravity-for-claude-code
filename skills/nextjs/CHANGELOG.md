# nextjs — CHANGELOG

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and SemVer.

## [Unreleased]

## [2.0.0] — 2026-05-16

### Changed

- **BREAKING (org-internal)**: SKILL.md compressed from 334 → ~185 lines per v3 standard (Pattern 2 — references own code/edge cases)
- `references/eval-cases.md` migrated to v3 format: user-voice prompts + Expected behavior column + How to verify section (10/10/5)
- Added `risk: medium-stakes` frontmatter

### Added

- `references/recommended-defaults.md` — canonical `next.config.ts`, `cacheLife` profiles, Server Action `bodySizeLimit`, image loader, PPR rollout phases
- `references/troubleshooting.md` — symptom-indexed: `'use cache'` not invalidating, Server Action 413, proxy.ts skipped, hydration mismatch, PPR debugging, async cookies TS error, `generateMetadata` runs twice
- `references/wrong-vs-right.md` — sync vs async `cookies()`, `cache: 'no-store'` vs `dynamic` segment, raw fetch vs Server Action + Zod, Suspense scoping, `revalidatePath` vs `revalidateTag`, Client fetch vs `useActionState`

## [1.0.0] — 2026-05-15

### Added

- Initial zero-baseline generation for Next.js 16 App Router
- `SKILL.md` — navigator with full capabilities for App Router, async Dynamic APIs, `'use cache'`, PPR, Server Actions, middleware as `proxy.ts`, error boundaries, Turbopack
- `references/REFERENCE.md` — decision map + quick patterns
- `references/routing.md` — file conventions, dynamic routes, parallel/intercepting routes, async params, Route Handlers
- `references/caching.md` — `'use cache'` directive, cacheLife profiles, cacheTag, revalidation, migration from Next.js 15 cache API
- `references/rendering.md` — RSC vs Client Components, PPR, streaming with Suspense, `use()` hook, rendering modes
- `references/metadata-and-seo.md` — `generateMetadata`, OpenGraph image routes, sitemap, robots.txt, JSON-LD
- `references/middleware.md` — `proxy.ts` conventions, auth redirect, JWT validation at Edge, matcher patterns, Edge runtime constraints
- `references/error-handling.md` — error.tsx, global-error.tsx, not-found.tsx, forbidden.tsx, unauthorized.tsx, Server Action error patterns
- `references/performance.md` — Turbopack, `next/image`, `next/dynamic`, bundle analysis, Core Web Vitals, `next/font`, `next/script`
- `references/eval-cases.md` — 12 positive, 10 negative, 6 edge cases for routing regression testing
- `templates/page.tsx` — production Server Component page template with async params, generateMetadata, Suspense
- `templates/route-handler.ts` — GET/PATCH/DELETE route handler template with Zod + revalidateTag
- `templates/middleware.ts` — `proxy.ts` template with auth redirect and JWT validation stubs
- `examples/server-action-with-form.md` — complete useActionState + Zod + revalidateTag + optimistic update flow
- `examples/streaming-page.md` — PPR + multiple Suspense boundaries + skeleton components
- `checklists/migration-15-to-16.md` — step-by-step upgrade guide covering async APIs, proxy.ts, `'use cache'`, PPR, Turbopack
- Version block managed by `sync_skill_versions.py` (stacks: Next.js 16.x, React 19.x, TypeScript 5.9.x)
