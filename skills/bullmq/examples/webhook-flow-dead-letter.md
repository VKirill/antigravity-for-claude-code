# Example — Payment webhook → BullMQ flow with retries + DLQ

A CloudPayments / YooKassa-style webhook arrives. The handler must:
1. Return 200 OK quickly (gateway times out at 30s).
2. Reliably do 3 side-effects:
   - Update payment DB row
   - Fulfill the order (digital delivery, email, etc.)
   - Notify the user
3. Retry transient failures; surface permanent failures to a DLQ for human review.

## Design

```
HTTP POST /webhooks/cloudpayments
    ↓
verify HMAC, dedupe by TransactionId
    ↓
enqueue parent flow → return 200 OK immediately
    ↓
parent: notify-user
  ├── child: update-payment-row
  └── child: fulfill-order
```

Parent runs only after both children complete. If any permanently fails, the parent fails too, and the failure cascades to the DLQ.

## Code

### Queues setup

```ts
// src/queues.ts
import { Queue, Worker, QueueEvents, FlowProducer, type ConnectionOptions } from 'bullmq';

const connection: ConnectionOptions = {
  host: process.env.REDIS_HOST,
  port: 6379,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
};

const defaultJobOpts = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

export const paymentsQueue   = new Queue('payments',   { connection, defaultJobOptions: defaultJobOpts });
export const fulfillQueue    = new Queue('fulfillment', { connection, defaultJobOptions: defaultJobOpts });
export const notifyQueue     = new Queue('notify',     { connection, defaultJobOptions: defaultJobOpts });
export const dlq             = new Queue('dlq',        { connection, defaultJobOptions: { removeOnComplete: false, removeOnFail: false } });

export const flow = new FlowProducer({ connection });

export { connection };
```

### Webhook receiver (Fastify)

```ts
// src/routes/webhook.ts
import crypto from 'node:crypto';
import { flow, paymentsQueue } from '../queues';
import { redis } from '../redis';

app.post('/webhooks/cloudpayments', async (req, reply) => {
  if (!verifyHmac(req.rawBody, req.headers['content-hmac'])) {
    return reply.code(200).send({ code: 13 });
  }

  const { TransactionId, Status, Amount, AccountId } = req.body as Record<string, string>;

  // Dedupe — same TransactionId within 24h is idempotent
  const dedupKey = `webhook:cp:${TransactionId}`;
  const isNew = await redis.set(dedupKey, '1', 'NX', 'EX', 86400);
  if (!isNew) {
    return reply.code(200).send({ code: 0, dedup: true });
  }

  if (Status !== 'Completed') {
    return reply.code(200).send({ code: 0 });
  }

  await flow.add({
    name: 'notify-user',
    queueName: 'notify',
    data: { userId: AccountId, paymentId: TransactionId },
    opts: {
      jobId: `notify-${TransactionId}`,
      ...defaultJobOpts,
    },
    children: [
      {
        name: 'update-payment-row',
        queueName: 'payments',
        data: { TransactionId, AccountId, Amount: Number(Amount) },
        opts: { jobId: `payment-${TransactionId}`, ...defaultJobOpts },
      },
      {
        name: 'fulfill-order',
        queueName: 'fulfillment',
        data: { TransactionId, AccountId },
        opts: { jobId: `fulfill-${TransactionId}`, ...defaultJobOpts },
      },
    ],
  });

  return reply.code(200).send({ code: 0 });
});
```

### Workers

```ts
// src/workers/payments.worker.ts
import { Worker } from 'bullmq';
import { connection } from '../queues';
import { z } from 'zod';
import { prisma } from '../prisma';

const PaymentSchema = z.object({
  TransactionId: z.string(),
  AccountId: z.string(),
  Amount: z.number().positive(),
});

new Worker('payments', async (job) => {
  const data = PaymentSchema.parse(job.data);
  await prisma.payment.upsert({
    where: { providerTxId: data.TransactionId },
    create: {
      providerTxId: data.TransactionId,
      userId: data.AccountId,
      amount: data.Amount,
      status: 'PAID',
      paidAt: new Date(),
    },
    update: { status: 'PAID', paidAt: new Date() },
  });
  return { ok: true };
}, { connection, concurrency: 20 });
```

```ts
// src/workers/fulfillment.worker.ts
new Worker('fulfillment', async (job) => {
  // Grant digital product, mark license, etc.
  await prisma.entitlement.create({
    data: { userId: job.data.AccountId, sku: 'pro-monthly', grantedAt: new Date() },
  });
  return { ok: true };
}, { connection, concurrency: 10 });
```

```ts
// src/workers/notify.worker.ts
new Worker('notify', async (job) => {
  const childrenResults = await job.getChildrenValues();
  console.log('parent sees children', childrenResults);
  await sendEmail(job.data.userId, 'Payment received');
  return { sent: true };
}, { connection, concurrency: 30 });
```

### DLQ wiring

```ts
// src/workers/dlq-router.ts
import { QueueEvents } from 'bullmq';
import { connection, dlq, paymentsQueue, fulfillQueue, notifyQueue } from '../queues';

const queueMap = {
  payments: paymentsQueue,
  fulfillment: fulfillQueue,
  notify: notifyQueue,
};

for (const [name, q] of Object.entries(queueMap)) {
  const events = new QueueEvents(name, { connection });
  events.on('failed', async ({ jobId, failedReason }) => {
    const job = await q.getJob(jobId);
    if (!job) return;
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return;   // still retrying

    await dlq.add(`failed:${name}`, {
      queue: name,
      jobName: job.name,
      jobId: job.id,
      data: job.data,
      failedReason,
      stacktrace: job.stacktrace,
      attemptsMade: job.attemptsMade,
      failedAt: Date.now(),
    });

    // Alert Slack / PagerDuty
    console.error(`[DLQ] ${name} job ${jobId} permanently failed:`, failedReason);
  });
}
```

### Replay tool (operator UI)

```ts
async function replayDeadJob(dlqJobId: string) {
  const dead = await dlq.getJob(dlqJobId);
  if (!dead) throw new Error('not found');

  const originalQueue = queueMap[dead.data.queue as keyof typeof queueMap];
  await originalQueue.add(dead.data.jobName, dead.data.data, {
    jobId: `replay-${dead.data.jobId}-${Date.now()}`,
    attempts: 3,
  });
  await dead.remove();
}
```

## Why this design

- **Webhook returns 200 quickly** — gateway never times out, even if downstream is slow
- **Idempotent at three layers**: HMAC dedup at webhook (Redis SET NX), `jobId` in BullMQ (within active+waiting+delayed), and `upsert` in Prisma (DB-level final dedup)
- **Children run in parallel** — `update-payment-row` and `fulfill-order` are independent
- **Parent waits** — `notify-user` only runs once both children succeed (avoid sending "thanks for paying" before the row exists in DB)
- **DLQ on permanent failure** — operators see what didn't work; can replay or escalate
- **Retries with backoff** — transient errors (DB blip, email service hiccup) auto-recover
- **Validation at worker entry** — corrupt payload fails fast, not mid-handler

## Anti-patterns avoided

- ❌ Doing all three side-effects inside the webhook handler (timeout risk)
- ❌ Single job for all three steps (one transient failure retries the whole chain)
- ❌ No DLQ (silent permanent failures)
- ❌ Forgetting `jobId` (duplicate work on webhook retry)
- ❌ No validation (worker process crash on bad payload)
- ❌ `attempts: 1` (one network blip kills the flow)
