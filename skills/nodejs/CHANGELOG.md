# nodejs — CHANGELOG

All notable changes to this skill follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and SemVer.

---

## [Unreleased]

---

## [2.0.0] — 2026-05-16

### Changed (BREAKING)
- Full **skill-evaluation v3 retrofit**. `risk: high-stakes` is now backed by mandatory artifacts.
- SKILL.md compressed from 334 → 250 lines. Capability section is now one-line-per-domain with link-only references; removed inline framework-throughput table, inline `argon2id` parameters, inline `AbortSignal`/`AsyncLocalStorage` prose, inline graceful-shutdown sequence, inline security checklist, and inline profiling tool list — all live in references now.
- Type stripping content corrected for Node 24 reality (Context7-verified):
  - **OLD (incorrect):** "Run with `--experimental-strip-types`" / "stable in Node 24"
  - **NEW (correct):** Type stripping is **on by default** in Node 24; `--no-strip-types` disables; `--experimental-transform-types` (RC) enables enums / parameter properties / namespaces with runtime code.
  - Files corrected: `references/type-stripping.md`, `references/testing.md`, `references/modules.md`, `references/performance.md`, `references/architecture.md`, `references/REFERENCE.md`, `templates/package.json.template`, `templates/Dockerfile.node24.template`, `examples/async-context-tracing.md`.
- `references/eval-cases.md` rewritten to v3 format: user-voice phrasing (Russian/typos) + Expected behavior column + "How to verify" section.

### Added
- **`references/recommended-defaults.md`** (required for high-stakes with knobs) — canonical defaults with tuning ranges for:
  - Runtime flags (`--max-old-space-size`, `UV_THREADPOOL_SIZE`, `NODE_OPTIONS`, `--unhandled-rejections`, `--heapsnapshot-signal`)
  - Graceful shutdown timeouts (30 s SIGTERM grace, PM2 `kill_timeout`, k8s `terminationGracePeriodSeconds`, k8s `preStop`)
  - HTTP / fetch (`AbortSignal.timeout` 15 s API / 30 s long-running, undici Pool, keepAlive)
  - Pino (`info` prod / `debug` dev, redact paths for secrets)
  - OpenTelemetry (0.1 prod sample, 1.0 dev, `--import` loader)
  - argon2id (verified against ranisalt/node-argon2: defaults `memoryCost: 65536`, `timeCost: 3`, **`parallelism: 4`** — library default; brief includes OWASP minimum 19456/2/1 for constrained pods)
  - `node:test` concurrency (per-test option default `false`; CLI `--test-concurrency` defaults to CPU count)
  - PM2 (`exec_mode: cluster`, `instances: max`, `max_memory_restart: 700M`, `wait_ready: true`)
  - Native fetch + undici Pool (connections, pipelining, timeouts)
  - Piscina (`minThreads`, `maxThreads = cpus - 1`, `idleTimeout`, `maxQueue`)
- **`references/troubleshooting.md`** (required for high-stakes) — symptom-indexed entries:
  - Process crashes silently → unhandled-rejections + source maps
  - Memory leak → heap snapshot via `--heapsnapshot-signal=SIGUSR2` + auto-dump near limit
  - Event loop stalls → `monitorEventLoopDelay`, clinic flame
  - High CPU but no work → 0x, tight loops, `setImmediate` yield
  - SIGTERM handler timeout → deadman timer, `process.once`, full shutdown sequence
  - `node:test` fails only in CI → explicit timeouts, reduced concurrency, deterministic state
  - ESM/CJS interop hell (`ERR_REQUIRE_ESM`)
  - Type stripping rejects enums / parameter properties (Node 24 default-strip limitations)
  - `AsyncLocalStorage` context lost (worker_threads boundary, callback APIs)
  - `argon2` OOMs on tiny pods (defaults × parallelism × pool size)
  - Native module mismatch after Node upgrade (`npm rebuild`, multi-arch Docker)
  - `worker_threads` OOM (per-worker `resourceLimits.maxOldGenerationSizeMb`)
  - Pino logs lost at exit (`logger.flush`, transport `sync: true`)
- **`references/wrong-vs-right.md`** (required for high-stakes; 6 pairs):
  - `uncaughtException` swallow vs fail-fast (log → flush → exit)
  - `AsyncLocalStorage` per-request instance vs module-scope instance
  - Synchronous `JSON.parse(req.body)` vs streaming + bodyLimit
  - `===` token comparison vs `argon2.verify` / `crypto.timingSafeEqual`
  - `child.kill('SIGTERM')` without escalation vs SIGTERM → grace → SIGKILL
  - Raw `process.env` access vs Zod-validated env schema

### Verified (Context7)
- `--experimental-strip-types` is no longer required in Node 24 — type stripping is the default; flag is `--no-strip-types` to disable. (`/websites/nodejs_latest-v24_x_api`, `typescript.json`).
- `--experimental-transform-types` is Release Candidate (Stability 1.2). Required for enums, parameter properties, namespaces with runtime code.
- `node:sqlite` stable since v22.13 / v23.4 (`sqlite.json`).
- `AbortSignal.any(signals)` and `AbortSignal.timeout(delay)` confirmed (`globals.json`).
- `UV_THREADPOOL_SIZE` default is 4 (`cli.json`).
- `--heapsnapshot-signal=SIGUSR2` confirmed (`cli.json`).
- `--unhandled-rejections=throw` is the default since v15.0.0.
- `node:test` `concurrency` option defaults to `false` (per-test); files-level `--test-concurrency` parallelizes across CPUs.
- `argon2` defaults confirmed against `ranisalt/node-argon2` wiki: type `argon2id`, memoryCost 65536 KiB, timeCost 3, parallelism 4 (not 1 as initially suggested — corrected in `recommended-defaults.md` argon2 table and tuning notes).

### Hallucinations fixed
- `references/type-stripping.md:8` — was "`--experimental-strip-types` is stable in Node.js 24" → is "Type stripping is on by default in Node 24; flag is `--no-strip-types` to disable".
- `references/testing.md:11-20` — was `node --experimental-strip-types --test` (4 invocations) → is `node --test`.
- `references/modules.md:111` — removed obsolete `--experimental-strip-types` flag from Permission Model example.
- `references/modules.md:152` — removed obsolete flag from custom loader example.
- `references/performance.md:34` — removed `execArgv: ['--experimental-strip-types']` from `worker_threads` constructor.
- `references/architecture.md:253` — corrected "(stable)" claim + dead `nodejs-backend-patterns` skill link.
- `references/REFERENCE.md:9` — updated table description for type-stripping reality.
- `templates/package.json.template:12-18` — removed `--experimental-strip-types` from dev/test/test:watch/test:cov scripts.
- `templates/Dockerfile.node24.template:26,77` — corrected comments mentioning `--experimental-strip-types`.
- `examples/async-context-tracing.md:204` — removed obsolete flag from verification command.

---

## [1.1.0] — 2026-05-15

### Changed (BREAKING)
- Full rewrite of `SKILL.md` to skill-evaluation v2 standards
- Description expanded to 300+ chars with explicit `SKIP:` anti-triggers for fastify-pro, hono, bullmq-specialist, typescript, javascript-pro, prisma-expert, nextjs
- `## Hard Constraints` renamed to `## Important Constraints` (audit-checklist standard name)
- `## Related Skills` fully reworked: grouped by relationship category (frameworks, language, data, background, ops, quality)
- `## API Reference` split into four subtables: Reference files, Templates, Examples, Scripts, Checklists

### Added
- `templates/fastify-server.ts.template` — production Fastify 5 server with Pino, Helmet, CORS, rate limit, graceful shutdown, OTel stub
- `templates/express-server.ts.template` — production Express 5 equivalent
- `templates/Dockerfile.node24.template` — multi-stage distroless Node 24 build, OCI labels, health check
- `templates/.env.example.template` — typed env vars with Zod validation comments
- `templates/package.json.template` — type:module, node:test scripts, engines.node >=24
- `examples/graceful-shutdown-fastify.md` — end-to-end: signal trap → drain → close DB/Redis → PM2 + k8s preStop + rollback
- `examples/async-context-tracing.md` — AsyncLocalStorage + Pino mixin + OTel bridge: request context through every async layer
- `examples/circuit-breaker-with-retry.md` — outbound HTTP with circuit breaker (CLOSED/OPEN/HALF_OPEN) + exponential backoff + AbortSignal.timeout
- `scripts/check-deps.sh` — npm audit + npm outdated, exits non-zero on HIGH/CRITICAL or stale majors
- `scripts/profile-event-loop.sh` — clinic.js doctor/flame/bubbleprof with autocannon load generation
- `checklists/pre-deploy.md` — pre-flight, acceptance, self-check
- `checklists/security-hardening.md` — Helmet, CORS, rate limiting, JWT, argon2id, secrets, SQL injection, Node Permission Model
- `checklists/incident-response.md` — OOM, event loop blocked, unhandledRejection storm + RCA templates + alert thresholds
- `references/eval-cases.md` — 10 positive, 10 negative, 5 edge case routing tests

### Removed
- None (references/ content preserved as-is — separate scope)

---

## [1.0.0] — 2026-05-15

### Added
- Initial merge of `nodejs-backend-patterns` and `nodejs-expert` into single umbrella skill
- `references/` with 13 domain files: REFERENCE.md, type-stripping.md, async-patterns.md, streams.md, modules.md, testing.md, architecture.md, error-handling.md, shutdown.md, workers.md, security.md, monitoring.md, performance.md
- SKILL.md covering: type stripping, framework selection, project structure, error handling, async patterns, graceful shutdown, security, worker threads, monitoring, streams, testing
- Version block (Node.js 24.x LTS, TypeScript 5.9.x)
