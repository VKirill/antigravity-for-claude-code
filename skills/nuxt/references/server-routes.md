# Nuxt 4 — Server Routes (Nitro / h3)

## Directory layout

```
server/
├── api/            ← routes are prefixed /api/*
│   ├── users.get.ts          → GET /api/users
│   ├── users.post.ts         → POST /api/users
│   └── users/
│       ├── index.get.ts      → GET /api/users
│       └── [id].get.ts       → GET /api/users/:id
├── routes/         ← routes have no prefix
│   └── sitemap.xml.ts        → GET /sitemap.xml
├── middleware/     ← runs before every Nitro request
│   └── auth.ts
├── utils/          ← server-side auto-imports (not exposed as routes)
│   └── db.ts
└── plugins/        ← Nitro lifecycle plugins
    └── database.ts
```

## `defineEventHandler` — basic handler

```ts
// server/api/users.get.ts
export default defineEventHandler(async (event) => {
  // Read query params: GET /api/users?page=2&limit=10
  const query = getQuery(event)  // { page: '2', limit: '10' }

  // Read body (POST/PUT/PATCH)
  const body = await readBody(event)

  // Read URL param: /api/users/[id]
  const id = getRouterParam(event, 'id')

  // Set response status
  setResponseStatus(event, 201)

  // Set header
  setResponseHeader(event, 'X-Custom', 'value')

  return { users: [] }
})
```

## Method-restricted handlers

Append method suffix to filename:

```
users.get.ts    → GET only
users.post.ts   → POST only
users.put.ts    → PUT only
users.patch.ts  → PATCH only
users.delete.ts → DELETE only
```

No suffix = all methods. Use with a method switch:

```ts
// server/api/users/[id].ts — all methods
export default defineEventHandler(async (event) => {
  const method = event.method
  if (method === 'GET') return getUser(event)
  if (method === 'PATCH') return updateUser(event)
  if (method === 'DELETE') return deleteUser(event)
  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
```

## Reading request data

```ts
// URL params
const id = getRouterParam(event, 'id')         // string | undefined
const params = event.context.params            // all params object

// Query string
const query = getQuery(event)                  // Record<string, string>
const page = Number(getQuery(event).page ?? 1)

// Request body (JSON auto-parsed)
const body = await readBody<{ name: string }>(event)

// Raw body
const raw = await readRawBody(event)           // string | Uint8Array

// Form data
const form = await readFormData(event)

// Headers
const auth = getHeader(event, 'authorization')
const cookies = parseCookies(event)
```

## Error handling

```ts
// Throw an HTTP error — Nuxt serializes status + message
throw createError({ statusCode: 404, message: 'User not found' })
throw createError({ statusCode: 422, message: 'Validation failed', data: errors })

// Catch + rethrow with cause
try {
  await db.query(sql)
} catch (err) {
  throw createError({ statusCode: 500, message: 'DB error', cause: err })
}
```

## `useStorage` — key-value store

Built-in KV accessible inside handlers. Default driver is in-memory. Configure Nitro storage for Redis, filesystem, etc.

```ts
// server/api/cache/[key].ts
export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key')!
  const storage = useStorage('cache')

  if (event.method === 'GET') {
    const value = await storage.getItem(key)
    if (!value) throw createError({ statusCode: 404, message: 'Not found' })
    return value
  }

  if (event.method === 'PUT') {
    const body = await readBody(event)
    await storage.setItem(key, body)
    return { ok: true }
  }
})
```

Configure driver in nuxt.config.ts:

```ts
export default defineNuxtConfig({
  nitro: {
    storage: {
      cache: {
        driver: 'redis',
        host: process.env.REDIS_HOST,
        port: 6379,
      }
    }
  }
})
```

## Server middleware

Runs before every request (both API and page routes). Cannot return a response — only mutate `event.context` or throw:

```ts
// server/middleware/auth.ts
export default defineEventHandler((event) => {
  const token = getHeader(event, 'authorization')?.split(' ')[1]
  // Skip non-API routes
  if (!event.path.startsWith('/api/')) return

  if (!token || !validateToken(token)) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  // Attach user to context — available in downstream handlers
  event.context.user = decodeToken(token)
})
```

Access in handler:

```ts
// server/api/profile.get.ts
export default defineEventHandler((event) => {
  const user = event.context.user  // set by middleware
  return { profile: user }
})
```

## Nitro utilities

```ts
// Redirect
return sendRedirect(event, '/new-path', 301)

// Set cookies
setCookie(event, 'session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7,
})

// Delete cookie
deleteCookie(event, 'session')

// Get cookie
const session = getCookie(event, 'session')

// Proxy to another service
return proxyRequest(event, 'https://upstream.example.com/api')

// Stream response
return sendStream(event, readableStream)
```

## Typed response + Zod validation

```ts
// server/api/users.post.ts
import { z } from 'zod'

const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['admin', 'user']),
})

export default defineEventHandler(async (event) => {
  const rawBody = await readBody(event)
  const parsed = CreateUserSchema.safeParse(rawBody)

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      message: 'Validation failed',
      data: parsed.error.flatten(),
    })
  }

  const user = await createUser(parsed.data)
  setResponseStatus(event, 201)
  return user
})
```

## Catch-all routes

```ts
// server/api/[...path].ts → matches /api/anything/deep/nested
export default defineEventHandler((event) => {
  const path = event.context.params?.path  // string[] | string
  return { path }
})
```

## Server utilities (server/utils/)

Files under `server/utils/` are auto-imported in handler files — no explicit import needed:

```ts
// server/utils/db.ts
export function getDb() {
  return /* database connection */
}

// server/api/users.get.ts — no import needed
export default defineEventHandler(async () => {
  const db = getDb()  // auto-imported
  return db.query('SELECT * FROM users')
})
```
