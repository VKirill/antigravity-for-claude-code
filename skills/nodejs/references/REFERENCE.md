# Node.js 24 — Reference Index

> Node.js 24.x · TypeScript 6.0.x · Verified 2026-05-16

Split into focused files. Read only the file relevant to your task.

| File | Coverage |
|---|---|
| `type-stripping.md` | Default-on TS stripping in Node 24, `--no-strip-types`, `--experimental-transform-types` (RC) for enums |
| `async-patterns.md` | Native fetch, `AbortSignal.timeout`/`.any`, Promise patterns, AsyncLocalStorage |
| `streams.md` | Web Streams API, Node↔Web bridge, TransformStream, backpressure |
| `modules.md` | ESM-first, CJS interop, `node:sqlite` (stable since v22.13/v23.4), Permission Model |
| `testing.md` | `node --test` native runner, mocking, coverage, concurrency |
| `architecture.md` | Express 5 / Fastify 5 / Hono 4, project structure, AsyncLocalStorage |
| `error-handling.md` | AppError, `error.cause`, AggregateError, unhandled rejections, sanitization |
| `shutdown.md` | SIGTERM/SIGINT, HTTP drain, PM2 `wait_ready`, k8s `preStop`, deadman |
| `workers.md` | `worker_threads`, Piscina, cluster, SharedArrayBuffer, `resourceLimits` |
| `security.md` | Helmet, CORS, rate limiting, secrets, JWT, argon2id, Node Permission Model |
| `monitoring.md` | Clinic.js, 0x, heap snapshots, event loop lag, autocannon, OpenTelemetry, Pino |
| `performance.md` | Event loop, heap monitoring, V8 profiling, benchmarking |
| **`recommended-defaults.md`** | Canonical heap / threadpool / shutdown / argon2 / OTel / Pino / PM2 / Piscina values |
| **`troubleshooting.md`** | Symptom-indexed: silent crash, leak, stall, SIGTERM timeout, ESM/CJS, ALS lost |
| **`wrong-vs-right.md`** | 6 high-stakes pairs: uncaughtException, ALS scope, JSON.parse, timing-safe, deadman, env |
| `eval-cases.md` | User-voice routing tests + Expected behavior (v3 format) |

---

## Quick Patterns

### AppError — domain errors

```ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}
```

### Retry with Exponential Backoff

```ts
const result = await retryWithBackoff(
  () => client.callApi(payload),
  { maxRetries: 3, baseDelay: 1000, maxDelay: 8000 },
);
```

### Circuit Breaker

```ts
export class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(private threshold = 5, private resetTimeout = 60_000) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.resetTimeout) this.state = 'half-open';
      else throw new Error('Circuit breaker is open');
    }
    try {
      const result = await fn();
      this.failures = 0;
      this.state = 'closed';
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = Date.now();
      if (this.failures >= this.threshold) this.state = 'open';
      throw error;
    }
  }
}
```

### Health Check

```ts
// Lightweight — load balancer
server.get('/health', (_req, reply) => {
  reply.send({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Deep — monitoring
server.get('/health/deep', async (_req, reply) => {
  const checks: Record<string, 'ok' | 'error'> = {};
  try { await prisma.$queryRaw`SELECT 1`; checks.database = 'ok'; } catch { checks.database = 'error'; }
  try { await redis.ping(); checks.redis = 'ok'; } catch { checks.redis = 'error'; }
  const allOk = Object.values(checks).every(v => v === 'ok');
  return reply.status(allOk ? 200 : 503).send({ status: allOk ? 'ok' : 'degraded', checks });
});
```

### Env Validation (Zod)

```ts
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().default(3000),
});

let cached: z.infer<typeof EnvSchema> | null = null;
export function validateEnv() {
  if (cached) return cached;
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) throw new Error(`Env validation failed: ${JSON.stringify(result.error.flatten().fieldErrors)}`);
  return (cached = result.data);
}
```
