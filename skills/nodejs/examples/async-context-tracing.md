# AsyncLocalStorage + Pino + OpenTelemetry: Request Context Propagation

## Scenario

Every log line, every DB query trace, and every outbound HTTP span must carry the same `requestId` (and optionally `userId`, `traceId`) — without passing it through every function parameter.

The pattern: `AsyncLocalStorage` stores context at request entry; Pino's `mixin` reads it for every log; OpenTelemetry auto-instrumentation hooks the same storage for spans.

---

## Step 1 — Create the context store

```ts
// src/shared/lib/context.ts
import { AsyncLocalStorage } from 'node:async_hooks'

export interface RequestContext {
  requestId: string
  traceId?: string     // set by OTel instrumentation
  spanId?: string
  userId?: string      // set after auth middleware
}

// Single instance — reused across the entire process lifetime
export const contextStorage = new AsyncLocalStorage<RequestContext>()

/** Run callback inside a context. Returns the callback's return value. */
export function withContext<T>(
  ctx: RequestContext,
  fn: () => T,
): T {
  return contextStorage.run(ctx, fn)
}

/** Get current context. Returns empty object if called outside a request. */
export function getContext(): Partial<RequestContext> {
  return contextStorage.getStore() ?? {}
}

/** Merge fields into the current context (e.g., after auth resolves userId). */
export function setContextField<K extends keyof RequestContext>(
  key: K,
  value: RequestContext[K],
): void {
  const store = contextStorage.getStore()
  if (store) store[key] = value
}
```

## Step 2 — Fastify plugin: attach context at request entry

```ts
// src/shared/middleware/context.plugin.ts
import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { withContext } from '../lib/context.js'
import { randomUUID } from 'node:crypto'

export default fp(async function contextPlugin(app: FastifyInstance) {
  app.addHook('onRequest', (request, _reply, done) => {
    // Prefer incoming trace header (from upstream service or load balancer)
    const requestId = (request.headers['x-request-id'] as string) ?? randomUUID()

    // Attach to Fastify request object for frameworks that use req.id
    ;(request as any).requestId = requestId

    // Wrap the rest of the request lifecycle in the context
    // AsyncLocalStorage.run() propagates through all awaits in the chain
    withContext({ requestId }, done)
  })
})
```

**Key point**: `AsyncLocalStorage.run(ctx, done)` means every `await` inside the Fastify lifecycle from this hook forward will have access to `ctx` via `contextStorage.getStore()`. This works across:
- `await db.query(...)` (Prisma, pg, drizzle)
- `await redis.get(...)` 
- `await fetch(...)` (outbound HTTP)
- BullMQ job processors (when you pass the context in the job payload and re-run it)

## Step 3 — Pino logger reads context via mixin

```ts
// src/shared/lib/logger.ts
import pino from 'pino'
import { getContext } from './context.js'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z' } }
    : undefined,
  redact: {
    paths: ['req.headers.authorization', '*.password', '*.secret', '*.token'],
    censor: '[REDACTED]',
  },
  // mixin is called for EVERY log line — injects context fields automatically
  mixin() {
    const ctx = getContext()
    return {
      ...(ctx.requestId && { requestId: ctx.requestId }),
      ...(ctx.traceId   && { traceId: ctx.traceId }),
      ...(ctx.userId    && { userId: ctx.userId }),
    }
  },
  mixinMergeStrategy: 'merge',  // context fields merge into log object, not override
})
```

Now any `logger.info('message')` anywhere in the codebase automatically includes `requestId` if called within a request context — even deep in a repository method.

## Step 4 — OpenTelemetry wires into the same context

OTel Node SDK auto-instrumentation reads the current span's trace/span IDs. To bridge them into our context store for Pino:

```ts
// src/app/instrumentation.ts  (loaded via --import flag)
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { context, trace } from '@opentelemetry/api'
import { contextStorage } from '../shared/lib/context.js'

// Bridge OTel span context into AsyncLocalStorage on every new span
// (done by hooking into the active span start)
function bridgeOtelToContext(): void {
  const activeSpan = trace.getActiveSpan()
  if (!activeSpan) return
  const spanContext = activeSpan.spanContext()
  const store = contextStorage.getStore()
  if (store) {
    store.traceId = spanContext.traceId
    store.spanId  = spanContext.spanId
  }
}

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        requestHook: (_span, _info) => {
          bridgeOtelToContext()
        },
      },
      '@opentelemetry/instrumentation-fastify': { enabled: true },
      '@opentelemetry/instrumentation-pg': { enabled: true },
      '@opentelemetry/instrumentation-redis-4': { enabled: true },
    }),
  ],
})

sdk.start()

process.on('SIGTERM', () => {
  sdk.shutdown().catch(console.error)
})
```

## Step 5 — Usage in a service method

```ts
// src/features/users/users.service.ts
import { logger } from '../../shared/lib/logger.js'
import { setContextField } from '../../shared/lib/context.js'
import type { UsersRepository } from './users.repository.js'

export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  async getUser(id: string, callerId: string): Promise<User> {
    // Enrich context once per service call — every subsequent log includes userId
    setContextField('userId', callerId)

    logger.info({ targetUserId: id }, 'Fetching user')  // includes requestId + userId

    const user = await this.repo.findById(id)  // DB span also carries traceId

    if (!user) {
      logger.warn({ targetUserId: id }, 'User not found')
      throw new NotFoundError('User', id)
    }

    logger.info({ targetUserId: id }, 'User fetched successfully')
    return user
  }
}
```

## Resulting log output (JSON, production)

```json
{"level":"info","time":1716000000000,"requestId":"a3b4c5d6","traceId":"4bf92f3577b34da6a3ce929d0e0e4736","spanId":"00f067aa0ba902b7","userId":"usr_01HXM9FPRT","targetUserId":"usr_01HXM9FPRT","msg":"Fetching user"}
{"level":"info","time":1716000000012,"requestId":"a3b4c5d6","traceId":"4bf92f3577b34da6a3ce929d0e0e4736","spanId":"00f067aa0ba902b7","userId":"usr_01HXM9FPRT","targetUserId":"usr_01HXM9FPRT","msg":"User fetched successfully"}
```

Every field appears automatically — `requestId` from the context store, `traceId`/`spanId` from OTel bridge, `userId` from the service.

## Verification

```bash
# 1. Start server
node --import ./dist/app/instrumentation.js src/app/index.ts

# 2. Make a request
curl -H "x-request-id: test-req-123" http://localhost:3000/api/users/usr_01HXM9FPRT

# 3. Confirm requestId appears in every log line for that request
# 4. Check OTel collector — trace should show requestId in span attributes
```

## Pitfalls

- **Worker threads**: `AsyncLocalStorage` does NOT propagate into `worker_threads`. Pass context explicitly in the `workerData` argument.
- **BullMQ processors**: Job processors run in a different async context from the HTTP request. Include `requestId` in the job payload and call `withContext({ requestId: job.data.requestId }, processJob)` inside the processor.
- **Third-party libraries**: Libraries that use `setTimeout`/`setImmediate` internally propagate the async context correctly. Libraries using libuv threadpool callbacks (some native modules) may not.
