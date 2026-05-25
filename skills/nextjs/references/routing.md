# Next.js 16 — Routing

## File conventions

| File | Purpose | Notes |
|---|---|---|
| `page.tsx` | Route UI — makes segment publicly accessible | Only file that makes a segment a route |
| `layout.tsx` | Shared wrapper, persists across navigations | Does not remount on nav |
| `template.tsx` | Like layout but remounts on every navigation | Use for per-route animations |
| `loading.tsx` | Auto-wraps page in `<Suspense>` | Shows while page segment loads |
| `error.tsx` | Error boundary for the segment | Must be `'use client'` |
| `not-found.tsx` | Rendered when `notFound()` is called | Server Component |
| `forbidden.tsx` | Rendered when `forbidden()` is called | Server Component (Next.js 16+) |
| `unauthorized.tsx` | Rendered when `unauthorized()` is called | Server Component (Next.js 16+) |
| `route.ts` | Route Handler (API endpoint) | Cannot coexist with `page.tsx` in same segment |
| `default.tsx` | Fallback for parallel route slot | Avoids 404 on direct navigation |
| `global-error.tsx` | Catches errors in root layout | Must be `'use client'`, replaces root layout |

### Non-route files (safe to colocate)

Any file that isn't one of the reserved names above is not treated as a route. You can colocate `components/`, `utils.ts`, `types.ts`, `actions.ts` inside `app/` freely.

## Segment config options

Export at the top of `page.tsx`, `layout.tsx`, or `route.ts`:

```ts
export const dynamic = 'force-dynamic'     // 'auto' | 'force-dynamic' | 'error' | 'force-static'
export const revalidate = 3600             // seconds; 0 = always revalidate; false = indefinite
export const fetchCache = 'force-no-store' // controls fetch cache behaviour
export const runtime = 'edge'              // 'nodejs' (default) | 'edge'
export const preferredRegion = 'iad1'      // Vercel region hint
export const maxDuration = 30              // seconds (serverless function timeout)
export const experimental_ppr = true       // enable PPR for this route
```

`dynamic = 'force-dynamic'` opts the whole route out of static generation. Avoid it when `'use cache'` is in use — let the cache directive control dynamism at the data level.

## Dynamic routes

| Convention | Matches | `params` shape |
|---|---|---|
| `app/products/[id]/page.tsx` | `/products/42` | `{ id: '42' }` |
| `app/blog/[...slug]/page.tsx` | `/blog/a/b/c` | `{ slug: ['a','b','c'] }` |
| `app/blog/[[...slug]]/page.tsx` | `/blog` and `/blog/a/b` | `{ slug: undefined }` or `{ slug: ['a','b'] }` |

### Async params — Next.js 16 breaking change

`params` and `searchParams` are now Promises. Always await:

```tsx
// app/products/[id]/page.tsx
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }

export default async function ProductPage({ params, searchParams }: Props) {
  const { id } = await params
  const { q } = await searchParams
  ...
}

// route handler
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  ...
}
```

TypeScript: use `Promise<{ id: string }>` for params type. The old `{ id: string }` type fails compilation in Next.js 16.

### generateStaticParams

Pre-generates dynamic routes at build time:

```ts
export async function generateStaticParams() {
  const products = await db.products.findMany({ select: { id: true } })
  return products.map((p) => ({ id: p.id }))
}
```

Returns an array of `params` objects. Combined with `'use cache'` data fetching, this is the recommended static generation approach. Set `export const dynamic = 'force-static'` if you want a hard error on any un-pre-generated path.

## Parallel routes

Parallel routes render multiple pages simultaneously in the same layout using named slots.

```
app/
  layout.tsx           ← receives @analytics and @team as props
  page.tsx
  @analytics/
    page.tsx
  @team/
    page.tsx
    default.tsx        ← fallback for direct navigation
```

```tsx
// app/layout.tsx
export default function Layout({
  children,
  analytics,
  team,
}: {
  children: React.ReactNode
  analytics: React.ReactNode
  team: React.ReactNode
}) {
  return (
    <div>
      {children}
      {analytics}
      {team}
    </div>
  )
}
```

Each slot has independent loading/error states. `default.tsx` is required in each slot to handle navigations that don't match the slot's routes.

Use cases: dashboards with independent panes, split-view UIs, conditional modals.

## Intercepting routes

Display a route in a different context (e.g., a modal) without navigating away.

| Convention | Matches | Use case |
|---|---|---|
| `(.)photo/[id]` | Same-level segment | Modal over current page |
| `(..)photo/[id]` | One level up | Modal in parent layout |
| `(...)photo/[id]` | From app root | Modal anywhere |

Pattern: create both a full page (`app/photo/[id]/page.tsx`) and an intercepted version (`app/@modal/(.)photo/[id]/page.tsx`). Soft navigation (client-side) hits the intercepting route (modal). Hard navigation / refresh hits the full page.

## Route Groups

Parentheses in folder names create route groups without affecting the URL:

```
app/
  (marketing)/
    about/page.tsx    → /about
    contact/page.tsx  → /contact
  (shop)/
    products/page.tsx → /products
```

Use route groups to share layouts within a subset of routes without URL nesting. Each group can have its own `layout.tsx`.

## Route Handlers

```ts
// app/api/products/route.ts
import { NextResponse } from 'next/server'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const product = await getProduct(id)
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(product)
}

export async function POST(req: Request) {
  const body = await req.json()
  // ...
  return NextResponse.json({ created: true }, { status: 201 })
}
```

Supported exports: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`. Route handlers run server-side. Use for webhooks, third-party API integrations, and cases where a Server Action can't be used.

## cookies() and headers() — async in Next.js 16

```ts
import { cookies, headers } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()          // Promise<ReadonlyRequestCookies>
  const token = cookieStore.get('token')?.value

  const headersList = await headers()          // Promise<ReadonlyHeaders>
  const userAgent = headersList.get('user-agent')
  ...
}
```

`draftMode()` is also async: `const { isEnabled } = await draftMode()`.

Setting cookies in Server Actions:
```ts
'use server'
import { cookies } from 'next/headers'
export async function setToken(token: string) {
  const cookieStore = await cookies()
  cookieStore.set('token', token, { httpOnly: true, secure: true, sameSite: 'lax' })
}
```
