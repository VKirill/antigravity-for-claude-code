# nuxt — Reference Index

## Decision map

| Need | Open this file |
|---|---|
| Where does `pages/`, `components/`, `composables/` live in Nuxt 4? | [app-directory-layout.md](app-directory-layout.md) |
| How to fetch data (`useAsyncData` vs `useFetch` vs `$fetch`)? | [data-fetching.md](data-fetching.md) |
| Writing a server API route with h3 | [server-routes.md](server-routes.md) |
| `nuxt.config.ts` — modules, runtimeConfig, routeRules | [modules.md](modules.md) |
| Deploying to Vercel / Cloudflare / Node server | [deployment.md](deployment.md) |
| Moving from Nuxt 3 to Nuxt 4 | [migration-3-to-4.md](migration-3-to-4.md) |
| Testing skill routing (positive / negative prompts) | [eval-cases.md](eval-cases.md) |

## Quick-lookup: Nuxt 4 changed defaults

| Setting | Nuxt 3 default | Nuxt 4 default |
|---|---|---|
| `useAsyncData` `dedupe` | `'defer'` | `'cancel'` |
| `useAsyncData` `deep` | `true` | `false` |
| App code location | project root | `app/` directory |
| Key collision | warning | throws in dev |

## Quick-lookup: composable selection

| Composable | Best for | SSR dedup |
|---|---|---|
| `useFetch(url)` | URL-based fetch, shorthand | yes |
| `useAsyncData(key, fn)` | Custom async, full control | yes |
| `$fetch(url)` | Server handlers, fire-and-forget | no |
| `createUseAsyncData(defaults)` | Typed factory for repeated patterns | yes |

## Quick-lookup: server route file naming

| Pattern | URL | HTTP method |
|---|---|---|
| `server/api/users.get.ts` | `/api/users` | GET only |
| `server/api/users.post.ts` | `/api/users` | POST only |
| `server/api/users/[id].ts` | `/api/users/:id` | all methods |
| `server/api/users/[id].delete.ts` | `/api/users/:id` | DELETE only |
| `server/routes/sitemap.xml.ts` | `/sitemap.xml` | any |

## Quick-lookup: Nitro presets

| Target | `nitro.preset` value | Auto-detected |
|---|---|---|
| Node.js server | `'node-server'` | no (default) |
| Vercel | `'vercel'` | yes (if `VERCEL=1`) |
| Netlify | `'netlify'` | yes (if `NETLIFY=1`) |
| Cloudflare Pages | `'cloudflare-pages'` | no — set explicitly |
| Cloudflare Workers | `'cloudflare-module'` | no — set explicitly |
| Static / SSG | `'static'` | via `nuxt generate` |
