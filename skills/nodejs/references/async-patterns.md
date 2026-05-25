# Node.js 24 — Async Patterns

> Node.js 24.14.1 · TypeScript 6.0.x · Updated: 2026-05-16

## Native Fetch API (stable in Node 21+)

`fetch` is globally available — no import, no node-fetch package needed.

```ts
// ✅ Native fetch — no import required
const response = await fetch('https://api.example.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 42 }),
  signal: AbortSignal.timeout(30_000), // built-in timeout signal
});

if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
}

const data = await response.json() as { id: number; name: string };
```

## AbortController & AbortSignal

`AbortController` and `AbortSignal` are globals in Node 24.

```ts
// Manual abort
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 30_000);

try {
  const res = await fetch(url, { signal: controller.signal });
  return await res.json();
} finally {
  clearTimeout(timer);
}

// ✅ Prefer AbortSignal.timeout() — cleaner, no manual cleanup
const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });

// AbortSignal.any() — abort when ANY signal fires (Node 20.3+)
const userCancel = new AbortController();
const combined = AbortSignal.any([
  AbortSignal.timeout(30_000),
  userCancel.signal,
]);
const res = await fetch(url, { signal: combined });
```

## EventTarget (native, no EventEmitter needed for new code)

```ts
class ApiClient extends EventTarget {
  async call(url: string): Promise<Response> {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      this.dispatchEvent(new CustomEvent('error', { detail: { status: res.status } }));
    }
    return res;
  }
}

const client = new ApiClient();
client.addEventListener('error', (e) => {
  const detail = (e as CustomEvent).detail as { status: number };
  console.error('API error', detail.status);
});
```

## Promise patterns

```ts
// Parallel — all must succeed
const [user, profile] = await Promise.all([
  fetchUser(userId),
  fetchProfile(userId),
]);

// Partial results acceptable
const results = await Promise.allSettled([
  sendToAnalyticsA(events),
  sendToAnalyticsB(events),
]);
for (const r of results) {
  if (r.status === 'rejected') console.warn('Analytics failed', r.reason);
}

// Race with timeout
const data = await Promise.race([
  fetchData(),
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), 5_000),
  ),
]);
```

## AsyncIterator / for-await-of (Node 24 native streams)

```ts
import { createReadStream } from 'node:fs';

// Node streams are AsyncIterable natively
const stream = createReadStream('large-file.json');
const chunks: Buffer[] = [];

for await (const chunk of stream) {
  chunks.push(chunk as Buffer);
}

const content = Buffer.concat(chunks).toString('utf8');
```

## AsyncLocalStorage (context propagation)

```ts
import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  requestId: string;
  userId?: number;
}

const contextStorage = new AsyncLocalStorage<RequestContext>();

// Middleware sets context
function withRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return contextStorage.run(ctx, fn);
}

// Anywhere in the call stack — no prop drilling
function getCurrentContext(): RequestContext | undefined {
  return contextStorage.getStore();
}

// Usage in logger
function log(level: string, message: string, meta?: object) {
  const ctx = getCurrentContext();
  console[level === 'error' ? 'error' : 'log'](JSON.stringify({
    level,
    message,
    requestId: ctx?.requestId,
    ...meta,
  }));
}
```

## Graceful shutdown

```ts
import type { Server } from 'node:http';

let isShuttingDown = false;

function createShutdown(server: Server, cleanup: () => Promise<void>) {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`${signal} received — shutting down`);

    const TIMEOUT = 15_000;
    const timer = setTimeout(() => {
      console.error('Shutdown timeout — forcing exit');
      process.exit(1);
    }, TIMEOUT);
    timer.unref();

    try {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
      await cleanup();
      process.exit(0);
    } catch (err) {
      console.error('Shutdown error', err);
      process.exit(1);
    }
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception', err);
    shutdown('uncaughtException');
  });

  // Node 24: unhandledRejection terminates by default — handle explicitly
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection', reason);
    // Decide: shutdown or just log depending on severity
  });
}
```

Note: In Node.js 24, unhandled promise rejections **terminate** the process by default
(`--unhandled-rejections=throw` is the default). Always attach `.catch()` or handle in `unhandledRejection`.
