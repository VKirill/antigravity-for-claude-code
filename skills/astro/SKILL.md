---
name: astro
description: "Build modern websites with Astro 6.x — Islands Architecture, zero-JS defaults, Server Islands, Actions, Content Layer, View Transitions. Use for static sites, content-heavy sites, marketing pages, blogs, documentation, e-commerce fronts. Trigger terms: astro, astro.build, .astro file, Islands Architecture, content collections, View Transitions, Server Islands, Astro Actions, astro:db, hybrid SSR/SSG."
stacks:
  - astro
tags:
  - astro
  - frontend
  - ssg
  - ssr
  - islands
source: vechkasov-global-skills
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Astro: `6.x`
- TypeScript: `6.0.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->


## Usage

Loaded automatically when its description matches the active task. The body below provides the working context.

## Use this skill when

- Building a static site, marketing landing page, blog, or documentation portal
- Need a content-heavy site with minimal JavaScript and excellent Lighthouse scores
- Mixing React + Vue + Svelte components in one project (Astro is framework-agnostic)
- Need Server Islands (per-component dynamic SSR within otherwise-static pages)
- Implementing Astro Actions (typed RPC + form integration)
- Setting up Content Collections with the new Content Layer API
- Adding View Transitions for SPA-like navigation

## Do not use this skill when

- The site is fundamentally an SPA with rich client-side state — use `vue-developer`, `react-best-practices`, or `nextjs-app-router-patterns`
- You need a full-stack framework with deep server primitives — Next.js 16 fits better
- The project is mobile-first React Native — use `react-native-architecture`

## Purpose

Astro is a content-focused web framework with an Islands Architecture: pages render to static HTML by default, and only **explicitly marked** interactive components ship JavaScript. The model inverts the SPA default: zero JS unless you opt in.

Astro 6.x adds Server Islands (component-level dynamic rendering inside static pages), Actions (typed server functions callable from client), Content Layer (pluggable content sources beyond local files), and refined View Transitions.

Each line below points to the canonical reference. The reference owns code, edge cases, and gotchas.

- **Islands Architecture** — `.astro` static by default. `client:load` / `client:idle` / `client:visible` / `client:media={query}` / `client:only={framework}` hydration directives. Default to `client:visible` below the fold. → [references/islands-architecture.md](references/islands-architecture.md)
- **File-based routing** — `src/pages/about.astro` → `/about`; dynamic `[param].astro` requires `getStaticPaths()`; API routes in `src/pages/api/` export `GET`/`POST` handlers. → [references/routing.md](references/routing.md)
- **Content Collections (Content Layer)** — `src/content/config.ts` defines collections via `defineCollection` + `loader` (glob, file, fetch, custom). Zod schemas from `astro/zod`. Query via `getCollection()` / `getEntry()` / `render()`. → [references/content-collections.md](references/content-collections.md) / [templates/content.config.ts.template](templates/content.config.ts.template)
- **Server Islands** — `server:defer` directive renders that component on-request inside a statically-cached page; streams in after static shell loads. → [references/server-islands-and-actions.md](references/server-islands-and-actions.md)
- **Actions** — `defineAction({ input: zodSchema, handler })` in `src/actions/index.ts`; call via `actions.myAction(input)` or progressively-enhanced `<form action={actions.subscribe}>`. → [references/server-islands-and-actions.md](references/server-islands-and-actions.md) / [examples/server-island-with-actions.md](examples/server-island-with-actions.md)
- **View Transitions** — `<ClientRouter />` in layout (renamed from `<ViewTransitions />`); `transition:name` + `transition:animate` per element. → [references/view-transitions.md](references/view-transitions.md)
- **Integrations** — `astro add` for `@astrojs/react`, `vue`, `svelte`, `solid-js`, `mdx`, `sitemap`, `rss`. Tailwind 4 via `@tailwindcss/vite` (NOT `@astrojs/tailwind` v3 integration). → [references/integrations.md](references/integrations.md)
- **Deploy adapters** — `output: 'static' | 'server'` + adapter (`@astrojs/node`, `vercel`, `cloudflare`, `netlify`). Per-page hybrid via `export const prerender = true/false`. → [references/deploy-adapters.md](references/deploy-adapters.md)
- **Performance** — defaults win Core Web Vitals; pitfalls: `client:load` overuse, framework components where `.astro` suffices, raw `<img>` instead of `<Image />`. → [references/performance.md](references/performance.md)

## Behavioral Traits

- Defaults to **zero JS** — adds `client:*` only when a component is truly interactive
- Prefers `.astro` components for static markup; framework components only when needed
- Uses `client:visible` for below-the-fold interactive components
- Treats Astro Actions as the default form-handling pattern
- Validates all content with Zod schemas in content collections
- Uses `<Image />` (not raw `<img>`) for automatic optimization
- Picks the right deploy adapter for the host (don't ship Node adapter to Cloudflare Pages)

## Important Constraints

- NEVER use `client:load` for below-the-fold components — wastes bandwidth and blocks main thread
- NEVER mix React/Vue/Svelte for the same UI region — pick one per island
- ALWAYS define content schemas with Zod — untyped collections defeat the type-safety value
- ALWAYS add `<ClientRouter />` once at the layout level (not per page)
- NEVER use Astro Actions for endpoints that need direct HTTP access by external clients — use `src/pages/api/` instead
- Astro DB (`@astrojs/db`) is sunset as a hosted service since 2025 — use it self-hosted with libsql/Turso or move to Prisma + Postgres

## Related Skills

✓ marks **active** skills; the rest are **cascade markers** — generate via `skill-evaluation` on first real touch.

- `frontend-architect` — generic frontend architecture patterns
- ✓ `react` — React 19 (used as an Astro island framework)
- ✓ `vue` — Vue 3.5 (used as an Astro island framework)
- ✓ `tailwind` — Tailwind CSS 4 (via `@astrojs/tailwind` integration)
- ✓ `typescript` — TS 6.0 (Astro is TS-first)
- ✓ `vite` — Vite 7 (Astro's underlying build tool; Astro 6.3+ ships Vite 7)
- `ui-designer` — design handoff for Astro pages
- `wordpress` — headless WP + Astro frontend

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Index + decision map | [references/REFERENCE.md](references/REFERENCE.md) |
| Islands Architecture (client directives, zero-JS rules, hydration strategies) | [references/islands-architecture.md](references/islands-architecture.md) |
| Routing (file-based, dynamic, getStaticPaths, API endpoints, middleware) | [references/routing.md](references/routing.md) |
| Content Collections (Content Layer API, Zod schemas, custom loaders, CMS) | [references/content-collections.md](references/content-collections.md) |
| Server Islands & Actions (server:defer, defineAction, form integration) | [references/server-islands-and-actions.md](references/server-islands-and-actions.md) |
| View Transitions (ClientRouter, transition:name, persist, navigation events) | [references/view-transitions.md](references/view-transitions.md) |
| Integrations (React/Vue/Svelte, MDX, Tailwind 4, RSS, sitemap, image) | [references/integrations.md](references/integrations.md) |
| Deploy adapters (Vercel, Netlify, Cloudflare, Node — config + caveats) | [references/deploy-adapters.md](references/deploy-adapters.md) |
| Performance (Lighthouse, Image optimization, prefetch, SSR caching) | [references/performance.md](references/performance.md) |
| Eval cases (routing tests) — positive/negative/edge prompts | [references/eval-cases.md](references/eval-cases.md) |

### Templates

Production-ready boilerplates — copy and adjust:

| Template | File |
|---|---|
| `astro.config.mjs` — Node/Vercel/Cloudflare adapter + Tailwind 4 + React + sitemap | [templates/astro.config.mjs.template](templates/astro.config.mjs.template) |
| `src/content.config.ts` — Content Layer config with glob loader + Zod schemas | [templates/content.config.ts.template](templates/content.config.ts.template) |

### Examples

End-to-end walkthroughs — complete flow, not just snippets:

| Scenario | File |
|---|---|
| Server Island + Action: personalized greeting deferred inside static page, with Action for form submission | [examples/server-island-with-actions.md](examples/server-island-with-actions.md) |

**How to use**: search or read the specific topic file before writing code. Don't read entire files — look up only what you need.
