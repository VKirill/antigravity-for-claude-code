# Astro 6.x Reference Index

> Astro 6.x (May 2026). Verified against https://docs.astro.build · https://astro.build/blog/astro-630/

## Quick navigation

| When you need... | Read |
|---|---|
| Pick framework + project structure | This file (sections below) |
| Decide what becomes interactive | [islands-architecture.md](./islands-architecture.md) |
| URL structure, dynamic segments, API routes | [routing.md](./routing.md) |
| Type-safe content with Zod schemas | [content-collections.md](./content-collections.md) |
| Mix static + per-component SSR | [server-islands-and-actions.md](./server-islands-and-actions.md) |
| SPA-like navigation without an SPA | [view-transitions.md](./view-transitions.md) |
| Add React/Vue/Svelte/Tailwind/MDX | [integrations.md](./integrations.md) |
| Deploy to Vercel/Cloudflare/Netlify/Node | [deploy-adapters.md](./deploy-adapters.md) |
| Hit 100 Lighthouse | [performance.md](./performance.md) |

## What's new in Astro 6.x

- **Server Islands** — `server:defer` directive renders a component on-request inside an otherwise-static page; streams in after shell load.
- **Astro Actions** — typed RPC + progressive-enhancement form integration via `src/actions/index.ts`.
- **Content Layer** — new content loader API (`loader: glob({...})`); replaces the legacy `src/content/` folder magic. Supports remote sources (CMS, APIs).
- **`<ClientRouter />`** — renamed from `<ViewTransitions />`. Provides client-side navigation with View Transitions API.
- **Sessions** — built-in cookie-based session storage on SSR-mode sites.
- **Better TS support** — `astro:content`, `astro:actions`, `astro:env` modules with auto-generated types.
- **Vite 7** baseline (Astro 6.3+).

## Project anatomy

```
my-astro-site/
├── astro.config.mjs       # config + integrations + adapter
├── src/
│   ├── pages/             # file-based routes (.astro / .md / .mdx / endpoints)
│   ├── layouts/           # shared shell components
│   ├── components/        # reusable components (.astro or framework files)
│   ├── content.config.ts  # Content Layer collections (Zod schemas)
│   ├── actions/index.ts   # Astro Actions
│   ├── styles/            # global CSS / Tailwind entry
│   ├── env.d.ts           # ambient types
│   └── middleware.ts      # request middleware (SSR)
├── public/                # static assets (no processing)
└── package.json
```

## Minimal `astro.config.mjs`

```js
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://example.com',
  output: 'static',                 // 'static' | 'server' | 'hybrid'
  integrations: [react(), sitemap()],
  prefetch: { defaultStrategy: 'hover' },
})
```

## Build & dev commands

```bash
npm create astro@latest             # new project
npm run dev                          # http://localhost:4321
npm run build                        # → dist/
npm run preview                      # serve built dist/
astro add react vue tailwind         # add integrations
astro check                          # type-check
astro sync                           # regenerate astro:content / astro:env types
```

## Decision map

```
What kind of site?
├── Marketing / landing / blog / docs
│   └── output: 'static', deploy as CDN
├── Personalized regions in a static page
│   └── output: 'hybrid' + Server Islands (server:defer)
├── Auth-gated app shell
│   └── output: 'server' + Node/Vercel/Cloudflare adapter
└── Full SPA with rich client state
    └── Use Next.js 16 or Nuxt 4 — not Astro

What framework for islands?
├── Already-React codebase → @astrojs/react
├── Vue ecosystem → @astrojs/vue
├── Svelte 5 → @astrojs/svelte
├── No interactivity needed → just .astro components
└── Multiple — yes, mix freely
```
