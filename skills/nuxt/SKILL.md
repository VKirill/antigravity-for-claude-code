---
name: nuxt
description: "Nuxt 4 Vue meta-framework — file routing, SSR/SSG, server routes, auto-imports. Use when: nuxt, nuxt 4, nuxt.config.ts, app/ directory, file-based routing, useAsyncData, useFetch, $fetch, definePageMeta, useState, useRuntimeConfig, server/api routes, server/middleware, h3, Nitro, defineEventHandler, useStorage, Nuxt UI, layers, modules. SKIP: pure Vue without Nuxt (→vue), Next.js (→nextjs)."
stacks:
  - frontend
  - vue
packages:
  - nuxt
  - h3
  - nitro
  - "@nuxt/ui"
  - "@pinia/nuxt"
  - "@nuxtjs/tailwindcss"
tags:
  - nuxt
  - vue
  - ssr
  - ssg
  - nitro
  - h3
  - server-routes
  - file-routing
source: generated-2026-05-15
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Nuxt: `4.x`
- Vue: `3.5.x`
- TypeScript: `6.0.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need.

## Use this skill when

- Building Nuxt 4 apps with the `app/` directory layout
- Fetching with `useAsyncData` (Nuxt 4 default `dedupe: 'cancel'`, `deep: false`), `useFetch`, `$fetch`
- Server routes (`server/api/*`, `server/routes/*`) with h3 `defineEventHandler`, `readBody`, `getQuery`
- Server middleware (`server/middleware/*`) for auth, logging, transforms
- SSR-safe state with `useState`; Pinia for cross-component
- `nuxt.config.ts` — `modules`, `runtimeConfig`, `routeRules`, hooks, Nitro presets
- `definePageMeta` for route metadata, auth guards, layouts, transitions
- Dynamic routes (`[id].vue`, `[...slug].vue`)
- SEO via `useHead`, `useSeoMeta`, `defineOgImage`
- Nitro deploy presets — Node, Vercel, Netlify, Cloudflare Pages/Workers
- Nuxt 3 → 4 migration (`app/` rename, dedupe/deep defaults)
- `createUseAsyncData` factory for typed composables
- Nuxt layers for shared config across apps

## Do not use this skill when

- Pure Vue 3 SPA, no SSR/file routing/server routes → `vue`
- Next.js (React meta-framework) → `nextjs`
- TS type-system design → `typescript`
- Astro (content-first, Islands) → `astro`
- Nitro standalone without Nuxt → `nodejs`

## Purpose

Nuxt 4 is the production Vue meta-framework. The Nuxt 4 release brings a structural change: app code moves into `app/` (`app/pages/`, `app/components/`, `app/layouts/`); `server/` stays at the project root. Behavioral changes: `useAsyncData` defaults to `dedupe: 'cancel'` (cancels in-flight on duplicate calls) and `deep: false` (shallow reactive data).

This skill covers file routing, data fetching, server routes with Nitro/h3, state management, SEO, modules, deployment presets, and 3 → 4 migration. Hands off to `vue` for pure Vue patterns and `typescript` for deep type-system work.

## Capabilities

- **`app/` directory layout** — `app/pages/`, `app/components/`, `app/composables/`, `app/layouts/`, `app/middleware/`, `app/plugins/`, `app/app.vue`; `server/` at root. → [references/app-directory-layout.md](references/app-directory-layout.md)
- **Data fetching** — `useAsyncData`, `useFetch`, `$fetch`, `createUseAsyncData` factory; Nuxt 4 defaults. → [references/data-fetching.md](references/data-fetching.md)
- **Server routes (Nitro / h3)** — `server/api/*`, method suffix on filename (`.get.ts`, `.post.ts`), `defineEventHandler`, `readBody`, `getQuery`, `getRouterParam`, `setResponseStatus`, `createError`, `sendRedirect`, `useStorage`. → [references/server-routes.md](references/server-routes.md)
- **Modules & config** — `nuxt.config.ts`, `modules`, `runtimeConfig` (private vs `public`), `routeRules`, hooks. → [references/modules.md](references/modules.md)
- **Deployment** — Nitro presets: `node-server`, `vercel`, `netlify`, `cloudflare-pages`, `cloudflare-module`, `static`. → [references/deployment.md](references/deployment.md)
- **Migration 3 → 4** — `app/` move, dedupe/deep defaults, stricter key dedup. → [references/migration-3-to-4.md](references/migration-3-to-4.md) | [checklists/migration-3-to-4.md](checklists/migration-3-to-4.md)
- **Recommended defaults** — `routeRules` patterns, `runtimeConfig` shape, Nitro preset selection. → [references/recommended-defaults.md](references/recommended-defaults.md)
- **Troubleshooting** — `useAsyncData` double-fetch, `useState` across SSR, server route 404, wrong Nitro preset, hydration mismatch. → [references/troubleshooting.md](references/troubleshooting.md)

## Behavioral Traits

- Verifies Nuxt version before answering — `app/` layout, `dedupe: 'cancel'`, `deep: false` are Nuxt 4 only
- Uses `useFetch` for simple URL fetching; `useAsyncData` when custom async logic is needed
- Uses `$fetch` inside `defineEventHandler` and event handlers — not reactive composables in those contexts
- Server routes always live in `server/api/` with method suffix (`.get.ts`, `.post.ts`)
- Validates env/config at startup via `runtimeConfig` + Zod — never raw `process.env` in app code
- `useState` for SSR-safe shared state; Pinia for complex cross-component state
- `definePageMeta({ middleware: 'auth' })` for guards, not inline checks
- Explicit `nitro.preset` for edge deploys — no reliance on CI auto-detection
- `useSeoMeta` for structured SEO (og, twitter, canonical)
- Never mutates `useAsyncData` `.data` directly — uses `refresh()` / `execute()`

## Important Constraints

- NEVER place `pages/`, `components/`, `composables/` at project root in Nuxt 4 — they belong under `app/`
- NEVER hardcode secrets in `runtimeConfig.public` — only in server-only `runtimeConfig`
- NEVER use duplicate `useAsyncData` keys across pages — Nuxt 4 dev mode throws
- NEVER mutate `.data` ref from `useAsyncData` / `useFetch` directly — use `refresh()`
- NEVER call `useAsyncData` / `useFetch` inside `defineEventHandler` — those are client/universal composables
- ALWAYS use method suffix (`.get.ts`, `.post.ts`) when restricting HTTP methods
- ALWAYS serialize `useStorage` data as JSON; binary needs separate handling
- ALWAYS set `nitro.preset` when CI auto-detection is unreliable

## Related Skills

✓ marks **active** skills; unmarked are **cascade markers**.

### Language & rendering
- ✓ `typescript` — TS 6.0
- ✓ `vue` — Vue 3.5 (component layer)

### Styling, validation, state
- ✓ `tailwind` — Tailwind CSS 4
- ✓ `zod` — Zod 4 (h3 + runtimeConfig validation)
- `pinia` — official Vue/Nuxt state [cascade]

### Testing, build, runtime
- ✓ `vitest` — Vitest 4
- ✓ `playwright` — Playwright 1.60
- ✓ `vite` — Vite 7 (underlying bundler; Nuxt 4 ships Vite 7 internally)
- ✓ `nodejs` — Node 24 (Nitro host)

### Deploy
- `vercel` — mainstream target [cascade]
- ✓ `linux-sysadmin` — PM2 + Node server preset

## API Reference

| Topic | File |
|---|---|
| Index + decision map, quick-lookup tables | [references/REFERENCE.md](references/REFERENCE.md) |
| `app/` directory layout, file naming, auto-imports | [references/app-directory-layout.md](references/app-directory-layout.md) |
| `useAsyncData`, `useFetch`, `$fetch`, factory, dedupe, deep | [references/data-fetching.md](references/data-fetching.md) |
| `server/api/*`, h3 handlers, `useStorage` | [references/server-routes.md](references/server-routes.md) |
| `nuxt.config.ts`, modules, `runtimeConfig`, `routeRules` | [references/modules.md](references/modules.md) |
| Nitro presets — Node, Vercel, Netlify, Cloudflare, static | [references/deployment.md](references/deployment.md) |
| Migration 3 → 4 — breaking changes, compatibility flags | [references/migration-3-to-4.md](references/migration-3-to-4.md) |
| **Recommended defaults** — routeRules, runtimeConfig shape, preset selection | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Troubleshooting** — double-fetch, SSR state, 404, hydration | [references/troubleshooting.md](references/troubleshooting.md) |
| Eval cases | [references/eval-cases.md](references/eval-cases.md) |

### Templates

| Template | File |
|---|---|
| `nuxt.config.ts` — modules, runtimeConfig, routeRules, Nitro preset | [templates/nuxt.config.ts.template](templates/nuxt.config.ts.template) |
| h3 server API route — typed handler with validation | [templates/server-api-route.ts.template](templates/server-api-route.ts.template) |

### Examples

| Scenario | File |
|---|---|
| Typed server API with h3 + Zod validation | [examples/typed-server-api.md](examples/typed-server-api.md) |
| Pinia store wired to Nuxt (SSR-safe, hydration) | [examples/pinia-with-nuxt.md](examples/pinia-with-nuxt.md) |
| SEO with `useSeoMeta` — og, twitter, canonical | [examples/seo-with-useseometa.md](examples/seo-with-useseometa.md) |

### Checklists

| Checklist | File |
|---|---|
| Nuxt 3 → 4 migration pre-flight and acceptance | [checklists/migration-3-to-4.md](checklists/migration-3-to-4.md) |

**How to use**: open the specific topic file. Don't read all references — look up only what's relevant.
