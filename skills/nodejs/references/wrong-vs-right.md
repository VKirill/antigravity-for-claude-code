# Wrong vs Right — nodejs

High-stakes patterns where the "obvious" code compiles and runs but is unsafe in production. Required for `risk: high-stakes` per skill-evaluation v3.

---

## 1. `uncaughtException` / `unhandledRejection` handlers

**❌ Wrong — swallow errors, keep running on corrupted state:**
```ts
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'oops');
  // process continues — no fix!
});
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'rejected');
});
```

**✅ Right — log, flush, exit so the supervisor restarts you clean:**
```ts
process.once('uncaughtException', async (err) => {
  logger.fatal({ err }, 'uncaughtException — exiting');
  await new Promise(r => logger.flush(r));
  process.exit(1);
});
process.once('unhandledRejection', async (reason) => {
  logger.fatal({ reason }, 'unhandledRejection — exiting');
  await new Promise(r => logger.flush(r));
  process.exit(1);
});
```

**Why it matters:** an uncaught exception by definition came from broken invariants — the process state is undefined. Continuing means subsequent requests run on corrupted data (half-rolled-back transactions, stale caches, leaked handles). The Node 24 default for `unhandledRejection` is already `throw` (process exits); only override to use `process.once` so PM2/k8s can replace the pod cleanly. Use `once`, not `on`, so a second signal doesn't re-enter the handler.

---

## 2. `AsyncLocalStorage` instance scope

**❌ Wrong — `new AsyncLocalStorage()` inside the request handler:**
```ts
app.use((req, res, next) => {
  const als = new AsyncLocalStorage<Ctx>();   // new instance per request
  als.run({ requestId: req.id }, () => next());
});
// downstream code can't get the store because they hold a different instance
```

**✅ Right — single instance at module scope:**
```ts
// src/shared/context.ts
import { AsyncLocalStorage } from 'node:async_hooks';
export const requestContext = new AsyncLocalStorage<{ requestId: string; userId?: string }>();

// src/middleware/context.ts
app.use((req, res, next) => {
  requestContext.run({ requestId: req.id }, () => next());
});

// anywhere downstream
import { requestContext } from '../shared/context.js';
const ctx = requestContext.getStore();
```

**Why it matters:** `AsyncLocalStorage` is identity-keyed — `als.getStore()` only returns data for the same instance that called `.run()`. A per-request instance means every other module sees `undefined`. The instance is the contract; one process should have one per scope (request, transaction, etc.).

---

## 3. Webhook body / large JSON parsing

**❌ Wrong — synchronous `JSON.parse` of unbounded body on the main thread:**
```ts
app.post('/import', (req, res) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    const data = JSON.parse(body);   // 50 MB → blocks event loop 200+ ms
    process(data);
    res.end('ok');
  });
});
```

**✅ Right — bounded body limit + streaming parser:**
```ts
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import StreamArray from 'stream-json/streamers/StreamArray.js';

// Fastify: bodyLimit; Express: express.json({ limit: '1mb' })
app.post('/import', { bodyLimit: 1_000_000 }, async (req, res) => {
  await pipeline(
    req.raw,
    StreamArray.withParser(),
    async function* (source) {
      for await (const { value } of source) {
        await processOneItem(value);   // backpressure-aware
      }
    },
  );
  res.send({ ok: true });
});
```

**Why it matters:** `JSON.parse` is synchronous and CPU-time scales with payload size. A single 50 MB upload pauses every other request on that worker for the duration. The framework body-limit protects against the worst case; streaming parsers handle legitimately large payloads without head-of-line blocking. For webhook signatures specifically, you also need the raw body for HMAC verification — see the `cloudpayments` / `yookassa` skills.

---

## 4. `argon2.verify` / token comparison

**❌ Wrong — plain `===` on hashes / API tokens:**
```ts
const tokenFromDb = await db.tokens.findUnique({ where: { id } });
if (tokenFromDb.value === req.headers['x-api-token']) {
  return next();
}
// Also wrong:
const stored = await db.users.findUnique(...).password;
if (stored === argon2.hash(req.body.password)) ...   // double wrong: re-hash != verify, also non-constant time
```

**✅ Right — `argon2.verify` for passwords, `timingSafeEqual` for tokens:**
```ts
import argon2 from 'argon2';
import { timingSafeEqual } from 'node:crypto';

// Password verify — argon2 handles timing internally
const ok = await argon2.verify(user.passwordHash, req.body.password);

// API token / HMAC comparison
const a = Buffer.from(tokenFromDb);
const b = Buffer.from(req.headers['x-api-token'] as string);
if (a.length !== b.length) return res.status(401).end();
if (!timingSafeEqual(a, b)) return res.status(401).end();
```

**Why it matters:** `===` / `Buffer.compare` short-circuit on the first differing byte. An attacker measures response latency and bisects the secret byte by byte. `argon2.verify` re-derives the hash with the stored parameters in constant time; `crypto.timingSafeEqual` compares fixed-length buffers without branching. Length check goes first because `timingSafeEqual` THROWS on mismatched length — leaking length is an acceptable side channel for fixed-size tokens. See [recommended-defaults.md](recommended-defaults.md) for argon2 parameters.

---

## 5. Subprocess kill / SIGTERM without deadman

**❌ Wrong — send SIGTERM and assume the child obeys:**
```ts
import { spawn } from 'node:child_process';
const child = spawn('long-running-task');

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
  // we exit immediately; if child hangs, it's orphaned to PID 1
});
```

**✅ Right — SIGTERM → grace timer → SIGKILL fallback:**
```ts
function killWithGrace(child: ChildProcess, graceMs = 10_000): Promise<void> {
  return new Promise<void>((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
    const t = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');   // escalate
    }, graceMs);
    t.unref();
  });
}

process.once('SIGTERM', async () => {
  setTimeout(() => process.exit(1), 30_000).unref();   // deadman for self
  await killWithGrace(child, 10_000);
  process.exit(0);
});
```

**Why it matters:** SIGTERM is a polite request — the child can ignore it. Without a fallback, a stuck child becomes a PID 1 orphan in the container or accumulates in PM2 zombie state. The deadman timer on the parent guarantees the parent itself exits within the grace window, regardless of the child's state. Same pattern applies inside the parent's own shutdown handler. See [recommended-defaults.md](recommended-defaults.md) graceful-shutdown section.

---

## 6. (Bonus) `process.env` access without validation

**❌ Wrong — assume env vars exist and are well-typed:**
```ts
const port = parseInt(process.env.PORT);          // NaN if unset
const dbUrl = process.env.DATABASE_URL;            // string | undefined
const isProduction = process.env.NODE_ENV === 'production';  // typo-prone
```

**✅ Right — validate at startup with Zod, fail fast:**
```ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export const env = envSchema.parse(process.env);   // throws with readable error
```

**Why it matters:** an unset `DATABASE_URL` won't fail at boot — it fails on the first query, in production, sometimes hours after deploy. Zod (or `valibot`) at boot transforms "silent latent bug" into "process refuses to start" — which is exactly what you want. See `references/security.md` and the `zod` skill.

---

## More pairs?

Concept-specific wrong/right blocks also live in:
- `references/async-patterns.md` — Promise.all vs allSettled vs any, AbortSignal patterns
- `references/error-handling.md` — `error.cause` chaining, `sanitizeError` for structured logs
- `references/shutdown.md` — PM2 / k8s integration variants
- `references/security.md` — Helmet, CORS allowlist, JWT signature/audience
