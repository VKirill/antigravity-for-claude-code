# Node.js 24 — Performance Profiling & Monitoring

> Node.js 24.14.1 | Updated: 2026-05-15

---

## Clinic.js — Production Profiling

```bash
# Install globally
npm install -g clinic

# Doctor: auto-detect bottleneck type (I/O, CPU, memory)
clinic doctor -- node dist/app/index.js

# Flame: CPU flamegraph (wraps 0x)
clinic flame -- node dist/app/index.js

# Bubbleprof: async operation timeline
clinic bubbleprof -- node dist/app/index.js

# HeapProfiler: memory allocation flamegraph
clinic heapprofiler -- node dist/app/index.js
```

Run load during profiling:

```bash
# Terminal 1: start with profiling
clinic flame -- node dist/app/index.js

# Terminal 2: generate load
npx autocannon -c 100 -d 30 http://localhost:3000/api/users

# Ctrl+C clinic → opens HTML report automatically
```

---

## 0x — CPU Flamegraph

```bash
npm install -g 0x

# Profile for 30s under load
0x -o dist/app/index.js

# With custom V8 flags
0x --kernel-tracing dist/app/index.js  # Linux: includes kernel frames
```

---

## Node.js Built-in Profiling

```bash
# V8 CPU profiler (no extra tools)
node --prof dist/app/index.js
node --prof-process isolate-*.log > profile.txt

# Inspector protocol — connect Chrome DevTools
node --inspect dist/app/index.js
# Open: chrome://inspect

# Heap snapshot on demand
node --inspect dist/app/index.js
# In DevTools: Memory tab → Take Heap Snapshot
```

---

## Memory Leak Detection

```ts
// src/shared/monitoring/memory.ts
export function startMemoryMonitoring(intervalMs = 60_000): NodeJS.Timeout {
  return setInterval(() => {
    const mem = process.memoryUsage();
    logger.info('Memory usage', {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
      external: Math.round(mem.external / 1024 / 1024) + 'MB',
    });

    // Alert if heap exceeds threshold
    const heapMB = mem.heapUsed / 1024 / 1024;
    if (heapMB > 400) {
      logger.warn('High memory usage', { heapMB: Math.round(heapMB) });
    }
  }, intervalMs);
}
```

```bash
# Heap snapshot via signal (no restart needed)
# Add to app:
process.on('SIGUSR1', () => {
  const v8 = require('v8');
  const filename = `heap-${Date.now()}.heapsnapshot`;
  v8.writeHeapSnapshot(filename);
  console.log('Heap snapshot written:', filename);
});

# Trigger from shell:
kill -SIGUSR1 <pid>
```

**Common leak patterns to check with heap snapshots:**
- Event listeners not removed (check `emitter.listenerCount()`)
- Closures holding references in `setInterval` callbacks
- `Map`/`Set` used as caches without eviction
- Prisma connections not pooled properly

---

## Performance Hooks — Built-in Timing

```ts
import { performance, PerformanceObserver } from 'node:perf_hooks';

// Mark and measure
performance.mark('db-start');
await db.user.findMany();
performance.mark('db-end');
performance.measure('db-query', 'db-start', 'db-end');

const [entry] = performance.getEntriesByName('db-query');
logger.debug('DB query duration', { durationMs: entry.duration });

// Observe all measures
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    logger.debug('Performance', { name: entry.name, duration: entry.duration });
  }
});
observer.observe({ type: 'measure', buffered: false });

// Cleanup
observer.disconnect();
performance.clearMarks();
performance.clearMeasures();
```

---

## Event Loop Monitoring — Lag Detection

```ts
// src/shared/monitoring/event-loop.ts
// Detect event loop lag — high lag = blocked loop (CPU or sync I/O)
export function startEventLoopMonitoring(warnThresholdMs = 100): () => void {
  let lastCheck = Date.now();

  const interval = setInterval(() => {
    const now = Date.now();
    const lag = now - lastCheck - 1000; // expected 1000ms, actual gap
    lastCheck = now;

    if (lag > warnThresholdMs) {
      logger.warn('Event loop lag detected', { lagMs: lag });
    }
  }, 1000);

  interval.unref();
  return () => clearInterval(interval);
}
```

For production use `@pm2/io` (PM2 metrics) or `prom-client` + Grafana:

```ts
import { Histogram, Gauge, register } from 'prom-client';

const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

const eventLoopLag = new Gauge({
  name: 'nodejs_event_loop_lag_seconds',
  help: 'Event loop lag',
  collect() {
    // filled by monitoring interval
  },
});

// Expose metrics endpoint
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});
```

---

## Autocannon — Load Testing

```bash
npm install -g autocannon

# Basic: 100 connections, 30 seconds
autocannon -c 100 -d 30 http://localhost:3000/api/users

# Pipeline (keep-alive reuse)
autocannon -c 100 -d 30 -p 10 http://localhost:3000/api/users

# POST with body
autocannon -c 50 -d 20 \
  -m POST \
  -H "Content-Type: application/json" \
  -b '{"email":"test@test.com"}' \
  http://localhost:3000/api/users

# Compare two endpoints
autocannon compare baseline.json current.json
```

```ts
// Programmatic (for CI benchmarks)
import autocannon from 'autocannon';

const result = await autocannon({
  url: 'http://localhost:3000/api/users',
  connections: 100,
  duration: 30,
});

// Fail CI if P99 > 500ms
if (result.latency.p99 > 500) {
  throw new Error(`P99 latency ${result.latency.p99}ms exceeds 500ms threshold`);
}
```

---

## OpenTelemetry — Distributed Tracing

```ts
// src/instrumentation.ts — must be imported BEFORE app code
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: process.env.SERVICE_NAME ?? 'api',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false }, // too noisy
    }),
  ],
});

sdk.start();

// Graceful shutdown
process.once('SIGTERM', () => sdk.shutdown());
```

```bash
# Node 24 — load instrumentation before app
node --require ./dist/instrumentation.js dist/app/index.js

# Or with ESM:
node --import ./dist/instrumentation.js dist/app/index.js
```

---

## Structured Logging — Pino

```ts
// src/shared/lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  // JSON in production, pretty in dev
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true, ignore: 'pid,hostname' } }
    : undefined,
  formatters: {
    level: (label) => ({ level: label }), // use string level names
  },
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  base: {
    service: process.env.SERVICE_NAME ?? 'api',
    env: process.env.NODE_ENV,
  },
  redact: {
    paths: ['req.headers.authorization', '*.password', '*.token', '*.secret'],
    censor: '[REDACTED]',
  },
});

// Child logger with request context
export function requestLogger(requestId: string) {
  return logger.child({ requestId });
}
```
