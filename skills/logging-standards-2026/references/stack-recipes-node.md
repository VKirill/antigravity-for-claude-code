# Node.js logging recipes — Pino

Pino is the recommended logger for Node in 2026: fast (lowest overhead of major loggers), structured JSON by default, built-in redaction, transport ecosystem. Works in Fastify (built-in), Express, Hono, Koa, raw Node.

## Install

```bash
npm install pino
# dev only:
npm install -D pino-pretty
```

## Base config

See [../templates/pino-base-config.ts.template](../templates/pino-base-config.ts.template) for the full template.

Highlights:

```ts
import pino from 'pino';
import { requestContext } from './context.js';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  // Auto-inject correlation
  mixin() {
    const ctx = requestContext.getStore();
    return ctx ? { request_id: ctx.request_id, user_id: ctx.user_id } : {};
  },
  // Redaction
  redact: {
    paths: [
      'req.headers.authorization', 'req.headers.cookie',
      '*.password', '*.token', '*.apiKey', '*.api_key', '*.secret',
      '*.creditCard', '*.cvv',
    ],
    censor: '[REDACTED]',
  },
  // Pretty in dev
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l' } }
    : undefined,
  // Base context
  base: {
    service: process.env.SERVICE_NAME ?? 'unknown',
    env: process.env.NODE_ENV ?? 'development',
    version: process.env.SERVICE_VERSION,
  },
  // Better timestamp format
  timestamp: pino.stdTimeFunctions.isoTime,
  // ISO format for level (not just numbers)
  formatters: {
    level: (label) => ({ level: label }),
  },
});
```

## AsyncLocalStorage for request context

```ts
// context.ts
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

type Context = { request_id: string; user_id?: string };
export const requestContext = new AsyncLocalStorage<Context>();

// Express middleware
export function withRequestId(req, res, next) {
  const request_id = req.headers['x-request-id'] ?? randomUUID();
  res.setHeader('x-request-id', request_id);
  requestContext.run({ request_id }, () => next());
}
```

## Fastify built-in

Fastify uses Pino natively:

```ts
import Fastify from 'fastify';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    redact: ['req.headers.authorization', '*.password'],
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty' } : undefined,
  },
  genReqId: () => crypto.randomUUID(),  // auto request_id
});

app.get('/api/users/:id', async (req, res) => {
  req.log.info({ msg: 'user.fetched', user_id: req.params.id });
  return { id: req.params.id };
});
```

Fastify automatically includes `req.id` (= request ID) on every `req.log` call. No middleware needed.

## Hono

```ts
import { Hono } from 'hono';
import { logger } from './logger.js';

const app = new Hono();

app.use('*', async (c, next) => {
  const request_id = c.req.header('x-request-id') ?? crypto.randomUUID();
  c.set('logger', logger.child({ request_id }));
  c.header('x-request-id', request_id);
  await next();
});

app.get('/api/users/:id', (c) => {
  c.var.logger.info({ msg: 'user.fetched', user_id: c.req.param('id') });
  return c.json({ id: c.req.param('id') });
});
```

## Express middleware

```ts
import express from 'express';
import pinoHttp from 'pino-http';
import { logger } from './logger.js';

const app = express();

app.use(pinoHttp({
  logger,
  customLogLevel: (req, res, err) => {
    if (err) return 'error';
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // Don't log every successful response body
  customSuccessMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
}));
```

## Error serialization

```ts
import pino from 'pino';

const logger = pino({
  serializers: {
    err: pino.stdSerializers.err,  // serializes Error to { type, message, stack }
  },
});

try {
  await processOrder(...);
} catch (err) {
  logger.error({ err, msg: 'order.failed', order_id: id });
  // Output includes: err.type, err.message, err.stack
}
```

Key gotcha: pass `err` (not `error`) when using stdSerializers.

## Child loggers for scoped context

```ts
const log = logger.child({ component: 'auth' });
log.info({ msg: 'login.attempted' });
// Output includes component: 'auth' automatically

// Nest further
const userLog = log.child({ user_id: 'abc123' });
userLog.info({ msg: 'login.succeeded' });
// Output includes component: 'auth' + user_id: 'abc123'
```

## Bullmq worker logging

```ts
import { Worker } from 'bullmq';

const worker = new Worker('emails', async (job) => {
  const log = logger.child({
    job_id: job.id,
    queue: 'emails',
    attempt: job.attemptsMade + 1,
    request_id: job.data._correlation?.request_id,
  });

  log.info({ msg: 'job.started' });
  const t0 = Date.now();
  try {
    await sendEmail(job.data);
    log.info({ msg: 'job.completed', duration_ms: Date.now() - t0 });
  } catch (err) {
    log.error({ err, msg: 'job.failed', duration_ms: Date.now() - t0 });
    throw err;  // re-throw so bullmq handles retry
  }
});
```

## Production output to PM2

PM2 captures stdout/stderr. Pino writes JSON to stdout. PM2 stores in `~/.pm2/logs/*.log`. Combined with `pm2-logrotate`:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
```

For shipping to Grafana Loki: use Promtail / Vector / Fluent Bit reading `~/.pm2/logs/*.log`. See [log-aggregation.md](log-aggregation.md).

## Don'ts

- ❌ Multiple loggers in one app (`winston` for one module, `pino` for another)
- ❌ `console.log` mixed with `logger.info` in same code
- ❌ Logging in tight loops without sampling
- ❌ Logging full `req.body` without redaction config covering all fields
- ❌ Synchronous file appender (blocks event loop); Pino's default async transport is correct
- ❌ Logging at TRACE in production unless investigating a specific incident

## Testing logger output

```ts
import pino from 'pino';
import { Writable } from 'node:stream';

test('logger redacts password', () => {
  const captured: string[] = [];
  const sink = new Writable({
    write(chunk, _enc, cb) { captured.push(chunk.toString()); cb(); }
  });

  const logger = pino({ redact: ['*.password'] }, sink);
  logger.info({ user: { id: 1, password: 'shh' } });

  expect(captured.join('')).not.toContain('shh');
  expect(captured.join('')).toContain('[Redacted]');
});
```

## Migration from winston / bunyan

Both are still alive but Pino is now standard. Migration is mechanical: replace logger import + adjust method signatures. Winston `logger.info('message', meta)` → Pino `logger.info(meta, 'message')` (note argument order). Use codemod (`jscodeshift`) for large codebases.
