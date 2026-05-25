# Example — Fastify 5 + Prisma 7 CRUD

End-to-end CRUD with `PrismaPg`, hoisted via `fastify-plugin`, error mapping for `P2002`/`P2025`.

## File tree

```
src/
├── server.ts
├── app.ts
├── plugins/db.ts
└── routes/users.ts
prisma/
├── schema.prisma
└── seed.ts
prisma.config.ts
```

## `prisma/schema.prisma` (excerpt)

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../generated/prisma"
  runtime      = "nodejs"
  moduleFormat = "esm"
}

datasource db { provider = "postgresql" }

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
}
```

## `src/plugins/db.ts`

```ts
import fp from 'fastify-plugin';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

declare module 'fastify' {
  interface FastifyInstance {
    db: PrismaClient;
  }
}

export default fp(async (app) => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

  await db.$connect();
  app.decorate('db', db);

  app.addHook('onClose', async () => {
    await db.$disconnect();
  });
}, { name: 'db' });
```

## `src/routes/users.ts`

```ts
import type { FastifyPluginAsync } from 'fastify';
import { Prisma } from '../../generated/prisma/client';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  createdAt: z.string().datetime(),
});

const usersRoutes: FastifyPluginAsync = async (appRaw) => {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.get('/users', {
    schema: { response: { 200: z.array(UserSchema) } },
  }, async () => app.db.user.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }));

  app.get('/users/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      response: { 200: UserSchema, 404: z.object({ error: z.string() }) },
    },
  }, async (req, reply) => {
    const u = await app.db.user.findUnique({ where: { id: req.params.id } });
    if (!u) return reply.code(404).send({ error: 'not_found' });
    return u;
  });

  app.post('/users', {
    schema: {
      body: z.object({ email: z.string().email(), name: z.string().optional() }),
      response: { 201: UserSchema, 409: z.object({ error: z.string() }) },
    },
  }, async (req, reply) => {
    try {
      const u = await app.db.user.create({ data: req.body });
      return reply.code(201).send(u);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return reply.code(409).send({ error: 'email_taken' });
      }
      throw err;
    }
  });

  app.delete('/users/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      response: { 204: z.null(), 404: z.object({ error: z.string() }) },
    },
  }, async (req, reply) => {
    try {
      await app.db.user.delete({ where: { id: req.params.id } });
      return reply.code(204).send();
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return reply.code(404).send({ error: 'not_found' });
      }
      throw err;
    }
  });
};

export default usersRoutes;
```

## `src/app.ts`

```ts
import Fastify from 'fastify';
import dbPlugin from './plugins/db';
import usersRoutes from './routes/users';

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(dbPlugin);
  await app.register(usersRoutes, { prefix: '/api' });
  return app;
}
```

## `src/server.ts`

```ts
import { buildApp } from './app';

const app = await buildApp();
const shutdown = async () => { await app.close(); process.exit(0); };
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
await app.listen({ port: 3000, host: '0.0.0.0' });
```

## Tests

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../src/app';

describe('users CRUD', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeAll(async () => { app = await buildApp(); await app.ready(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await app.db.user.deleteMany(); });

  it('creates and reads a user', async () => {
    const r1 = await app.inject({ method: 'POST', url: '/api/users', payload: { email: 'a@b.c' } });
    expect(r1.statusCode).toBe(201);
    const { id } = r1.json();

    const r2 = await app.inject({ method: 'GET', url: `/api/users/${id}` });
    expect(r2.statusCode).toBe(200);
    expect(r2.json().email).toBe('a@b.c');
  });

  it('rejects duplicate emails with 409', async () => {
    await app.inject({ method: 'POST', url: '/api/users', payload: { email: 'a@b.c' } });
    const r = await app.inject({ method: 'POST', url: '/api/users', payload: { email: 'a@b.c' } });
    expect(r.statusCode).toBe(409);
  });

  it('returns 404 for unknown user', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/users/nope' });
    expect(r.statusCode).toBe(404);
  });
});
```

## Key patterns

- `fastify-plugin` (`fp`) hoists `app.db` to the parent scope so all routes see it
- `onClose` hook ensures Prisma disconnects cleanly on `app.close()`
- Prisma errors mapped to HTTP codes (`P2002` → 409, `P2025` → 404)
- Zod schemas drive both validation AND response serialization via `fastify-type-provider-zod`
- Per-test cleanup via `beforeEach` `deleteMany` — fast, isolated
