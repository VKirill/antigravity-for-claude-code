# Node.js 24 — Performance: Profiling, Workers & Heap

> Node.js 24.14.1 · TypeScript 6.0.x · Updated: 2026-05-16

---

## Worker Threads for CPU-Bound Work

The event loop is single-threaded — offload CPU-intensive tasks to workers.

```ts
// src/workers/hash.worker.ts
import { workerData, parentPort } from 'node:worker_threads';
import { createHash } from 'node:crypto';

const { data } = workerData as { data: string };
const hash = createHash('sha256').update(data).digest('hex');
parentPort!.postMessage(hash);
```

```ts
// src/shared/lib/run-in-worker.ts
import { Worker } from 'node:worker_threads';

export function runInWorker<TInput, TOutput>(
  workerPath: string,
  data: TInput,
  transferList?: Transferable[],
): Promise<TOutput> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, {
      workerData: data,
      transferList,
      // Node 24 strips TS by default — no execArgv needed for .ts workers
    });
    worker.once('message', resolve);
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
    });
  });
}
```

---

## Worker Pool — Piscina (Production)

For production worker pools use the maintained `piscina` package:

```ts
import Piscina from 'piscina';
import { fileURLToPath } from 'node:url';

const pool = new Piscina({
  filename: fileURLToPath(new URL('./workers/image-processor.worker.js', import.meta.url)),
  maxThreads: Math.max(1, navigator.hardwareConcurrency - 1), // leave 1 core for I/O
  idleTimeout: 30_000, // reclaim threads idle > 30s
});

// During shutdown
await pool.destroy();
```

---

## Event Loop — Avoid Blocking

```ts
// ❌ BAD — synchronous read + large JSON parse blocks event loop
const data = JSON.parse(fs.readFileSync('large.json', 'utf8'));

// ✅ GOOD — async read; for >1MB JSON: stream or worker
import { readFile } from 'node:fs/promises';
const raw = await readFile('large.json', 'utf8');
const data = JSON.parse(raw);

// Yield between chunks to keep I/O callbacks running
function processChunked<T>(items: T[], size: number, fn: (chunk: T[]) => void): Promise<void> {
  return new Promise((resolve) => {
    let i = 0;
    function next() {
      const chunk = items.slice(i, i + size);
      if (!chunk.length) return resolve();
      fn(chunk);
      i += size;
      setImmediate(next); // yields to I/O between chunks
    }
    next();
  });
}
```

---

## Heap Monitoring

```ts
// process.memoryUsage() — expose in health endpoint
server.get('/health', (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',
    },
  });
});

// Alert on high heap usage
setInterval(() => {
  const { heapUsed, heapTotal } = process.memoryUsage();
  if (heapUsed / heapTotal > 0.85) {
    console.warn('High heap usage', { heapUsed, heapTotal });
  }
}, 30_000).unref();
```

**Heap snapshot on demand (no restart needed):**

```ts
process.on('SIGUSR1', () => {
  const v8 = await import('node:v8');
  const filename = `heap-${Date.now()}.heapsnapshot`;
  v8.writeHeapSnapshot(filename);
  console.log('Heap snapshot written:', filename);
});
```

```bash
kill -SIGUSR1 <pid>
```

**Common leak patterns to find with heap snapshots:**
- Event listeners not removed (`emitter.listenerCount()`)
- Closures holding references in `setInterval` callbacks
- `Map`/`Set` caches without eviction
- Prisma connections not pooled properly

---

## Singleton Pattern for Expensive Resources

```ts
// DB connection pool — created once
let _pool: Pool | undefined;
function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 20, idleTimeoutMillis: 30_000 });
  }
  return _pool;
}

// Prisma singleton (prevents multiple instances under --watch)
const globalPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalPrisma.prisma = prisma;
```

---

## Performance Timing

```ts
import { performance, PerformanceObserver } from 'node:perf_hooks';

const start = performance.now();
await expensiveOperation();
console.log(`Took ${(performance.now() - start).toFixed(2)}ms`);

// Mark/measure pattern
performance.mark('db-start');
await db.user.findMany();
performance.mark('db-end');
performance.measure('db-query', 'db-start', 'db-end');

const [entry] = performance.getEntriesByName('db-query');
logger.debug('DB query', { durationMs: entry.duration });
```

---

## Clinic.js — Production Profiling

```bash
npm install -g clinic

clinic doctor    -- node dist/app/index.js   # auto-detect bottleneck
clinic flame     -- node dist/app/index.js   # CPU flamegraph
clinic bubbleprof -- node dist/app/index.js  # async operation timeline
clinic heapprofiler -- node dist/app/index.js  # memory allocation flamegraph

# Generate load while profiling
npx autocannon -c 100 -d 30 http://localhost:3000/api/users
```

---

## 0x — CPU Flamegraph

```bash
npm install -g 0x
0x -o dist/app/index.js                      # profile, open HTML report
0x --kernel-tracing dist/app/index.js        # Linux: includes kernel frames
```

---

## Built-in Profiling

```bash
node --prof dist/app/index.js                # V8 CPU profiler
node --prof-process isolate-*.log > profile.txt

node --inspect dist/app/index.js             # Chrome DevTools → chrome://inspect
```

---

## Autocannon — Load Testing

```bash
autocannon -c 100 -d 30 http://localhost:3000/api/users
autocannon -c 50 -d 20 -m POST -H "Content-Type: application/json" \
  -b '{"email":"test@test.com"}' http://localhost:3000/api/users
```

```ts
import autocannon from 'autocannon';
const result = await autocannon({ url: 'http://localhost:3000/api/users', connections: 100, duration: 30 });
if (result.latency.p99 > 500) throw new Error(`P99 latency ${result.latency.p99}ms exceeds threshold`);
```

---

## Event Loop Lag Monitoring

```ts
export function startEventLoopMonitoring(warnThresholdMs = 100): () => void {
  let lastCheck = Date.now();
  const interval = setInterval(() => {
    const now = Date.now();
    const lag = now - lastCheck - 1000;
    lastCheck = now;
    if (lag > warnThresholdMs) logger.warn('Event loop lag', { lagMs: lag });
  }, 1000);
  interval.unref();
  return () => clearInterval(interval);
}
```
