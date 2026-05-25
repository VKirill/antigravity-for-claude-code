# Node.js 24 — Worker Threads vs Cluster

> Node.js 24.14.1 | Updated: 2026-05-15

---

## Decision Matrix

| Use case | Solution |
|---|---|
| I/O-bound (DB, HTTP, filesystem) | Single process + async — no extra complexity |
| CPU-bound isolated task | `worker_threads` — isolated V8 + shared memory |
| Scale HTTP throughput across CPUs | `cluster` or PM2 `exec_mode: cluster` |
| Long-running background processing | BullMQ workers (separate Node process) |
| Sub-process isolation (untrusted code) | `child_process.spawn` |

**Node 24:** `worker_threads` fully stable, `--experimental-vm-modules` stable, SharedArrayBuffer available without `--experimental-shared-memory`.

---

## worker_threads — CPU-Bound Tasks

```ts
// src/workers/image-processor.worker.ts
import { parentPort, workerData, isMainThread } from 'node:worker_threads';
import sharp from 'sharp';

if (isMainThread) throw new Error('Must run in worker thread');

interface WorkerInput {
  buffer: ArrayBuffer;
  width: number;
  height: number;
}

interface WorkerOutput {
  buffer: ArrayBuffer;
  format: string;
}

const { buffer, width, height } = workerData as WorkerInput;

const input = Buffer.from(buffer);
const result = await sharp(input).resize(width, height).webp({ quality: 85 }).toBuffer();

parentPort!.postMessage(
  { buffer: result.buffer, format: 'webp' } satisfies WorkerOutput,
  [result.buffer], // transfer — zero-copy, avoids serialization
);
```

```ts
// src/shared/lib/run-in-worker.ts
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

export function runInWorker<TInput, TOutput>(
  workerPath: string,
  data: TInput,
  transferList?: Transferable[],
): Promise<TOutput> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, { workerData: data, transferList });
    worker.once('message', resolve);
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
    });
  });
}

// Usage
const { buffer } = await runInWorker<WorkerInput, WorkerOutput>(
  fileURLToPath(new URL('./workers/image-processor.worker.js', import.meta.url)),
  { buffer: inputBuffer.buffer, width: 800, height: 600 },
  [inputBuffer.buffer],
);
```

---

## Worker Pool — Reuse Threads for Throughput

Creating a worker per task is expensive. Pool workers for high-throughput scenarios:

```ts
// src/shared/lib/worker-pool.ts
import { Worker } from 'node:worker_threads';
import { EventEmitter } from 'node:events';

interface PoolTask<T> {
  data: unknown;
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
}

export class WorkerPool<TInput, TOutput> {
  private readonly workers: Worker[] = [];
  private readonly queue: PoolTask<TOutput>[] = [];
  private readonly idle: Worker[] = [];

  constructor(
    private readonly workerPath: string,
    private readonly size: number,
  ) {
    for (let i = 0; i < size; i++) {
      this.addWorker();
    }
  }

  private addWorker(): void {
    const worker = new Worker(this.workerPath);
    this.workers.push(worker);

    const runNext = () => {
      const task = this.queue.shift();
      if (!task) {
        this.idle.push(worker);
        return;
      }
      worker.postMessage(task.data);
    };

    worker.on('message', (result: TOutput) => {
      const task = this.queue[0]; // current task reference needed
      // simpler: use a Map<worker, task>
      runNext();
    });
    worker.on('error', (err) => { /* reject current task */ });
    this.idle.push(worker);
  }

  run(data: TInput): Promise<TOutput> {
    return new Promise((resolve, reject) => {
      const worker = this.idle.pop();
      if (worker) {
        // dispatch immediately
        worker.postMessage(data);
      } else {
        this.queue.push({ data, resolve, reject });
      }
    });
  }

  async destroy(): Promise<void> {
    await Promise.all(this.workers.map(w => w.terminate()));
  }
}
```

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

## Cluster Mode — HTTP Throughput

For HTTP servers, PM2 `exec_mode: cluster` is usually simpler than `node:cluster` directly. Use `node:cluster` when you need custom primary logic:

```ts
// src/cluster.ts
import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';
import process from 'node:process';

const NUM_WORKERS = availableParallelism(); // Node 19+, more accurate than os.cpus()

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} — forking ${NUM_WORKERS} workers`);

  for (let i = 0; i < NUM_WORKERS; i++) {
    cluster.fork();
  }

  // Restart crashed workers
  cluster.on('exit', (worker, code, signal) => {
    if (signal !== 'SIGTERM') { // expected shutdown — don't restart
      console.error(`Worker ${worker.process.pid} died (${signal ?? code}) — restarting`);
      cluster.fork();
    }
  });

  // Graceful shutdown — signal all workers
  process.once('SIGTERM', () => {
    for (const worker of Object.values(cluster.workers ?? {})) {
      worker?.send('shutdown');
    }
  });
} else {
  // Worker: run the actual server
  await import('./app/index.js');
}
```

---

## SharedArrayBuffer — Zero-Copy Communication

```ts
// Shared state between main and workers (e.g. feature flags, rate limit counters)
const sharedBuffer = new SharedArrayBuffer(4); // 4 bytes = Int32
const counter = new Int32Array(sharedBuffer);

// Main thread: pass to worker
new Worker('./worker.js', {
  workerData: { sharedBuffer },
});

// Atomic operations — thread-safe without locks
Atomics.add(counter, 0, 1);              // increment
const value = Atomics.load(counter, 0);  // read
Atomics.compareExchange(counter, 0, expected, desired); // CAS

// Synchronization (use sparingly — blocks the thread)
Atomics.wait(counter, 0, 0, 1000); // wait until counter[0] != 0, 1s timeout
Atomics.notify(counter, 0, 1);     // wake 1 waiting thread
```

---

## async_hooks — Context Propagation

`AsyncLocalStorage` (built on `async_hooks`) is the production pattern for tracing and context propagation. Avoid raw `async_hooks` API directly — it has performance overhead and is complex.

```ts
import { AsyncLocalStorage, AsyncResource } from 'node:async_hooks';

// EventEmitter + async context fix
// By default, EventEmitter callbacks lose async context
class ContextualEventEmitter extends EventEmitter {
  emit(event: string, ...args: unknown[]): boolean {
    const resource = new AsyncResource('ContextualEventEmitter');
    return resource.runInAsyncScope(() => super.emit(event, ...args));
  }
}

// AsyncResource — bind a callback to the current async context
const resource = AsyncResource.bind(callback); // Node 17+
// Equivalent: new AsyncResource('type').bind(callback)
```

For distributed tracing across services, use OpenTelemetry — it wraps `AsyncLocalStorage` with trace context propagation:

```ts
import { context, trace, propagation } from '@opentelemetry/api';

// Inject trace context into outgoing HTTP headers
const headers: Record<string, string> = {};
propagation.inject(context.active(), headers);

// Extract from incoming request
const ctx = propagation.extract(context.active(), req.headers);
const span = trace.getTracer('api').startSpan('operation', {}, ctx);
```
