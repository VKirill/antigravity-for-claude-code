# bullmq skill — CHANGELOG

## [2.0.1] — 2026-05-15

Third-pass review (post-v2.0.0) — rated 9.3/10. One real contradiction found and fixed.

### Fixed
- `SKILL.md` and `references/recommended-defaults.md` had **directly conflicting guidance** about Redis connection sharing. SKILL.md said "NEVER share one Redis client instance across Queue + Worker + QueueEvents"; recommended-defaults.md said "YES, share. One ioredis client is fine." Both formulations were partially wrong. Correct, unified rule (now in both files):
  - **Config object** (`{ host, port, maxRetriesPerRequest: null }`) — **safe and recommended** to pass the same literal to `Queue`, `Worker`, `QueueEvents`. BullMQ creates the underlying clients per instance.
  - **Live `new IORedis()` instance** — **NOT safe** to share between `Worker` and `Queue`/`QueueEvents`. `Worker` flips its client into blocking mode; the same client can no longer serve non-blocking commands. If constructing ioredis explicitly, give `Worker` a dedicated instance.

## [2.0.0] — 2026-05-15

Full retrofit to skill-evaluation v3 standards after dual-review (GPT-5.x and Claude Opus 4.x, May 2026 — scored 9.1/10 and 8.5/10 respectively).

### Added
- `references/recommended-defaults.md` — canonical values for `attempts`/`backoff`/`concurrency`/`lockDuration`/`limiter`/`removeOnComplete` with ranges and tuning rules. Eliminates inline drift (Opus caught `concurrency 10-20` vs `20-50` between SKILL.md and `production-patterns.md`). Other files now cite this table instead of redefining values.
- `references/troubleshooting.md` — required for `risk: high-stakes` per v3. Symptom-indexed: workers don't start, jobs stuck in `waiting`/`delayed`, OOM Redis, stalled-job spam, CPU-bound starvation, graceful shutdown drop, retry storm, DLQ drain. Every entry has Symptoms → Diagnose → Common causes → Fix.

### Changed (BREAKING in artifact shape; routing surface lightly affected — `risk: high-stakes` frontmatter is now part of cascade-loading semantics)
- `SKILL.md` compressed 318 → 183 lines. Capabilities section now one-liner-per-domain pointing to references — removed inline code blocks that duplicated reference content (Opus's main complaint about SKILL.md size).
- Frontmatter `risk: high-stakes` added — triggers v3 mandatory artifacts (troubleshooting + recommended-defaults).
- `references/eval-cases.md` rewritten in v3 format: user-voice phrasing (Russian/typos/incomplete) + "Expected behavior" column instead of "Why" column. Says which sub-files should load, not just which skill activates.
- Behavioral Traits trimmed — removed inline concurrency numbers (now cited from `recommended-defaults.md`); kept the "no magic numbers" rule.

### Same as v1.2.0
- All hallucinated-API fixes (RateLimiterPg, JobScheduler-as-class, worker.run(arg)) retained.

## [1.2.0] — 2026-05-15

### Fixed (hallucinated APIs caught by dual-review + audit pass)
- `references/concurrency-and-rate-limit.md` — `import { RateLimiterPg } from 'bullmq'` was fabricated. `RateLimiterPg` does not exist in BullMQ (it belongs to the unrelated `rate-limiter-flexible` package). Replaced with canonical pattern `await worker.rateLimit(duration); throw new RateLimitError();` using real exports `{ Worker, RateLimitError, UnrecoverableError }`.
- `SKILL.md`, `references/job-options.md`, `references/migration.md`, `templates/repeating-job.ts.template` — `new JobScheduler(queueName, { connection })` was fabricated across 5 files. Job Schedulers are upserted **on the Queue itself** via `queue.upsertJobScheduler(schedulerId, repeatOpts, jobTemplate)` per canonical docs (<https://docs.bullmq.io/guide/job-schedulers>). Removed the imaginary class, rewrote all examples to use the method API.
- `references/concurrency-and-rate-limit.md` — `worker.run((async () => {...})())` was fabricated. `Worker.run()` has signature `(): Promise<void>` and takes no arguments. Section retitled "`autorun: false` — deferred start" with correct usage; the custom-dispatch-loop narrative removed as it had no API basis.

### Root cause
Both bugs slipped through Context7-aware generation because the agent paraphrased snippets instead of pasting verbatim. The agent's training-data bias preferred plausible-looking patterns (`new JobScheduler` mirrors the legacy QueueScheduler mental model; `RateLimiterPg` mirrors `RateLimiterPostgres` from a sibling package). Fix is encoded in skill-evaluation v3 — `cascade-generation.md` Anti-hallucination rules now require verbatim snippets + post-gen Context7 cross-check on every import.

## [1.0.0] — 2026-05-15

### Added
- Initial skill under skill-evaluation v2 standards (Pattern 2)
- SKILL.md navigator with 8 reference files + eval-cases
- `references/queues-and-workers.md` — Queue, Worker, QueueEvents, connection options, concurrency
- `references/job-options.md` — attempts, backoff, delay, priority, jobId, removeOn*, repeat (JobScheduler)
- `references/flows-and-children.md` — FlowProducer, parent-child trees, getDependencies, dependency wait
- `references/events-and-progress.md` — QueueEvents, job.updateProgress, job.log, lifecycle events
- `references/concurrency-and-rate-limit.md` — concurrency, limiter, group keys, sequentialize
- `references/production-patterns.md` — graceful shutdown, dead-letter, stalled jobs, sandboxed processors
- `references/observability.md` — Bull Board adapters, OpenTelemetry, Prometheus
- `references/migration.md` — Bull → BullMQ; QueueScheduler removal
- `references/eval-cases.md` — 10 positive + 10 negative + 5 edge tests
- `templates/queue-setup.ts.template` — Queue + Worker + QueueEvents with Zod
- `templates/repeating-job.ts.template` — JobScheduler.upsertJobScheduler cron
- `templates/sandboxed-processor.ts.template` — useWorkerThreads sandbox
- `examples/webhook-flow-dead-letter.md` — payment webhook → flow with retries + DLQ
- `examples/bull-board-on-fastify.md` — Bull Board dashboard on Fastify

### Verified versions (Context7, 2026-05-15)
- BullMQ: `5.x` (latest stable; `Worker` accepts processor file paths for sandboxing, `useWorkerThreads` option confirmed)
- Sources: `/taskforcesh/bullmq` and `/websites/bullmq_io`
- Confirmed:
  - Sandboxed processors via separate JS file + optional `useWorkerThreads: true`
  - URL-style path support via `pathToFileURL` (Windows-friendly)
  - Concurrency option on Worker
  - `JobScheduler` is the modern API for repeating jobs (replaces deprecated `Queue.add(..., { repeat })` ergonomics)

### Notes
- `QueueScheduler` (older BullMQ versions) is removed — delayed-job promotion + stalled detection now live in `Worker`
- Pair with `redis` (backing store), `prisma` (worker → DB writes), `fastify` / `hono` (enqueue endpoints)
- Bull (legacy) is a different package — see `references/migration.md`
