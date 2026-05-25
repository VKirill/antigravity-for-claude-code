# Next.js 16 — Caching with `'use cache'`

## Overview

Next.js 16 introduces the `'use cache'` directive as the primary caching primitive, replacing:
- `fetch({ cache: 'force-cache' })` — use `'use cache'` on the data function instead
- `unstable_cache()` — replaced entirely
- `export const revalidate = N` on pages — still works but `cacheLife` inside data functions is preferred

`'use cache'` is a React directive (like `'use client'` and `'use server'`). It can appear at the top of a file (caches all exports) or at the top of a function body (caches just that function).

## Basic usage

```ts
// lib/data.ts
'use cache'
import { cacheLife } from 'next/cache'
import { cacheTag } from 'next/cache'

export async function getProducts() {
  cacheLife('hours')              // freshness TTL
  cacheTag('products')            // tag for revalidation
  return db.products.findMany()
}

export async function getProduct(id: string) {
  cacheLife('hours')
  cacheTag(`product-${id}`)
  return db.products.findUnique({ where: { id } })
}
```

## cacheLife profiles (built-in)

| Profile | `stale` | `revalidate` | `expire` | Best for |
|---|---|---|---|---|
| `seconds` | 0s | 1s | 60s | Rapidly changing data (stock price, presence) |
| `minutes` | 0s | 1m | 5m | Frequently updated UI (feed, notifications) |
| `hours` | 5m | 1h | 1d | Product catalog, blog posts |
| `days` | 1h | 1d | 7d | Static content with occasional updates |
| `weeks` | 1d | 7d | 30d | Rarely changing reference data |
| `max` | 1d | 7d | 1y | Truly static (country list, locale data) |

Values are `{ stale, revalidate, expire }` where:
- `stale` — serve from cache without revalidation for this duration
- `revalidate` — trigger background revalidation after this duration
- `expire` — hard TTL; entry is evicted after this

## Custom cacheLife profiles

Define in `next.config.ts`:

```ts
// next.config.ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  experimental: {
    cacheLife: {
      products: {
        stale: 300,        // 5 minutes
        revalidate: 3600,  // 1 hour
        expire: 86400,     // 1 day
      },
      user: {
        stale: 0,
        revalidate: 60,
        expire: 300,
      },
    },
  },
}

export default config
```

Use: `cacheLife('products')` in the function.

## cacheTag — targeted revalidation

Tags allow you to invalidate specific cache entries without flushing everything:

```ts
// lib/data.ts
'use cache'
import { cacheTag } from 'next/cache'

export async function getUserProfile(userId: string) {
  cacheTag(`user-${userId}`)
  cacheTag('users')              // multiple tags — coarser revalidation
  return db.users.findUnique({ where: { id: userId } })
}
```

Revalidate in a Server Action:

```ts
'use server'
import { revalidateTag } from 'next/cache'

export async function updateUserProfile(userId: string, data: FormData) {
  await db.users.update({ where: { id: userId }, data: Object.fromEntries(data) })
  revalidateTag(`user-${userId}`)   // precise: invalidates only this user's cache
  // revalidateTag('users')         // coarse: invalidates all user caches
}
```

`revalidateTag` can also be called from Route Handlers (e.g., webhooks).

## File-level vs function-level caching

```ts
// File-level: ALL exported functions in this file are cached
'use cache'

export async function getCategories() { ... }
export async function getTags() { ... }
```

```ts
// Function-level: only getProduct is cached; getUncachedData is not
import { cacheLife } from 'next/cache'

export async function getProduct(id: string) {
  'use cache'
  cacheLife('hours')
  ...
}

export async function getUncachedData() {
  // runs fresh on every request
  ...
}
```

Prefer function-level caching when the file mixes cached and uncached data access.

## Interaction with dynamic rendering

When a `'use cache'` function is called inside a Server Component that also uses dynamic APIs (cookies, headers, searchParams), the dynamic data is NOT passed into the cached function — the cache boundary isolates them. Pass dynamic values as function arguments explicitly:

```ts
// Wrong: cookies() inside a cached function reads stale data
'use cache'
export async function getCart() {
  const cookieStore = await cookies()          // ❌ cookies inside cache boundary
  const userId = cookieStore.get('userId')
  ...
}

// Right: pass userId as an argument so it becomes a cache key
'use cache'
export async function getCart(userId: string) { // ✓ argument is part of cache key
  cacheTag(`cart-${userId}`)
  return db.carts.findUnique({ where: { userId } })
}
```

Call site (in a Server Component):
```tsx
const cookieStore = await cookies()
const userId = cookieStore.get('userId')?.value
const cart = await getCart(userId ?? '')       // passes dynamic value as arg
```

## `revalidatePath` vs `revalidateTag`

| | `revalidateTag` | `revalidatePath` |
|---|---|---|
| Precision | Tag-based (specific entries) | Path-based (entire route) |
| Recommended | Yes — when tags are set | Use only without `'use cache'` tags |
| Scope | Crosses routes | Single route tree |

With `'use cache'` in use, always prefer `revalidateTag`. `revalidatePath` remains useful for pages that use `export const revalidate` or pure ISR without cache tags.

## Opting out of caching

```ts
import { noStore } from 'next/cache'

export async function getLivePrice(ticker: string) {
  noStore()   // equivalent to { cache: 'no-store' } on fetch
  return fetch(`https://prices.api/${ticker}`).then(r => r.json())
}
```

Or use `unstable_noStore` if `noStore` is not yet available in your minor version — they are aliases.

## Migration from Next.js 15 cache API

| Next.js 15 | Next.js 16 equivalent |
|---|---|
| `fetch(url, { cache: 'force-cache' })` | Wrap in `'use cache'` function |
| `fetch(url, { next: { revalidate: 3600 } })` | `cacheLife('hours')` |
| `fetch(url, { next: { tags: ['products'] } })` | `cacheTag('products')` |
| `unstable_cache(fn, keys, { revalidate })` | `'use cache'` directive on fn |
| `export const revalidate = 3600` on page | `cacheLife` in data functions |
| `revalidateTag('products')` | Same — no change |
| `revalidatePath('/products')` | Same — prefer `revalidateTag` when possible |
