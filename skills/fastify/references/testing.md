# Fastify — Testing

## `fastify.inject()` — in-process HTTP

No sockets, no port allocation. Returns a `LightMyRequest` response:

```ts
const res = await app.inject({
  method: 'POST',
  url: '/users',
  payload: { email: 'x@y.z' },
  headers: { 'content-type': 'application/json' },
});

res.statusCode;  // 201
res.json();      // parsed body
res.headers;     // response headers
res.body;        // raw string
```

## `buildApp()` factory pattern

```ts
// src/app.ts
import Fastify from 'fastify';
import dbPlugin from './plugins/db';
import routes from './routes';

export async function buildApp(opts = {}) {
  const app = Fastify({ logger: false, ...opts });
  await app.register(dbPlugin);
  await app.register(routes);
  return app;
}

// src/server.ts
const app = await buildApp({ logger: true });
await app.listen({ port: 3000, host: '0.0.0.0' });
```

Tests build a fresh app instance per `describe` block — fast (no socket open).

## With `node:test`

```ts
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.ts';

describe('users', () => {
  let app;
  before(async () => { app = await buildApp(); await app.ready(); });
  after(async () => { await app.close(); });

  it('creates a user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { email: 'a@b.c' },
    });
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().email, 'a@b.c');
  });
});
```

Run: `node --experimental-strip-types --test "tests/**/*.test.ts"`.

## With Vitest

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.ts';

describe('users', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeAll(async () => { app = await buildApp(); await app.ready(); });
  afterAll(async () => { await app.close(); });

  it('creates a user', async () => {
    const res = await app.inject({ method: 'POST', url: '/users', payload: { email: 'a@b.c' } });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ email: 'a@b.c' });
  });
});
```

## Mocking decorators

Replace `app.db` with a fake in tests:

```ts
beforeAll(async () => {
  app = await buildApp();
  app.decorate('db', {
    user: { findUnique: vi.fn().mockResolvedValue({ id: '1', email: 'x@y.z' }) },
  } as any);
  await app.ready();
});
```

But `decorate` after `ready()` is forbidden. Pattern: pass a `db` option into `buildApp` and register your real plugin only if not provided.

```ts
export async function buildApp({ db, ...opts } = {}) {
  const app = Fastify({ logger: false, ...opts });
  if (db) app.decorate('db', db);
  else await app.register(dbPlugin);
  // ...
}
```

## Auth in tests

Sign a real token:

```ts
const token = app.jwt.sign({ sub: 'user-1', role: 'admin' });
const res = await app.inject({
  url: '/admin/users',
  headers: { authorization: `Bearer ${token}` },
});
```

## Streaming / multipart tests

`inject` supports `payload` as a string, Buffer, stream, or a form-data object:

```ts
import FormData from 'form-data';
const form = new FormData();
form.append('file', Buffer.from('hello'), { filename: 'a.txt' });
const res = await app.inject({ method: 'POST', url: '/upload', payload: form, headers: form.getHeaders() });
```

## Coverage

`node --experimental-test-coverage --test "tests/**/*.test.ts"` (Node 24 native) or `vitest --coverage` (V8).

## Anti-patterns

- ❌ One shared `app` instance across all files (state leaks) — build per `describe`
- ❌ Forgetting `await app.close()` — leaks Pino workers, DB connections
- ❌ Calling `inject()` before `ready()` — plugin tree not compiled
- ❌ Real HTTP calls (`supertest`, manual `fetch`) — slower, racier, no need
- ❌ Mocking Fastify itself — mock decorators / dependencies instead
