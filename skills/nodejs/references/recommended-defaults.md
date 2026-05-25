# Recommended defaults — nodejs

The canonical operational values for Node.js 24 production services. **All other files in this skill cite this table — do not redefine inline.** Source: synthesized from `nodejs.org/api` (v24.x), package docs, and operational experience.

> Citation rule: every recommendation gives a default + a range + a "tune-up when..." / "tune-down when..." condition. Cargo-culting defaults is worse than no defaults.

---

## Runtime flags

```bash
NODE_OPTIONS="--enable-source-maps --unhandled-rejections=strict"
node --max-old-space-size=4096 src/server.ts
```

| Knob | Default | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| `--max-old-space-size` (MB) | **4096** (4 GB) | 512–16384 | container > 4 GB, large in-memory cache, big JSON workloads | small container (256–512 MB) → set to ~75% of pod limit | V8 default is ~2 GB on 64-bit; explicit value avoids surprise OOM in containers |
| `--enable-source-maps` | **on** | on/off | always on in prod (small CPU cost) | only if you're sure perf budget is tight | maps stack traces back to TS sources |
| `--unhandled-rejections` | **`strict`** (default `throw` since v15) | `throw` / `warn` / `none` | — | never use `warn`/`none` in prod | unhandled rejections must crash → restart, not silently leak |
| `--no-strip-types` | **off** (TS is stripped by default in Node 24) | on/off | only if your toolchain pre-compiles `.ts` and you ship `.js` | — | Node 24 strips TS inline by default; flag DISABLES the feature |
| `--experimental-transform-types` | **off** | on/off | you need `enum`, parameter properties, `namespace` with runtime code | — | RC stability; otherwise prefer compile-time `tsc`/`esbuild` |
| `UV_THREADPOOL_SIZE` | **4** (libuv default) | 4–128 | heavy `fs`/`crypto`/`dns.lookup`/`zlib` concurrency | — | sync-style native ops (incl. argon2 default `parallelism: 4`) compete for the same pool; bump to 16–32 for I/O-bound APIs |
| `--heapsnapshot-signal` | unset | `SIGUSR2` | on-demand prod heap dumps | — | enables `kill -USR2 <pid>` to drop a heap snapshot |
| `--heapsnapshot-near-heap-limit` | unset | 1–3 | suspected leaks (auto-dumps before OOM) | — | writes snapshots when heap is close to `--max-old-space-size` |

---

## Graceful shutdown

```ts
const SHUTDOWN_GRACE_MS = 30_000;
setTimeout(() => process.exit(1), SHUTDOWN_GRACE_MS).unref();
```

| Knob | Default | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| SIGTERM grace timeout | **30000 ms** | 10000–120000 | long-running requests (uploads, reports, streaming) | small stateless API | balances orderly drain vs orchestrator force-kill |
| PM2 `kill_timeout` | **30000 ms** | 10000–120000 | match SIGTERM grace + buffer | — | PM2 escalates to SIGKILL after this |
| k8s `terminationGracePeriodSeconds` | **30** | 10–120 | match SIGTERM grace + buffer | — | pod is killed after this regardless of state |
| k8s `preStop` sleep | **5 s** | 0–10 | LB removal is slow | — | lets the load balancer drain before SIGTERM arrives |

---

## HTTP / fetch

| Knob | Default | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| `AbortSignal.timeout` for outbound API calls | **15000 ms** | 1000–60000 | known-slow downstream | sub-second endpoints | bounds tail latency; same value as common LB defaults |
| `AbortSignal.timeout` for long-running ops (reports, AI inference) | **30000 ms** | 10000–600000 | LLM streaming, batch jobs | — | use streaming + per-chunk timeout when possible |
| `keepAlive` on `fetch` / `undici` agent | **on** | on/off | always on for repeat hosts | — | reuses TCP/TLS connection; native fetch enables by default |
| `keepAliveTimeout` (HTTP server) | **5000 ms** (Node default) | 5000–65000 | behind an idle-tolerant proxy | aggressive LB | Node disconnects keep-alive sockets after this |

---

## Logging (Pino)

```ts
const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.secret',
      '*.apiKey',
      'body.card.*',
    ],
    censor: '[redacted]',
  },
});
```

| Knob | Default | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| `level` (prod) | **`info`** | `info` / `warn` / `error` | suspected silent failure (temporary `debug`) | log volume / cost spike → `warn` | `info` covers business events; `debug` only for short windows |
| `level` (dev) | **`debug`** | `debug` / `trace` | new feature investigation | — | dev should see verbose context |
| `redact.paths` | required for prod | — | new sensitive surfaces appear (PII, payment fields) | — | one regression and secrets land in logs |
| `transport` | direct stdout in prod | direct / `pino-pretty` (dev only) | — | never use `pino-pretty` in prod (slow, lossy under load) | structured JSON downstream of stdout collector |

---

## OpenTelemetry

| Knob | Default | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| Trace sample rate (prod) | **0.1** (10%) | 0.01–1.0 | investigating an incident (temp 1.0) | low-traffic, cost-sensitive → 0.01 | balance fidelity vs APM cost |
| Trace sample rate (dev) | **1.0** | — | — | — | dev should see all traces |
| Exporter | **OTLP/HTTP** | OTLP/HTTP / OTLP/gRPC | gRPC infra ready | — | HTTP is simplest, works with most collectors |
| Loader | `--import ./instrumentation.js` (or `--require` for CJS) | — | always preload | — | OTel must wrap module loaders BEFORE app code |

---

## argon2 (password hashing)

```ts
import argon2 from 'argon2';
const hash = await argon2.hash(password); // uses safe defaults
```

| Knob | Default (library) | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| `type` | **`argon2id`** | — | — | — | hybrid (default); OWASP recommendation |
| `memoryCost` | **65536** KiB (64 MiB) | 19456–262144 | high-value secrets, modern hardware | constrained device (IoT, tiny VM) → 19456 (OWASP min) | dominates resistance vs GPU/ASIC |
| `timeCost` | **3** | 2–10 | hardware faster than baseline | login latency too high | linear cost; 3 is OWASP minimum for `argon2id` |
| `parallelism` | **4** (library default) | 1–4 | multi-core box | single-vCPU pod or you want lower CPU per hash | competes with `UV_THREADPOOL_SIZE` (bump that to 8+ if `parallelism=4`) |
| `hashLength` | **32** bytes | 16–64 | — | — | 32 bytes = 256-bit output, sufficient |

Use `argon2.needsRehash(stored, { memoryCost, timeCost, parallelism })` on successful login to upgrade old hashes silently.

---

## node:test (built-in runner)

```bash
node --test --test-concurrency=4 'src/**/*.test.ts'
```

| Knob | Default | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| Test-level `concurrency` option | **false** (sequential) | `false` / `true` / number | independent IO-bound tests | shared state, file locks | per-test option, NOT a CLI flag |
| `--test-concurrency` (CLI, files-level) | CPU count (when present) | 1–N | local dev, fast box | CI with limited cores | Node 24 parallelizes files across CPUs by default |
| `timeout` per test | **`Infinity`** (built-in default) | 100–60000 | explicit per-test bound (recommended) | — | unset timeouts mask hung tests in CI |

---

## PM2 (process supervisor)

```js
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'api',
    script: 'src/server.ts',
    interpreter: 'node',
    exec_mode: 'cluster',
    instances: 'max',
    max_memory_restart: '700M',
    kill_timeout: 30000,
    wait_ready: true,
    listen_timeout: 10000,
    env_production: { NODE_ENV: 'production' },
  }],
};
```

| Knob | Default | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| `exec_mode` | **`cluster`** | `cluster` / `fork` | scale stateless HTTP | stateful (websockets sticky) | uses Node `cluster` for SO_REUSEPORT load-balancing |
| `instances` | **`max`** (CPU count) | 1–N | — | save memory on tiny box → 1 or 2 | `max` → one worker per logical core |
| `max_memory_restart` | **`700M`** (per-instance) | 256M–8G | bigger heap → larger threshold | small container | preventive restart before OS OOM |
| `kill_timeout` | **30000 ms** | match SIGTERM grace | — | — | matches the 30 s graceful shutdown |
| `wait_ready` | **`true`** | true/false | always true if you call `process.send('ready')` | — | enables zero-downtime reloads |

---

## Native fetch + undici Pool

| Knob | Default | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| `undici.Pool` connections | **10** (per origin) | 5–256 | high concurrency to single host | — | undici reuses sockets; Pool caps in-flight per origin |
| `pipelining` | **1** | 1–10 | safe to pipeline (idempotent GETs) | server doesn't support → keep 1 | HTTP/1.1 pipelining; many servers misbehave |
| `headersTimeout` | **30000 ms** | 5000–60000 | slow upstream | aggressive SLA → 5000 | server must send headers in this window |
| `bodyTimeout` | **30000 ms** | 5000–600000 | streaming responses | — | between-chunk timeout |

---

## Piscina (worker_threads pool)

```ts
import Piscina from 'piscina';
const pool = new Piscina({
  filename: new URL('./worker.js', import.meta.url).href,
  minThreads: 2,
  maxThreads: Math.max(2, os.cpus().length - 1),
  idleTimeout: 30_000,
  maxQueue: 1000,
});
```

| Knob | Default | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| `minThreads` | **2** | 1–N | — | scratch (single-shot batch) → 1 | keeps pool warm |
| `maxThreads` | **`cpus - 1`** | 1–CPU count | CPU-bound only workload | shared host with web server | leave 1 core for main loop / OS |
| `idleTimeout` | **30000 ms** | 5000–600000 | bursty workload (longer warm) | reduce footprint after burst | trades RAM vs warm-up latency |
| `maxQueue` | **1000** | 100–10000 | absorb spikes | fail fast under overload → 0 (reject) | backpressure ceiling |

---

## Citation rule

Other files in this skill MUST NOT redefine these values inline. Use:

> Defaults: see [recommended-defaults.md](recommended-defaults.md).

## Last verified

2026-05-16 against Node.js 24.x official docs (`nodejs.org/docs/latest-v24.x/api/`), `argon2` (ranisalt/node-argon2) wiki, OWASP Password Storage Cheat Sheet, and PM2 v6 docs.
