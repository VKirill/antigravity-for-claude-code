# Example — JWT-protected API with role gates

Hono 4 + `hono/jwt` + Zod + role-based access control. Works on Workers, Node, Bun without changes.

## Schema

```ts
// shared/schemas.ts
import { z } from 'zod';

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const Tokens = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export const JwtPayload = z.object({
  sub: z.string(),
  role: z.enum(['user', 'admin']),
  exp: z.number().int(),
});

export type JwtPayload = z.infer<typeof JwtPayload>;
```

## Server

```ts
import { Hono } from 'hono';
import { jwt, sign } from 'hono/jwt';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { MiddlewareHandler } from 'hono';
import type { JwtPayload } from './shared/schemas';

type Bindings = { JWT_SECRET: string; JWT_REFRESH_SECRET: string };
type Variables = { jwtPayload: JwtPayload };

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const ACCESS_TTL = 15 * 60;            // 15 min
const REFRESH_TTL = 30 * 24 * 60 * 60; // 30 days

// --- Helpers ---

async function issueAccessToken(secret: string, payload: { sub: string; role: 'user' | 'admin' }) {
  return sign(
    { ...payload, exp: Math.floor(Date.now() / 1000) + ACCESS_TTL },
    secret,
    'HS256',
  );
}

const requireRole = (role: 'admin' | 'user'): MiddlewareHandler<{ Variables: Variables }> =>
  async (c, next) => {
    const p = c.get('jwtPayload');
    if (p?.role !== role) return c.json({ error: 'forbidden' }, 403);
    await next();
  };

// --- Routes ---

const routes = app
  .post('/auth/login',
    zValidator('json', z.object({ email: z.string().email(), password: z.string().min(8) })),
    async (c) => {
      const { email } = c.req.valid('json');
      // TODO: lookup + bcrypt verify against DB
      const user = { id: 'u_1', role: email.endsWith('@admin.com') ? ('admin' as const) : ('user' as const) };

      const accessToken = await issueAccessToken(c.env.JWT_SECRET, { sub: user.id, role: user.role });
      const refreshToken = await sign(
        { sub: user.id, exp: Math.floor(Date.now() / 1000) + REFRESH_TTL, type: 'refresh' as const },
        c.env.JWT_REFRESH_SECRET, 'HS256',
      );
      return c.json({ accessToken, refreshToken });
    });

// JWT-protected scope
app.use('/api/*', (c, next) => jwt({ secret: c.env.JWT_SECRET, alg: 'HS256' })(c, next));

app
  .get('/api/me', (c) => {
    const p = c.get('jwtPayload');
    return c.json({ userId: p.sub, role: p.role });
  })
  .get('/api/admin/users', requireRole('admin'), (c) => {
    return c.json([{ id: 'u_1', email: 'a@b.c' }]);
  });

app.onError((err, c) => {
  if (err.name === 'JwtTokenExpired') return c.json({ error: 'token_expired' }, 401);
  if (err.name === 'JwtTokenInvalid') return c.json({ error: 'token_invalid' }, 401);
  return c.json({ error: 'internal' }, 500);
});

export type AppType = typeof routes;
export default app;
```

## Client (RPC)

```ts
import { hc } from 'hono/client';
import type { AppType } from '../server/src/app';

let accessToken: string | null = null;

const baseClient = hc<AppType>('http://localhost:3001');

async function authedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(input, { ...init, headers });
}

export const api = hc<AppType>('http://localhost:3001', { fetch: authedFetch });

export async function login(email: string, password: string) {
  const res = await baseClient.auth.login.$post({ json: { email, password } });
  if (!res.ok) throw new Error('login failed');
  const { accessToken: t } = await res.json();
  accessToken = t;
}
```

## Tests

```ts
import { describe, it, expect } from 'vitest';
import app from '../src/app';

const env = { JWT_SECRET: 'test-secret', JWT_REFRESH_SECRET: 'test-refresh' };

describe('auth', () => {
  it('issues tokens on login', async () => {
    const res = await app.fetch(
      new Request('http://x/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.c', password: 'password' }),
      }),
      env,
    );
    expect(res.status).toBe(200);
    const { accessToken, refreshToken } = await res.json();
    expect(accessToken).toBeTypeOf('string');
    expect(refreshToken).toBeTypeOf('string');
  });

  it('rejects /api/me without token', async () => {
    const res = await app.fetch(new Request('http://x/api/me'), env);
    expect(res.status).toBe(401);
  });

  it('lets admin into /api/admin/users', async () => {
    const login = await app.fetch(
      new Request('http://x/auth/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'root@admin.com', password: 'password' }),
      }), env,
    );
    const { accessToken } = await login.json();
    const r = await app.fetch(
      new Request('http://x/api/admin/users', { headers: { Authorization: `Bearer ${accessToken}` } }),
      env,
    );
    expect(r.status).toBe(200);
  });
});
```

## Patterns

- Issue short-lived access tokens (15 min), long-lived refresh tokens (30 days)
- Store refresh tokens server-side (Redis `SET refresh:<jti> userId EX 2592000`) to allow revocation
- `requireRole` is a typed middleware factory; chain it after `jwt()` so `c.get('jwtPayload')` is set
- `app.onError` distinguishes expired vs malformed JWT — return 401 in both cases but with a typed code
- Never put role in the URL path; check it inside middleware against the JWT claims
