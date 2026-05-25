---
name: nextjs
description: "Next.js 16 App Router — Server Components, Server Actions, 'use cache', PPR, Turbopack, async params/cookies/headers. Use when: nextjs, next.js, app router, RSC, server actions, 'use cache', cacheLife, cacheTag, PPR, Turbopack, proxy.ts, middleware, generateMetadata, generateStaticParams, parallel routes, intercepting routes, route handlers, next/image, next/dynamic. SKIP: React without Next (→react), Vercel deploy (→vercel)."
stacks:
  - nextjs
  - frontend
packages:
  - next
  - react
  - react-dom
  - "@types/react"
  - "@types/react-dom"
  - "@next/bundle-analyzer"
  - sharp
  - zod
tags:
  - nextjs
  - react
  - app-router
  - server-components
  - server-actions
  - typescript
  - frontend
source: generated-zero-baseline
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Next.js: `16.x`
- React: `19.x`
- TypeScript: `6.0.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need, then follow the link to the relevant reference file.

## Use this skill when

- Building Next.js App Router apps with Server Components, Server Actions, route handlers
- Migrating Next 14/15 → 16 (async Dynamic APIs, `'use cache'`, `proxy.ts`)
- Implementing `'use cache'` with `cacheLife` / `cacheTag` (replaces `fetch` cache options + `unstable_cache`)
- Setting up PPR (`experimental_ppr` or stable)
- Parallel routes (`@slot`), intercepting routes (`(.)`, `(..)`)
- `generateMetadata`, OG images, sitemap, robots
- Server Actions with `useActionState` + Zod
- Turbopack config (default bundler in 16)
- Streaming with Suspense + skeletons
- `proxy.ts` middleware (rewrites, redirects, edge auth)
- `error.tsx`, `not-found.tsx`, `forbidden.tsx`, `unauthorized.tsx`

## Do not use this skill when

- Pure React without Next.js (hooks, component trees) → `react`
- Vercel deploy config (Edge Config, KV, Blob) → `vercel`
- TS type-system design → `typescript`
- shadcn/ui setup without App Router context → `shadcn`
- Remix, SvelteKit, Nuxt, Astro → their dedicated skills
- Tailwind config / design tokens → `tailwind`
- Client-only TanStack Query SPA → `tanstack-query`

## Purpose

Next.js 16 is the dominant React meta-framework. App Router is the only first-class architecture since 15. Version 16 completes the transition: async Dynamic APIs (`params`, `searchParams`, `cookies`, `headers` are Promises), `'use cache'` replaces the old `fetch` cache API, Turbopack is the default bundler, PPR stabilizes.

This skill covers file conventions, data fetching with the cache directive, rendering modes, Server Actions, middleware, error boundaries, and 15→16 migration. Hands off to `react` for component internals, `vercel` for deploy, `shadcn`/`tailwind` for design.

## Capabilities

Each line below points to the canonical reference. The reference owns code, edge cases, and gotchas — do not duplicate them here.

- **File conventions & routing** — `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts`, `template.tsx`, `default.tsx`, parallel/intercepting routes, `generateStaticParams`. → [references/routing.md](references/routing.md)
- **Async Dynamic APIs** — `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` are Promises in Next 16. → [references/routing.md](references/routing.md) Dynamic APIs section
- **Caching with `'use cache'`** — directive on function/module; `cacheLife('hours')`, `cacheTag(\`product-${id}\`)`, `revalidateTag`. Replaces `unstable_cache` and `fetch` cache options. → [references/caching.md](references/caching.md)
- **Server vs Client Components** — start RSC, add `'use client'` only for hooks/events; composition rules. → [references/rendering.md](references/rendering.md)
- **PPR (Partial Prerendering)** — `experimental_ppr` per-route or globally; Suspense boundaries determine static shell vs dynamic holes. → [references/rendering.md](references/rendering.md)
- **Server Actions + forms** — `'use server'`, `useActionState`, Zod `safeParse`, `revalidateTag`, `redirect`. → [examples/server-action-with-form.md](examples/server-action-with-form.md)
- **Streaming with Suspense** — `loading.tsx` auto-wraps; nest Suspense for finer control. → [examples/streaming-page.md](examples/streaming-page.md)
- **Metadata & SEO** — `generateMetadata` (async), OG images via `ImageResponse`, sitemap, robots. → [references/metadata-and-seo.md](references/metadata-and-seo.md)
- **Middleware (`proxy.ts`)** — file renamed from `middleware.ts` in Next 16; Edge runtime; `matcher` required. → [references/middleware.md](references/middleware.md)
- **Error boundaries** — `error.tsx` (CC), `not-found.tsx`, `forbidden.tsx`, `unauthorized.tsx` (Next 16+). → [references/error-handling.md](references/error-handling.md)
- **Turbopack** — default in 16; no webpack loaders; `--no-turbopack` to fall back. → [references/performance.md](references/performance.md)
- **Recommended defaults** — `cacheLife` profiles, `experimental` config, image loader, Server Action `bodySizeLimit`. → [references/recommended-defaults.md](references/recommended-defaults.md)
- **Troubleshooting** — `'use cache'` not invalidating, Server Action 413, middleware doesn't run, hydration mismatch, PPR debugging. → [references/troubleshooting.md](references/troubleshooting.md)
- **Wrong vs right** — sync vs async `cookies()`, `cache: 'no-store'` vs `dynamic = 'force-dynamic'`, raw fetch POST vs Server Action validation. → [references/wrong-vs-right.md](references/wrong-vs-right.md)

## Behavioral Traits

- Starts every component as Server Component; adds `'use client'` only for hooks/events
- Awaits `params`, `searchParams`, `cookies()`, `headers()` — never sync access
- Uses `'use cache'` + `cacheTag`/`cacheLife` instead of `fetch` cache options or `unstable_cache`
- Scopes `<Suspense>` at the smallest meaningful unit — never wraps the whole page
- Pairs Server Actions with `useActionState` + Zod — no raw `fetch` POST from Client Components
- Names the middleware file `proxy.ts` in Next 16
- Uses `generateMetadata` (async) for dynamic; `export const metadata` for static — never both in the same file
- Calls `revalidateTag` from Server Actions or route handlers, not Client Components
- Places `'use cache'` functions in dedicated `lib/` or `data/` files
- Always sets `alt` on `next/image`; provides `width`+`height` or `fill`+`sizes`

## Important Constraints

- NEVER access `params.id` synchronously — `params` is a Promise; `await` first
- NEVER call `cookies()` / `headers()` synchronously — both Promises in Next 16
- NEVER import a Server Component inside a Client Component — breaks RSC boundary
- NEVER mix `'use server'` and non-action exports in the same file — colocate in `actions.ts`
- NEVER substitute `revalidatePath` for `revalidateTag` when a tag exists — tag-based is precise
- NEVER pass secrets to Client Components via props from Server Components
- NEVER ship `proxy.ts` without `matcher` — middleware then runs on every request including static assets
- ALWAYS handle `isPending` in `useActionState` — disable submit to prevent duplicate submissions
- ALWAYS use `notFound()` / `forbidden()` / `unauthorized()` from `next/navigation` — they throw correctly
- ALWAYS type `generateMetadata` as `Promise<Metadata>`

## Related Skills

✓ marks **active** skills; unmarked are **cascade markers** (generate via `skill-evaluation` on first real touch).

### Language & React layer
- ✓ `typescript` — TS 5.9
- ✓ `react` — React 19 component patterns

### Styling
- ✓ `tailwind` — Tailwind CSS 4
- ✓ `shadcn` — shadcn/ui

### Data fetching / forms
- ✓ `tanstack-query` — Client-side cache for CSR islands
- ✓ `react-hook-form` — When `useActionState` is insufficient
- ✓ `zod` — Schema validation in Server Actions and route handlers

### Testing & runtime
- ✓ `vitest` — Unit + integration
- ✓ `playwright` — E2E
- ✓ `nodejs` — Node 24 runtime

### Deploy
- `vercel` — Primary Next.js deploy target [cascade marker]
- ✓ `linux-sysadmin` — PM2 + Ubuntu deploy

## API Reference

| Topic | File |
|---|---|
| Index + decision map, file conventions, segment config | [references/REFERENCE.md](references/REFERENCE.md) |
| File conventions, dynamic/parallel/intercepting routes, async params | [references/routing.md](references/routing.md) |
| `'use cache'`, cacheLife, cacheTag, custom profiles, revalidation | [references/caching.md](references/caching.md) |
| RSC vs Client Components, PPR, streaming, Suspense | [references/rendering.md](references/rendering.md) |
| generateMetadata, OpenGraph images, sitemap, robots | [references/metadata-and-seo.md](references/metadata-and-seo.md) |
| proxy.ts middleware, matcher, Edge runtime | [references/middleware.md](references/middleware.md) |
| error.tsx, not-found.tsx, forbidden.tsx, unauthorized.tsx | [references/error-handling.md](references/error-handling.md) |
| Turbopack config, bundle analysis, next/image, next/dynamic | [references/performance.md](references/performance.md) |
| **Recommended defaults** — `cacheLife` profiles, image loader, Server Action limits | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Troubleshooting** — symptom-indexed: cache invalidation, 413, middleware skip, hydration, PPR | [references/troubleshooting.md](references/troubleshooting.md) |
| **Wrong vs right** — common anti-patterns with corrected version | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases | [references/eval-cases.md](references/eval-cases.md) |

### Templates

| Template | File |
|---|---|
| Server Component page: async params, `'use cache'`, generateMetadata, Suspense | [templates/page.tsx.template](templates/page.tsx.template) |
| Route Handler: GET + POST, async params, typed request/response | [templates/route-handler.ts.template](templates/route-handler.ts.template) |
| Middleware as proxy.ts: auth check, matcher | [templates/middleware.ts.template](templates/middleware.ts.template) |

### Examples

| Scenario | File |
|---|---|
| Server Action + form: useActionState + Zod + revalidateTag + optimistic update | [examples/server-action-with-form.md](examples/server-action-with-form.md) |
| Streaming page: Suspense + skeletons + PPR layout | [examples/streaming-page.md](examples/streaming-page.md) |

### Checklists

| Checklist | File |
|---|---|
| Migration Next 15 → 16: async APIs, proxy.ts, `'use cache'`, PPR stable | [checklists/migration-15-to-16.md](checklists/migration-15-to-16.md) |

**How to use**: open the specific file for the topic you need. Don't read all references — look up only what's relevant to the current task.
