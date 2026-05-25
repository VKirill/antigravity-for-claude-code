# Troubleshooting — nodejs

Symptom-indexed. Find what the user sees, follow the diagnosis steps, apply the fix. Required for `risk: high-stakes` skills per skill-evaluation v3.

---

## Process crashes silently (exit code 0 or 1, no stderr)

**Symptoms**
- `node src/server.ts` returns to the shell immediately; no error in stderr
- PM2 / Docker shows the process as `online` for a moment, then `restart`
- Nothing in `journalctl -u myapp` / `pm2 logs` beyond startup banner

**Diagnose**
```bash
# 1. Force unhandled-rejection to crash with full trace
NODE_OPTIONS="--enable-source-maps --unhandled-rejections=strict" node src/server.ts

# 2. Trap exits
node -e "process.on('exit', c => console.error('exit', c)); require('./src/server.ts')"

# 3. Wrap top-level await with explicit catch
node --input-type=module -e "import('./src/server.ts').catch(e => { console.error(e); process.exit(1); })"
```

**Common causes**
- Top-level `await` that rejected and no surrounding `.catch()` — process exits via the default `unhandledRejection` → `throw` path.
- Uncaught exception during module evaluation (e.g., reading a missing `.env`, `JSON.parse(process.env.X)` blowing up at boot).
- `process.exit()` called by a third-party module on startup error.
- ESM/CJS interop: `require()` of an ESM module throws `ERR_REQUIRE_ESM` synchronously.

**Fix**
- Add a top-level boot wrapper:
  ```ts
  async function boot() { /* ... */ }
  boot().catch(err => { console.error('boot failed', err); process.exit(1); });
  ```
- Validate env once at startup with Zod — fail fast with a readable message.
- Make sure `NODE_OPTIONS="--enable-source-maps"` is set in production env.

---

## Memory leak (heap grows, OOM after N hours)

**Symptoms**
- RSS grows monotonically over hours/days
- Eventually `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`
- `--max-old-space-size` raised once → leak just delayed

**Diagnose**
```bash
# 1. Auto-dump near heap limit (re-deploy with these flags)
node --max-old-space-size=2048 --heapsnapshot-near-heap-limit=3 src/server.ts

# 2. Enable on-demand dumps via SIGUSR2
node --heapsnapshot-signal=SIGUSR2 src/server.ts
# later:
kill -USR2 $(pgrep -f 'node src/server.ts')
# produces Heap.<timestamp>.<pid>.heapsnapshot in cwd

# 3. Compare snapshots in Chrome DevTools → Memory tab → Comparison view
```

**Common causes**
- Module-scoped `Map`/`Array`/cache that never evicts (request data keyed by something unbounded).
- Event listener registered per request on a long-lived emitter without `removeListener`.
- Closures captured by long-lived promises (timers, websockets, BullMQ workers).
- `AsyncLocalStorage` store retained because the async context never settles (forgotten `await`).
- Pino transport file descriptor leak if you create a new logger per request.

**Fix**
- Move caches behind an LRU (`lru-cache`) with size + TTL.
- Use `emitter.once` not `emitter.on` when one-shot.
- Always pair `.on(event, fn)` with `.off(event, fn)` in request cleanup.
- Reuse a single logger instance (process-scoped).

---

## Event loop stalls (high p99, healthchecks intermittently fail)

**Symptoms**
- Mostly-fast endpoints occasionally take 2–10 s
- `clinic doctor` flags "event loop blocked"
- `perf_hooks.monitorEventLoopDelay()` shows p99 ≥ 100 ms

**Diagnose**
```bash
# 1. Lightweight runtime measurement
node -e "
const { monitorEventLoopDelay } = require('node:perf_hooks');
const h = monitorEventLoopDelay({ resolution: 10 });
h.enable();
setInterval(() => console.log({ p99: h.percentile(99) / 1e6 + 'ms' }), 5000);
"

# 2. Flame chart for one-off captures
npx clinic flame -- node src/server.ts
# then run load: npx autocannon -d 30 -c 50 http://localhost:3000/api
```

**Common causes**
- Sync I/O in request path: `fs.readFileSync`, `crypto.pbkdf2Sync`, `child_process.execSync`.
- Large `JSON.parse` / `JSON.stringify` on a hot path (e.g., 5 MB payload).
- Regex catastrophic backtracking on user input.
- argon2 hash on the main thread (memoryCost: 65536, timeCost: 3 → ~50–100 ms per call) called inside a synchronous loop.
- Image / PDF processing in the main process — must go to `worker_threads` or BullMQ sandboxed processor.

**Fix**
- Replace `*Sync` with the async equivalent.
- Move CPU-bound work to Piscina (`worker_threads` pool) or BullMQ sandboxed processor — see `references/workers.md`.
- Bound JSON size at the HTTP body parser (`bodyLimit` in Fastify, `limit` in Express).
- Profile the regex; rewrite with possessive quantifiers or split parsing in steps.

---

## High CPU but no work (100% one core, queue empty)

**Symptoms**
- `top` shows one Node process at 100% CPU
- No HTTP requests, no jobs being processed
- `pm2 monit` shows constant CPU usage with zero throughput

**Diagnose**
```bash
# 1. CPU flame chart (V8)
npx 0x -- node src/server.ts
# captures, then opens browser with flame graph

# 2. Strace the syscalls (Linux)
strace -p $(pgrep -f 'node src/server.ts') -c -f 2>&1 | head -50
```

**Common causes**
- Tight `while`/`for` loop without `await` or `setImmediate` to yield.
- A `setInterval(fn, 0)` accidentally instead of `setInterval(fn, 1000)`.
- Recursive promise without break: `function poll() { return fetch(...).then(poll); }` with no delay.
- A worker thread looping; main thread free, but `os.loadavg` is misread.

**Fix**
- Insert `await setImmediate()` (`from 'node:timers/promises'`) inside long loops.
- Use exponential backoff in polling loops; never recurse without delay.

---

## SIGTERM handler timeout (graceful shutdown drops connections)

**Symptoms**
- Deploys cause 5xx blips
- Logs show `worker.close()` taking > 30 s, then `SIGKILL`
- Some in-flight HTTP requests return without a response body

**Diagnose**
- Confirm orchestrator timeouts: PM2 `kill_timeout`, k8s `terminationGracePeriodSeconds`, ECS `stopTimeout`.
- Tail logs for "shutdown timeout" / forced exit lines.

**Common causes**
- ❌ Wrong pattern — using `process.on` (not `process.once`) so SIGTERM fires twice.
- ❌ No `server.close()` — new connections still accepted during drain.
- ❌ Long-lived websocket / SSE connections kept open indefinitely.
- ❌ DB pool not drained → connections forcibly closed mid-query.
- ❌ Missing deadman timer → if `worker.close()` itself hangs, process never exits.

**Fix**
```ts
let shuttingDown = false;
async function shutdown(sig: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  setTimeout(() => process.exit(1), 30_000).unref();  // deadman
  await server.close();           // stop accepting new HTTP
  await wsServer.close();          // close websockets gracefully
  await db.$disconnect();          // drain DB pool
  await redis.quit();
  process.exit(0);
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
```
See `references/shutdown.md` for the full pattern. Defaults: see [recommended-defaults.md](recommended-defaults.md).

---

## `node:test` fails only in CI (passes locally)

**Symptoms**
- Local: `node --test 'src/**/*.test.ts'` is green
- CI: random failures, "Promise rejected with null", or timeouts

**Common causes**
- Tests share mutable state (in-memory DB, `process.env`, module-scoped variables) and run concurrently in CI (more cores → more parallelism).
- Time-sensitive assertions (`new Date()` comparisons) fail on slow CI runners.
- Default test timeout is `Infinity` — a hung test blocks the suite forever, gets killed by CI overall timeout, looks like a "random" failure.
- Tests rely on filesystem cwd that differs between local and CI.

**Fix**
- Pass explicit `timeout` on every test (e.g., `test('x', { timeout: 5000 }, fn)`).
- Reduce file-level concurrency in CI: `node --test --test-concurrency=2`.
- Reset module-scoped state in `beforeEach`/`afterEach`.
- Use deterministic time (`{ MockTimers }` from `node:test` or `@sinonjs/fake-timers`).

---

## ESM/CJS interop: `ERR_REQUIRE_ESM` / `require() of ES module`

**Symptoms**
- `Error [ERR_REQUIRE_ESM]: require() of ES Module ...`
- Or: `SyntaxError: Cannot use import statement outside a module`
- Tests pass on local but fail on a colleague's machine

**Common causes**
- Package author shipped only ESM (`"type": "module"`, no CJS build), but your code is CJS.
- Mixed `"type": "module"` in `package.json` with `.js` files using `require`.
- TypeScript `module: "commonjs"` emitting CJS even though source uses `import`.

**Fix**
- Add `"type": "module"` to `package.json`. Use `import` everywhere.
- If you MUST stay CJS, use `import()` dynamic: `const mod = await import('esm-only-pkg')`.
- For TS: set `tsconfig.json` `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`.
- For `__dirname`/`__filename` in ESM: `import.meta.dirname` / `import.meta.filename` (Node 20.11+, 24+).

---

## Type stripping fails on `.ts` (enums, parameter properties, namespaces)

**Symptoms**
- Node 24 errors: `Unsupported TypeScript syntax: enum declarations require '--experimental-transform-types'`
- Or: parameter property `constructor(private x: number)` rejected

**Background**
Node 24 strips TS types BY DEFAULT (no flag). But it only strips erasable syntax — features that emit runtime code are rejected unless you opt into `--experimental-transform-types` (RC).

**Not supported by default strip mode**
- `enum` (use `as const` object literal instead)
- Parameter properties (`constructor(private x: number)`)
- `namespace` with runtime exports
- TS decorators (legacy or Stage 3)
- `import =` / `export =` aliases

**Fix**
- Refactor enums to `as const` objects:
  ```ts
  // ❌ enum Status { Pending, Active }
  // ✅
  const Status = { Pending: 'pending', Active: 'active' } as const;
  type Status = typeof Status[keyof typeof Status];
  ```
- Or enable transformation (accept RC instability): `node --experimental-transform-types src/x.ts`.
- For decorators / parameter properties — pre-compile with `tsc` or `esbuild`.

See `references/type-stripping.md`.

---

## AsyncLocalStorage context lost across boundaries

**Symptoms**
- Request ID in logs is `undefined` after an `await fetch(...)` or a DB call
- OpenTelemetry shows traces stitched together for the wrong request
- `getStore()` returns `undefined` inside an error handler

**Common causes**
- Callback-style API not awaited (`emitter.on('data', () => store.getStore())` — emitter fires outside the async chain).
- A library that uses native promises but registers callbacks via `setTimeout(fn, 0)` — node tracks ALS across promises, but a manually queued microtask can escape.
- Worker_threads — ALS does NOT propagate into a worker thread (a new V8 isolate has its own AsyncContext).

**Fix**
- Wrap callback-based APIs: `store.run({ ...ctx }, () => libraryCall(cb))`.
- For worker_threads, pass context explicitly via `workerData` or as the first message.
- For setTimeout/setImmediate, ALS does propagate — verify you're not in a worker.

---

## `argon2` hangs / OOMs at boot on tiny machines

**Symptoms**
- Service health check fails on a 512 MB container
- `argon2.hash('test')` takes 5+ seconds or kills the pod with OOM
- Locally fine (16 GB laptop)

**Cause**
Default `memoryCost: 65536` KiB = 64 MiB per hash call. With `parallelism: 4` (also default), that's 4 × 64 MiB = 256 MiB peak per hash. On a 512 MB pod this competes with V8 heap.

**Fix**
- Move auth to a dedicated pod with appropriate sizing.
- OR reduce params (OWASP minimum for argon2id is still safe):
  ```ts
  await argon2.hash(pw, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  ```
- Bump `UV_THREADPOOL_SIZE=8` if you keep `parallelism: 4` — argon2 uses libuv threads.

See [recommended-defaults.md](recommended-defaults.md) argon2 section.

---

## Native module mismatch after Node upgrade

**Symptoms**
- After `nvm install 24` or container rebuild:
- `Error: The module '...node_modules/argon2/lib/binding/...' was compiled against a different Node.js version using NODE_MODULE_VERSION X, this version requires NODE_MODULE_VERSION Y`

**Fix**
```bash
# Clean rebuild
rm -rf node_modules package-lock.json
npm install
# OR explicit rebuild
npx node-gyp rebuild
# OR (preferred for prebuilt-binary packages)
npm rebuild argon2
```
- For Docker: ensure the BUILD stage uses the SAME Node major as the runtime stage.
- For multi-arch: use a Docker buildx with the target platform.

---

## `worker_threads` OOM (each worker hits heap limit)

**Symptoms**
- Pool of N workers, some random workers die with heap OOM
- `worker.on('error', ...)` fires `JavaScript heap out of memory`
- Main process is fine

**Cause**
Each worker has its OWN V8 isolate and heap, sized by `--max-old-space-size` BY DEFAULT (you can override per worker). With 8 workers × 4 GB max, your machine needs 32 GB just for heaps.

**Fix**
```ts
new Worker('./worker.js', {
  resourceLimits: {
    maxOldGenerationSizeMb: 256,   // explicit cap per worker
    maxYoungGenerationSizeMb: 32,
  },
});
```
For Piscina: pass `resourceLimits` in the pool options. See `references/workers.md`.

---

## `pino` logs missing / truncated at process exit

**Symptoms**
- Last few log lines before crash never appear in stdout
- `pino.transport` to file / Loki / Elastic loses tail messages on `process.exit()`

**Cause**
Pino writes to an underlying stream asynchronously. On synchronous `process.exit()` or uncaught exception, the buffer isn't flushed before the file descriptor closes.

**Fix**
```ts
import pino from 'pino';
const logger = pino();

// Handle exit cleanly
async function flushAndExit(code: number) {
  await new Promise<void>(resolve => logger.flush(resolve));
  process.exit(code);
}

process.once('uncaughtException', async (err) => {
  logger.fatal({ err }, 'uncaught');
  await flushAndExit(1);
});
```
For `pino.transport`: pass `sync: true` for boot-time logs that MUST land (e.g., startup banner). Trade off: synchronous mode is slower.

---

## More symptoms?

If your symptom isn't here, collect:
- Node version: `node --version`
- Flags / NODE_OPTIONS: `printenv NODE_OPTIONS`
- Heap snapshot near the failure (see "Memory leak" section)
- Event loop delay: `monitorEventLoopDelay()` p50/p99
- Last 200 lines of stderr / journalctl

Then check `references/monitoring.md` for profiling tools and `references/performance.md` for tuning playbook.
