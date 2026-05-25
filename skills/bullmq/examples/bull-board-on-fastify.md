# Example — Bull Board dashboard mounted on Fastify

Bull Board is a polished web UI for BullMQ queues. Mount it on your existing Fastify app under `/admin/queues`, gate it with basic auth.

## Install

```bash
npm i @bull-board/api @bull-board/fastify
npm i @fastify/basic-auth     # for the auth gate
```

## Code

```ts
// src/admin/bull-board.ts
import fp from 'fastify-plugin';
import basicAuth from '@fastify/basic-auth';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import type { Queue } from 'bullmq';

interface BullBoardOpts {
  queues: Queue[];
  basePath?: string;
  username: string;
  password: string;
}

export default fp(async (app, opts: BullBoardOpts) => {
  const basePath = opts.basePath ?? '/admin/queues';

  // Build the adapter
  const serverAdapter = new FastifyAdapter();
  serverAdapter.setBasePath(basePath);

  createBullBoard({
    queues: opts.queues.map((q) => new BullMQAdapter(q)),
    serverAdapter,
    options: {
      uiConfig: {
        boardTitle: 'My App Queues',
        boardLogo: { path: '/logo.svg' },
        miscLinks: [{ text: 'Back to app', url: '/' }],
      },
    },
  });

  // Auth — basic auth gate
  await app.register(basicAuth, {
    validate: async (username, password, req, reply) => {
      if (username !== opts.username || password !== opts.password) {
        const err = new Error('unauthorized');
        (err as Error & { statusCode: number }).statusCode = 401;
        throw err;
      }
    },
    authenticate: { realm: 'BullBoard' },
  });

  // Wrap the registration in a context that applies basicAuth
  await app.register(async (scope) => {
    scope.addHook('onRequest', app.basicAuth);
    await scope.register(serverAdapter.registerPlugin(), {
      prefix: basePath,
      basePath: '',
    });
  });
}, { name: 'bull-board' });
```

## Mount it in `app.ts`

```ts
// src/app.ts
import Fastify from 'fastify';
import bullBoardPlugin from './admin/bull-board';
import { emailsQueue, paymentsQueue, fulfillmentQueue } from './queues';

export async function buildApp() {
  const app = Fastify({ logger: true });

  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_BULL_BOARD === 'true') {
    await app.register(bullBoardPlugin, {
      queues: [emailsQueue, paymentsQueue, fulfillmentQueue],
      basePath: '/admin/queues',
      username: process.env.BULL_BOARD_USER ?? 'admin',
      password: process.env.BULL_BOARD_PASS!,
    });
  }

  // ... rest of your routes
  return app;
}
```

Visit `https://yourapp.com/admin/queues` → basic auth prompt → dashboard.

## What you see

- **Queue cards** — counts of waiting / active / completed / failed / delayed / paused
- **Job list per state** — filter, sort, search
- **Job detail** — payload, return value, opts, stack trace, logs
- **Actions** — retry, remove, promote (move delayed → waiting)
- **Repeatable jobs** — list of all schedulers
- **Real-time updates** — uses Redis Pub/Sub to push updates

## Security hardening

```ts
// Strict CSP for the dashboard
await app.register(import('@fastify/helmet'), {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // Bull Board uses inline scripts
      styleSrc:  ["'self'", "'unsafe-inline'"],
      imgSrc:    ["'self'", "data:"],
    },
  },
});
```

Combine with:
- VPN-only access via firewall rule (preferred for production)
- IP allowlist via `@fastify/ip-restriction`
- OAuth proxy in front (e.g., `oauth2-proxy`)
- Audit log every request — log `req.url`, user, action

## Multiple workers behind one dashboard

You can adopt multiple BullMQ instances:

```ts
import { Queue as BullMqQueue } from 'bullmq';
import { Queue as BullLegacyQueue } from 'bull';
import { BullAdapter } from '@bull-board/api/bullAdapter';   // for legacy Bull

createBullBoard({
  queues: [
    new BullMQAdapter(modernQueue),
    new BullAdapter(legacyQueue),       // mix BullMQ + legacy Bull during migration
  ],
  serverAdapter,
});
```

## Express / Hono / Next.js

Same `BullMQAdapter` — different server adapter:

```bash
npm i @bull-board/express     # Express
npm i @bull-board/hono         # Hono / Cloudflare Workers / Bun
npm i @bull-board/nestjs       # NestJS
```

## Anti-patterns

- ❌ Exposing `/admin/queues` publicly without auth — anyone can retry / remove jobs
- ❌ Logging full job payloads to the console (PII)
- ❌ Running Bull Board in the same process as your worker — if dashboard crashes, worker too
- ❌ Mounting at the root path `/` — collisions with app routes
- ❌ Forgetting to add new queues to the `queues: [...]` array on deployment
- ❌ Using inline credentials in code — load from env / secrets manager
