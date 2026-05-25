# Node.js 24 — Graceful Shutdown & Signal Handling

> Node.js 24.14.1 | Updated: 2026-05-15

---

## Signal Handling — SIGTERM / SIGINT

```ts
// src/app/index.ts
let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) return; // guard against double signal
  isShuttingDown = true;

  logger.info('Shutdown initiated', { signal });
  const deadline = setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 30_000); // 30s hard limit
  deadline.unref(); // don't keep process alive for this timer

  try {
    // Ordered teardown — reverse of startup order
    await stopAcceptingTraffic();   // 1. HTTP server stop
    await drainInFlightRequests();  // 2. Wait for active requests
    await stopWorkers();            // 3. Background jobs
    await closeDatabase();          // 4. DB connections
    await closeCache();             // 5. Redis
    clearTimeout(deadline);
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', sanitizeError(error));
    process.exit(1);
  }
};

// process.once — single registration prevents double-shutdown
process.once('SIGTERM', () => shutdown('SIGTERM')); // Kubernetes, PM2 stop
process.once('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C
process.once('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
```

---

## HTTP Server — Stop Accepting New Connections

```ts
import { createServer } from 'node:http';

const server = createServer(app);
const connections = new Map<string, import('node:net').Socket>();

// Track active connections for forceful close if needed
server.on('connection', (socket) => {
  const id = `${socket.remoteAddress}:${socket.remotePort}`;
  connections.set(id, socket);
  socket.once('close', () => connections.delete(id));
});

async function stopAcceptingTraffic(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
    // server.close() stops new connections but doesn't destroy keep-alive ones
  });
}

async function drainInFlightRequests(timeoutMs = 10_000): Promise<void> {
  // After server.close(), wait for active requests to complete
  // For keep-alive connections: close them after current request finishes
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      // Force-close remaining connections after timeout
      for (const socket of connections.values()) socket.destroy();
      resolve();
    }, timeoutMs);
    timer.unref();

    // If no active connections, resolve immediately
    if (connections.size === 0) {
      clearTimeout(timer);
      resolve();
    }
  });
}
```

**Fastify equivalent:**

```ts
const fastify = Fastify();

async function stopAcceptingTraffic() {
  await fastify.close(); // Fastify handles connection draining internally
}
```

---

## Health Check — Kubernetes Probes

```ts
// Readiness: reject traffic when shutting down
app.get('/health/ready', (req, res) => {
  if (isShuttingDown) {
    res.status(503).json({ status: 'shutting_down' });
    return;
  }
  res.json({ status: 'ready', timestamp: new Date().toISOString() });
});

// Liveness: just confirms process is alive
app.get('/health/live', (_req, res) => {
  res.json({ status: 'alive' });
});

// Startup: confirms all dependencies are connected
app.get('/health/startup', async (_req, res) => {
  try {
    await Promise.all([
      db.$queryRaw`SELECT 1`,
      redis.ping(),
    ]);
    res.json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not_ready', error: sanitizeError(error) });
  }
});
```

---

## PM2 Configuration

```js
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'api',
    script: './dist/app/index.js',
    instances: 'max',        // CPU count for cluster mode
    exec_mode: 'cluster',
    kill_timeout: 30000,     // wait 30s for graceful shutdown
    listen_timeout: 10000,   // max time to boot before PM2 considers it failed
    wait_ready: true,        // wait for process.send('ready') signal
    max_memory_restart: '512M',
    env_production: {
      NODE_ENV: 'production',
      NODE_OPTIONS: '--max-old-space-size=450', // under PM2 memory limit
    },
  }],
};
```

Signal PM2 when ready:

```ts
// At end of main() after server is listening
if (process.send) {
  process.send('ready'); // PM2 wait_ready handshake
}
```

---

## Kubernetes — SIGTERM Delay Pattern

Kubernetes sends SIGTERM then waits `terminationGracePeriodSeconds` before SIGKILL. Load balancer may continue routing for a few seconds after SIGTERM — add a pre-shutdown delay:

```ts
const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info('SIGTERM received — waiting for load balancer drain', { signal });

  // Give load balancer 5s to stop routing new requests
  // (readiness probe returns 503 immediately, LB propagation takes ~5s)
  await new Promise(resolve => setTimeout(resolve, 5_000));

  // Now proceed with actual shutdown
  await server.close();
  // ...
};
```

Kubernetes deployment spec:

```yaml
spec:
  terminationGracePeriodSeconds: 60  # must exceed your shutdown timeout
  containers:
    - lifecycle:
        preStop:
          exec:
            command: ["/bin/sleep", "5"]  # alternative to code-level delay
```

---

## Worker Shutdown — Idempotent Stop Pattern

```ts
// Pattern for any background job/timer/worker
let jobInterval: NodeJS.Timeout | null = null;
let isRunning = false;

export function startJob(): void {
  if (jobInterval) return; // idempotent — safe to call twice
  isRunning = true;

  // Immediate first run + scheduled interval
  runJob().catch(err => logger.error('Job error', sanitizeError(err)));
  jobInterval = setInterval(() => {
    if (!isRunning) return;
    runJob().catch(err => logger.error('Job error', sanitizeError(err)));
  }, 5 * 60_000);
}

export async function stopJob(): Promise<void> {
  isRunning = false;
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
  }
  // Wait for in-progress run to complete if needed
  await currentRunPromise; // track with a module-level variable
}
```

BullMQ workers:

```ts
// BullMQ worker — graceful close drains the current job
const worker = new Worker('queue-name', processor, { connection: redis });

export async function stopWorker(): Promise<void> {
  await worker.close(); // waits for current job, rejects pending
}
```
