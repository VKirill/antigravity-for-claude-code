# Next.js 16 — Middleware (proxy.ts)

## Overview

Next.js 16 renames `middleware.ts` to `proxy.ts`. The file lives at the project root (same level as `app/`). It runs at the **Edge** before every matched request — before layouts, pages, and route handlers.

```
project/
├── app/
├── proxy.ts        ← Next.js 16 name (was middleware.ts in ≤15)
├── next.config.ts
└── package.json
```

## Basic shape

```ts
// proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // inspect request, return a response or pass through
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
```

Always export `config` with a `matcher`. Without it, middleware runs on every request including static assets, which slows down asset delivery.

## Auth redirect

```ts
// proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED = ['/dashboard', '/settings', '/api/user']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('token')?.value

  if (PROTECTED.some((p) => pathname.startsWith(p)) && !token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*', '/api/user/:path*'],
}
```

## Header injection

```ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  response.headers.set('x-request-id', crypto.randomUUID())
  response.headers.set('x-forwarded-for', request.ip ?? 'unknown')
  return response
}
```

## Rewrite + redirect

```ts
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // A/B test: rewrite 50% of users to variant B
  const bucket = request.cookies.get('ab-bucket')?.value ?? (Math.random() < 0.5 ? 'a' : 'b')
  if (pathname === '/' && bucket === 'b') {
    return NextResponse.rewrite(new URL('/landing-b', request.url))
  }

  // Locale redirect
  if (pathname === '/') {
    const locale = request.headers.get('accept-language')?.split(',')[0].split('-')[0] ?? 'en'
    if (locale === 'ru') return NextResponse.redirect(new URL('/ru', request.url))
  }

  return NextResponse.next()
}
```

`NextResponse.rewrite` — serves content from a different URL while keeping the original URL in the browser.  
`NextResponse.redirect` — issues a 307/308 redirect visible to the browser.

## Matcher patterns

```ts
export const config = {
  matcher: [
    '/dashboard/:path*',                    // /dashboard and all sub-paths
    '/api/:path*',                          // all API routes
    '/((?!_next/static|_next/image).*)',    // everything except Next internals
    {
      source: '/about/:path*',
      missing: [                            // exclude when header is present
        { type: 'header', key: 'next-router-prefetch' },
      ],
    },
  ],
}
```

Matchers support:
- Wildcards: `:path*` (zero or more segments), `:id` (single segment)
- Regex in `source`
- `has` / `missing` conditions for header/cookie/query filtering

## Edge runtime constraints

Middleware always runs in the Edge runtime. Limitations:
- No Node.js built-in APIs (`fs`, `crypto`, `path`, etc.)
- No native modules (`.node` extensions)
- Limited to: Web APIs, `next/server`, `next/headers`, fetch, `TextEncoder/Decoder`
- Max bundle size: ~1MB compressed
- No access to `cookies()` / `headers()` from `next/headers` — use `request.cookies` and `request.headers` directly

If you need Node.js APIs for auth (e.g., verifying a JWT with `jsonwebtoken`): use the `jose` library (Edge-compatible) instead.

## JWT validation at Edge

```ts
// proxy.ts
import { jwtVerify } from 'jose'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    await jwtVerify(token, SECRET)
    return NextResponse.next()
  } catch {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('token')
    return response
  }
}

export const config = { matcher: ['/dashboard/:path*'] }
```

## Setting/deleting cookies in middleware

```ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // set
  response.cookies.set('session', 'value', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,   // 1 week
  })

  // delete
  response.cookies.delete('old-session')

  return response
}
```

## Reading cookies / headers in middleware

```ts
export function middleware(request: NextRequest) {
  // cookies
  const token = request.cookies.get('token')?.value
  const allCookies = request.cookies.getAll()

  // headers
  const ua = request.headers.get('user-agent')
  const country = request.headers.get('x-vercel-ip-country') ?? 'US'

  // URL
  const { pathname, searchParams } = request.nextUrl
  const q = searchParams.get('q')
  ...
}
```

## Migrating from middleware.ts (Next.js ≤15)

| Next.js ≤15 | Next.js 16 |
|---|---|
| File: `middleware.ts` | File: `proxy.ts` |
| Same `export function middleware(request)` | Unchanged |
| Same `export const config = { matcher }` | Unchanged |
| Same imports from `next/server` | Unchanged |

Only the filename changes. All API surface remains identical.
