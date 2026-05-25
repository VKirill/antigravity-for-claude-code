# Node.js Incident Response

Quick-reference for the three most common Node.js production incidents. Each section: symptoms → immediate actions → diagnosis → fix → RCA template.

---

## Incident 1: Out of Memory (OOM)

### Symptoms
- Process exits with `SIGKILL` (code 137 in Docker/k8s) or `JavaScript heap out of memory`
- PM2 shows `status: errored` with restart count increasing
- `node --max-old-space-size` warning in logs before crash
- k8s pod `OOMKilled` in `kubectl describe pod`

### Immediate actions (< 5 min)
1. Confirm it's OOM: `pm2 logs --lines 100 | grep -i "heap\|memory\|killed"` or `kubectl describe pod <pod>`
2. Scale up to prevent cascading: `pm2 scale <app> +2` or increase k8s replicas
3. Set memory limit if not set: PM2 `max_memory_restart: '1G'` triggers graceful restart before crash
4. Check current heap: `pm2 status` → `heap_used`

### Diagnosis
```bash
# Check if it's a specific endpoint leaking memory
# Take heap snapshot before restart
pm2 trigger <app> gc    # force GC first
kill -SIGUSR2 <pid>     # dumps heapdump.json to process.cwd()

# Or set env var for automatic heap snapshots
NODE_OPTIONS="--heapsnapshot-signal=SIGUSR2" pm2 restart <app>
```

Open heap snapshot in Chrome DevTools → Memory tab → Import heapdump → Retained objects sorted by size.

**Common causes:**
- EventEmitter leak: listener added in request handler without removal
- Unbounded cache: `Map`/`Set` growing without eviction (add TTL or `max` size)
- Closure holding references: async callbacks keeping large objects in scope
- BullMQ: `removeOnComplete/removeOnFail` not set → Redis grows, then job data loaded into memory
- Prisma: `findMany` without pagination on large tables

### Fix
- EventEmitter: `emitter.off(event, handler)` in cleanup; use `once()` instead of `on()` for one-shot listeners
- Cache: use `lru-cache` (LRU with max entries/max size), not raw `Map`
- Pagination: add `take` and `skip` to all list queries

### RCA Template
```
## Incident: OOM crash on {{service}} at {{timestamp}}

**Impact:** {{duration}} downtime, {{n}} restarts, {{users}} users affected

**Root cause:** {{specific cause — e.g., "EventEmitter listener added per-request without cleanup in users.service.ts line 42"}}

**Timeline:**
- {{time}} First OOM crash
- {{time}} Identified heap snapshot showing EventEmitter retained 847MB
- {{time}} Fix deployed

**Fix:** {{one-sentence description}}

**Prevention:**
- [ ] Added heap size monitoring alert at 80% of limit
- [ ] Added `max_memory_restart` to PM2 config
- [ ] Added lint rule against `emitter.on()` without corresponding `.off()`
```

---

## Incident 2: Event Loop Blocked (Slow/Unresponsive)

### Symptoms
- All responses timeout simultaneously (not just one endpoint)
- Health check `/health` starts returning 502/504 (normally sub-ms)
- PM2 cluster: only some instances affected (blocked in that worker)
- `autocannon` shows 0 req/s for burst periods
- `clinic doctor` shows high event loop delay (>100ms)

### Immediate actions (< 5 min)
1. Confirm event loop is blocked (not network/DB): `autocannon -d 5 http://localhost/health`
2. If PM2 cluster: which instance? `pm2 status` → all workers or specific PID?
3. Identify the blocking code: `node --inspect <pid>` → Chrome DevTools → Profiler → Record 10s → look for long "Tasks" on main thread
4. Quick mitigation: rolling restart via `pm2 reload <app>` (graceful, restarts workers one by one)

### Diagnosis
```bash
# CPU profiling on the running process (no restart needed)
node --inspect=0.0.0.0:9229 dist/app/index.js
# Open chrome://inspect → attach → Performance → Record → send load → stop

# Or: clinic flame (requires restart)
clinic flame -- node dist/app/index.js &
autocannon -d 20 -c 200 http://localhost:3000/api/heavy-endpoint
kill -SIGINT <clinic_pid>
# Opens flamegraph — wide bars = CPU time
```

**Common causes:**
- `JSON.parse/stringify` on large payloads (> 10MB) in request handler
- Synchronous file I/O: `fs.readFileSync`, `execSync`, `spawnSync`
- `crypto.pbkdf2Sync` or `crypto.randomBytes` (sync variant) in auth middleware
- RegExp catastrophic backtracking: `/(a+)+/` on user-controlled input
- Tight loop processing array of 100k+ items synchronously
- bcrypt (uses synchronous blocking hash on some versions)

### Fix
- Large JSON: stream parse with `stream-json`, or validate size and reject before parsing
- Sync I/O: replace with async variants (`fs.readFile`, `exec` from `node:child_process`)
- Heavy computation: move to `worker_threads` (Piscina pool)
- RegExp: use `safe-regex` to validate regex before use; reject suspicious user input

### RCA Template
```
## Incident: Event loop blocked on {{service}} at {{timestamp}}

**Impact:** {{duration}} degraded response times, p99 latency {{from}} → {{to}}

**Root cause:** {{specific cause — e.g., "JSON.stringify on 45MB response payload in /api/export route, blocking for ~2.5s"}}

**Detection lag:** {{n}} minutes from first alert to response (target < 5 min)

**Fix:** {{one-sentence}}

**Prevention:**
- [ ] Added event loop lag alert (> 100ms for > 30s = page)
- [ ] Added request body size limit of 1MB (rejecting large payloads at Fastify level)
- [ ] Moved export handler to streaming response
```

---

## Incident 3: UnhandledRejection Storm

### Symptoms
- Log flood: `UnhandledPromiseRejectionWarning` or `unhandledRejection` repeated rapidly
- Process exits (Node 24 exits on unhandledRejection by default)
- In PM2: rapid restarts, `restart_time` counter climbing
- Triggered by: deployment, config change, external service going down

### Immediate actions (< 5 min)
1. Read the rejection reason: `pm2 logs <app> --lines 50 | grep -A5 "unhandledRejection"`
2. Is it one error type or many? One type = likely a single upstream failure
3. Is the process restarting? `pm2 status` → `restart_time`
4. Emergency: if restarts are too frequent, `pm2 stop <app>` → investigate → `pm2 start`

### Diagnosis
```bash
# Filter unique rejection reasons (last 200 lines)
pm2 logs <app> --lines 200 --nostream | grep "unhandledRejection" | \
  sed 's/.*unhandledRejection://; s/ at .*//' | sort | uniq -c | sort -rn
```

**Common causes:**
- Missing `.catch()` on a promise in an event listener (e.g., `emitter.on('event', async handler)` without `try/catch`)
- BullMQ worker processor throws synchronously (should throw inside async)
- `setInterval` callback is async without try/catch
- External service returned unexpected response, thrown error not caught

### Fix pattern
```ts
// WRONG — unhandled rejection if asyncHandler throws
emitter.on('data', asyncHandler)

// CORRECT
emitter.on('data', (data) => {
  asyncHandler(data).catch((err) => logger.error({ err }, 'Handler failed'))
})

// CORRECT — async setInterval
const tick = async () => {
  try {
    await doWork()
  } catch (err) {
    logger.error({ err }, 'Tick failed — continuing')
  }
}
setInterval(() => void tick(), 5000)
```

### Global backstop (already in server template)
```ts
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise: String(promise) }, 'Unhandled promise rejection')
  // Do NOT call process.exit() here in most cases — let Node 24 handle it
  // Unless you want explicit exit behavior
})
```

### RCA Template
```
## Incident: UnhandledRejection storm on {{service}} at {{timestamp}}

**Impact:** {{n}} process restarts over {{duration}}, {{n}} requests dropped

**Root cause:** {{specific cause — e.g., "Redis connection refused after maintenance window; setInterval health-check callback was async without try/catch, fired 1/s, caused rejection per second"}}

**Detection lag:** {{n}} minutes (target < 2 min for process-exit incidents)

**Fix:** Added try/catch to setInterval callback in health-check.ts

**Prevention:**
- [ ] Added ESLint rule `@typescript-eslint/no-floating-promises` — error level
- [ ] Added `no-async-promise-executor` ESLint rule
- [ ] Added alerting on `unhandledRejection` log events (≥3 per minute = page)
- [ ] Reviewed all `emitter.on(event, asyncFn)` patterns in codebase
```

---

## Cross-cutting: Alert Thresholds

Set these in your monitoring system (Grafana, Datadog, etc.):

| Metric | Warning | Page |
|---|---|---|
| Heap usage % | 70% | 85% |
| Event loop lag (p95) | 50ms | 100ms |
| `unhandledRejection` rate | 1/min | 3/min |
| Process restart count (15min window) | 2 | 5 |
| p99 HTTP latency | 2× baseline | 5× baseline |
| Error rate (5xx) | 1% | 5% |

## Useful one-liners

```bash
# Process memory usage
node -e "setInterval(() => console.log(process.memoryUsage()), 1000)"

# Heap snapshot on running process
kill -SIGUSR2 $(pm2 pid <app>)

# Current event loop lag (requires `perf_hooks`)
node -e "const { monitorEventLoopDelay } = require('node:perf_hooks'); const h = monitorEventLoopDelay({ resolution: 10 }); h.enable(); setTimeout(() => { h.disable(); console.log('p99 lag (ms):', h.percentile(99) / 1e6); }, 5000)"

# Watch PM2 memory trend
watch -n2 "pm2 status | grep -E 'name|mem'"
```
