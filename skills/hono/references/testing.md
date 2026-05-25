# Hono — Testing

## `app.request(url, init?)` — universal in-memory test

```ts
import { describe, it, expect } from 'vitest';
import app from '../src/app';

describe('users', () => {
  it('creates a user', async () => {
    const res = await app.request('/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.c' }),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ email: 'a@b.c' });
  });

  it('returns 404 for unknown route', async () => {
    const res = await app.request('/no');
    expect(res.status).toBe(404);
  });
});
```

`app.request()` returns a standard `Response`. No sockets, no port. Works on every runtime.

## Pass `Request` directly

```ts
const req = new Request('http://localhost/users', { method: 'GET' });
const res = await app.fetch(req, { /* env bindings */ });
```

Useful when you need to provide Workers `env`:

```ts
const res = await app.fetch(
  new Request('http://x/api'),
  { KV: mockKV } as Bindings,
);
```

## Mocking bindings

```ts
const mockKV = {
  get: vi.fn().mockResolvedValue('cached-value'),
  put: vi.fn().mockResolvedValue(undefined),
} as unknown as KVNamespace;

const res = await app.fetch(new Request('http://x/cached'), { KV: mockKV });
```

## Testing Workers with Miniflare / vitest-pool-workers

For tests that exercise true Workers semantics (KV, D1, Durable Objects):

```ts
// vitest.config.ts
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
      },
    },
  },
});
```

Then:

```ts
import { env, SELF } from 'cloudflare:test';

it('reads from KV', async () => {
  await env.KV.put('k', 'v');
  const res = await SELF.fetch('https://example.com/cached');
  expect(await res.text()).toBe('v');
});
```

## Testing JWT-protected routes

```ts
import { sign } from 'hono/jwt';
const token = await sign({ sub: 'u1', exp: Math.floor(Date.now()/1000) + 60 }, 'secret', 'HS256');

const res = await app.request('/admin', {
  headers: { Authorization: `Bearer ${token}` },
});
expect(res.status).toBe(200);
```

## Testing form / file upload

```ts
const fd = new FormData();
fd.append('file', new Blob(['hello'], { type: 'text/plain' }), 'a.txt');

const res = await app.request('/upload', { method: 'POST', body: fd });
expect(res.status).toBe(201);
```

## Mocking external `fetch`

```ts
import { vi } from 'vitest';
const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"x":1}', { status: 200 }));
```

For test isolation, use `msw` or a per-test stub. Hono itself doesn't ship a fetch mock.

## Coverage

Standard Vitest: `vitest run --coverage`. For Workers: coverage works with `@cloudflare/vitest-pool-workers`.

## Anti-patterns

- ❌ Spinning up `@hono/node-server` and calling real HTTP — slower, racier; `app.request()` is enough
- ❌ Mocking `Hono` itself — mock dependencies (DB, KV) and let the framework run
- ❌ Forgetting to await `await c.req.json()` — silent `Promise<...>` value
- ❌ Reusing the same `app` instance across tests when middleware writes to module-scope mutable state — keep state per-request via `c.var`
