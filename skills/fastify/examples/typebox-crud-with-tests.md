# Example — TypeBox CRUD with Fastify + tests

End-to-end: Fastify 5 + `@fastify/type-provider-typebox` + Prisma + `node:test` via `fastify.inject()`.

## File tree

```
src/
├── app.ts            # buildApp factory
├── server.ts         # entry
├── plugins/
│   └── db.ts         # Prisma decorator
└── routes/
    └── users.ts      # CRUD with TypeBox schemas
tests/
└── users.test.ts
```

## `src/plugins/db.ts`

```ts
import fp from 'fastify-plugin';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export default fp(async (app) => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });
  await db.$connect();

  app.decorate('db', db);
  app.addHook('onClose', async () => { await db.$disconnect(); });
}, { name: 'db' });

declare module 'fastify' {
  interface FastifyInstance { db: PrismaClient }
}
```

## `src/routes/users.ts`

```ts
import type { FastifyPluginAsync } from 'fastify';
import Type from 'typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

const userRoutes: FastifyPluginAsync = async (appRaw) => {
  const app = appRaw.withTypeProvider<TypeBoxTypeProvider>();

  const UserSchema = Type.Object({
    id: Type.String(),
    email: Type.String({ format: 'email' }),
    createdAt: Type.String({ format: 'date-time' }),
  });

  app.get('/users', {
    schema: { response: { 200: Type.Array(UserSchema) } },
  }, async () => app.db.user.findMany());

  app.get('/users/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      response: { 200: UserSchema, 404: Type.Object({ error: Type.String() }) },
    },
  }, async (req, reply) => {
    const user = await app.db.user.findUnique({ where: { id: req.params.id } });
    if (!user) return reply.code(404).send({ error: 'not_found' });
    return user;
  });

  app.post('/users', {
    schema: {
      body: Type.Object({ email: Type.String({ format: 'email' }) }),
      response: { 201: UserSchema },
    },
  }, async (req, reply) => {
    const user = await app.db.user.create({ data: { email: req.body.email } });
    return reply.code(201).send(user);
  });

  app.delete('/users/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      response: { 204: Type.Null() },
    },
  }, async (req, reply) => {
    await app.db.user.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });
};

export default userRoutes;
```

## `src/app.ts`

```ts
import Fastify from 'fastify';
import dbPlugin from './plugins/db.ts';
import userRoutes from './routes/users.ts';

export async function buildApp(opts = {}) {
  const app = Fastify({ logger: false, ...opts });
  await app.register(dbPlugin);
  await app.register(userRoutes, { prefix: '/api/v1' });
  return app;
}
```

## `tests/users.test.ts`

```ts
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.ts';

describe('users CRUD', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  before(async () => {
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it('creates a user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      payload: { email: 'a@b.c' },
    });
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().email, 'a@b.c');
  });

  it('rejects invalid email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      payload: { email: 'not-an-email' },
    });
    assert.equal(res.statusCode, 400);
  });

  it('returns 404 for unknown user', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/users/nope' });
    assert.equal(res.statusCode, 404);
  });
});
```

## Run

```bash
node --experimental-strip-types --test "tests/**/*.test.ts"
```

## Key takeaways

- `app.withTypeProvider<TypeBoxTypeProvider>()` propagates types — `req.body`, `req.params`, `reply.send()` all typed
- Schemas drive **both** validation AND response serialization (faster `JSON.stringify`)
- Tests use `app.inject()` — no socket, no port — fast and isolated
- `fastify-plugin` (`fp`) ensures `app.db` is visible to sibling plugins
- Per-test app rebuilds let you tweak options (e.g., in-memory SQLite via Prisma adapter for unit tests)
