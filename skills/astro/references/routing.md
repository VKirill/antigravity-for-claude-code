# Routing

File-based routing in `src/pages/` — static pages, dynamic routes, API endpoints, middleware.

## File → URL mapping

| File | URL |
|---|---|
| `src/pages/index.astro` | `/` |
| `src/pages/about.astro` | `/about` |
| `src/pages/blog/index.astro` | `/blog` |
| `src/pages/blog/[slug].astro` | `/blog/:slug` |
| `src/pages/[lang]/blog/[slug].astro` | `/:lang/blog/:slug` |
| `src/pages/[...path].astro` | `/*` (rest/catch-all) |
| `src/pages/api/users/[id].ts` | `/api/users/:id` |

## Static dynamic routes — `getStaticPaths()`

Static builds (`output: 'static'`) require `getStaticPaths()` to enumerate every path:

```astro
---
// src/pages/blog/[slug].astro
import { getCollection } from 'astro:content'

export async function getStaticPaths() {
  const posts = await getCollection('blog')
  return posts.map((post) => ({
    params: { slug: post.id },
    props: { post },
  }))
}

const { post } = Astro.props
const { Content } = await post.render()
---
<article>
  <h1>{post.data.title}</h1>
  <Content />
</article>
```

`params` map to `[bracket]` segments; `props` are passed via `Astro.props`.

## SSR dynamic routes

In `output: 'server'` mode, drop `getStaticPaths()` and read params directly:

```astro
---
// src/pages/blog/[slug].astro (SSR mode)
const { slug } = Astro.params
const post = await fetchPost(slug)
if (!post) return Astro.redirect('/404')
---
```

## API endpoints

Files in `src/pages/api/` (or anywhere with `.ts`/`.js`) export HTTP method handlers:

```ts
// src/pages/api/users/[id].ts
import type { APIRoute } from 'astro'

export const GET: APIRoute = async ({ params, request }) => {
  const user = await db.users.findUnique({ where: { id: params.id } })
  return new Response(JSON.stringify(user), {
    headers: { 'content-type': 'application/json' },
  })
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json()
  // ...
  return new Response(null, { status: 201 })
}
```

In static mode, endpoints must be prerendered via `getStaticPaths()`. In server/hybrid mode they run per-request.

## Hybrid mode (per-page choice)

```js
// astro.config.mjs
export default defineConfig({ output: 'hybrid' })
```

```astro
---
// src/pages/dashboard.astro — SSR
export const prerender = false
---
```

Default is the inverse of `output`: in `'hybrid'` everything prerenders unless `prerender = false`; in `'server'` nothing prerenders unless `prerender = true`. (Confirm in docs — convention has flipped between releases.)

## Middleware

```ts
// src/middleware.ts
import { defineMiddleware } from 'astro:middleware'

export const onRequest = defineMiddleware(async (context, next) => {
  // context.cookies, context.request, context.url, context.locals
  context.locals.user = await authenticate(context.request)
  const response = await next()
  response.headers.set('x-served-by', 'astro')
  return response
})
```

Access via `Astro.locals.user` in any page. Chain multiple middlewares with `sequence()`:

```ts
import { sequence } from 'astro:middleware'
export const onRequest = sequence(auth, logging, csrf)
```

## Redirects (config)

```js
// astro.config.mjs
export default defineConfig({
  redirects: {
    '/old-blog/[slug]': '/blog/[slug]',
    '/team': { status: 301, destination: '/about/team' },
  },
})
```

Or programmatically in a page: `return Astro.redirect('/login', 302)`.

## Internationalization (i18n)

```js
// astro.config.mjs
export default defineConfig({
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ru', 'es'],
    routing: { prefixDefaultLocale: false },
  },
})
```

URL strategies:
- `prefixDefaultLocale: false` → `/about` (en), `/ru/about`, `/es/about`
- `prefixDefaultLocale: true` → `/en/about`, `/ru/about`, `/es/about`

Use `astro:i18n` helpers: `getRelativeLocaleUrl(locale, path)`, `getLocaleByPath()`.

## Common pitfalls

- Forgetting `getStaticPaths()` in static mode for dynamic routes → build fails
- Returning the wrong `params` keys (must match bracket segments exactly)
- Mixing `prerender = true/false` per page in `'static'` mode (only works with `'hybrid'`/`'server'`)
- Middleware fetching auth on every request without caching → slow SSR
- Forgetting `Astro.redirect()` returns a `Response` — you must `return` it
