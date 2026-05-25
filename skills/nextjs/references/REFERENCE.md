# nextjs — Reference Index

Quick decision map. Open only the file relevant to the current task.

## Decision map

| Situation | Open this file |
|---|---|
| What file goes where in `app/`? | [routing.md](routing.md) |
| How do parallel routes or intercepting routes work? | [routing.md](routing.md) |
| async params / cookies / headers failing | [routing.md](routing.md) — Dynamic APIs section |
| `'use cache'` setup, cacheLife, cacheTag, revalidation | [caching.md](caching.md) |
| When to use Server vs Client Component | [rendering.md](rendering.md) |
| PPR setup and Suspense placement | [rendering.md](rendering.md) |
| Streaming skeleton layout | [rendering.md](rendering.md) |
| `generateMetadata`, OpenGraph, sitemap | [metadata-and-seo.md](metadata-and-seo.md) |
| `proxy.ts` / middleware, auth redirect, header injection | [middleware.md](middleware.md) |
| Edge runtime constraints | [middleware.md](middleware.md) |
| `error.tsx`, `not-found.tsx`, `forbidden.tsx` | [error-handling.md](error-handling.md) |
| Turbopack config, bundle analysis | [performance.md](performance.md) |
| `next/image` optimization, `next/dynamic` | [performance.md](performance.md) |
| Skill routing regression tests | [eval-cases.md](eval-cases.md) |

## File index

| Topic | File | Scope |
|---|---|---|
| File conventions, route segments, async Dynamic APIs | [routing.md](routing.md) | App Router layout |
| `'use cache'`, profiles, tags, revalidation | [caching.md](caching.md) | Data layer |
| RSC vs CC, PPR, streaming, Suspense | [rendering.md](rendering.md) | Rendering model |
| Metadata API, OG images, sitemap, robots | [metadata-and-seo.md](metadata-and-seo.md) | SEO |
| proxy.ts middleware, matcher, Edge runtime | [middleware.md](middleware.md) | Edge layer |
| Error boundaries, not-found, forbidden | [error-handling.md](error-handling.md) | Error UX |
| Turbopack, images, dynamic imports, web vitals | [performance.md](performance.md) | Performance |
| Routing eval cases | [eval-cases.md](eval-cases.md) | Quality |

## Quick patterns

### Minimal Server Component page

```tsx
// app/products/[id]/page.tsx
import { getProduct } from '@/lib/data'

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = await getProduct(id)
  return <h1>{product.name}</h1>
}
```

### Minimal `'use cache'` data function

```ts
// lib/data.ts
'use cache'
import { cacheLife, cacheTag } from 'next/cache'

export async function getProduct(id: string) {
  cacheLife('hours')
  cacheTag(`product-${id}`)
  return db.products.findUnique({ where: { id } })
}
```

### Minimal Server Action

```ts
// app/products/actions.ts
'use server'
import { revalidateTag } from 'next/cache'

export async function updateProduct(id: string, formData: FormData) {
  await db.products.update({ where: { id }, data: { name: formData.get('name') as string } })
  revalidateTag(`product-${id}`)
}
```

### Minimal proxy.ts middleware

```ts
// proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  if (!request.cookies.get('token')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

export const config = { matcher: ['/dashboard/:path*'] }
```
