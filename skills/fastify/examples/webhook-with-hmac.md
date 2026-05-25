# Example — Webhook receiver with raw-body + HMAC verification

Fastify 5 route that:
1. Captures the raw request body alongside the parsed JSON (needed for HMAC).
2. Verifies an `X-Signature` header (HMAC-SHA256 base64).
3. Re-fetches authoritative data from the upstream API.
4. Returns 200 within 5s; queues side-effects.

Pattern is identical for CloudPayments / Stripe / GitHub webhooks (different HMAC formula).

## Install

```bash
npm i fastify fastify-raw-body fastify-plugin
```

## `src/plugins/raw-body.ts`

```ts
import fp from 'fastify-plugin';
import rawBody from 'fastify-raw-body';

export default fp(async (app) => {
  await app.register(rawBody, {
    field: 'rawBody',
    global: false,
    encoding: 'utf8',
    runFirst: true,
    routes: ['/webhooks/cloudpayments'],
  });
});
```

## `src/routes/webhook.ts`

```ts
import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';

const HMAC_HEADER = 'content-hmac';
const SECRET = process.env.CLOUDPAYMENTS_SECRET!;

function verifyHmac(rawBody: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', SECRET).update(rawBody, 'utf8').digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.post('/webhooks/cloudpayments', {
    config: { rawBody: true },
    schema: {
      body: {
        type: 'object',
        required: ['TransactionId', 'Status'],
        properties: {
          TransactionId: { type: 'number' },
          Status: { type: 'string' },
          InvoiceId: { type: 'string' },
        },
        additionalProperties: true,
      },
      response: { 200: { type: 'object', properties: { code: { type: 'number' } } } },
    },
  }, async (req, reply) => {
    const raw = (req as unknown as { rawBody: string }).rawBody;
    const sig = req.headers[HMAC_HEADER];

    if (!verifyHmac(raw, typeof sig === 'string' ? sig : undefined)) {
      req.log.warn({ ip: req.ip }, 'rejected: bad HMAC');
      return reply.code(200).send({ code: 13 });  // CP-specific: 13 = HMAC invalid
    }

    // TODO: dedupe by TransactionId in Redis SET EX 86400 NX
    // TODO: re-fetch payment via CP API to confirm state
    // TODO: queue side-effects via BullMQ (don't block here)

    req.log.info({ tx: req.body.TransactionId }, 'webhook accepted');
    return reply.code(200).send({ code: 0 });
  });
};

export default webhookRoutes;
```

## `src/app.ts`

```ts
import Fastify from 'fastify';
import rawBodyPlugin from './plugins/raw-body.ts';
import webhookRoutes from './routes/webhook.ts';

export async function buildApp() {
  const app = Fastify({ logger: true, trustProxy: true });
  await app.register(rawBodyPlugin);
  await app.register(webhookRoutes);
  return app;
}
```

## Test (no real HMAC needed in dev)

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildApp } from '../src/app.ts';

const SECRET = 'test-secret';
process.env.CLOUDPAYMENTS_SECRET = SECRET;

describe('webhook', () => {
  it('accepts a valid HMAC', async () => {
    const app = await buildApp();
    await app.ready();

    const body = JSON.stringify({ TransactionId: 1, Status: 'Completed' });
    const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64');

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/cloudpayments',
      headers: { 'content-type': 'application/json', 'content-hmac': sig },
      payload: body,
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().code, 0);
    await app.close();
  });

  it('rejects a bad HMAC', async () => {
    const app = await buildApp();
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/cloudpayments',
      headers: { 'content-hmac': 'bogus' },
      payload: { TransactionId: 1, Status: 'Completed' },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().code, 13);
    await app.close();
  });
});
```

## Why these choices

- `fastify-raw-body` captures the body **before** JSON parsing — needed because re-serializing changes the byte sequence and breaks HMAC.
- `config: { rawBody: true }` opt-in keeps the perf cost off all other routes.
- `timingSafeEqual` prevents timing attacks on the signature comparison.
- Return **HTTP 200** with a domain-level error code (CloudPayments style) instead of 4xx — the gateway retries on non-200s, which would amplify load.
- Move side-effects to a BullMQ queue; the webhook handler must return inside the gateway's timeout (typically 5–30s).
