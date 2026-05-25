# bullmq — Eval Cases

v3 format: **user-voice phrasing** (Russian/typos/incomplete welcome) + **Expected behavior** column (which sub-files / templates should load, not just "this skill activates").

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "у меня воркер тормозит и задачи копятся в waiting" | Load `troubleshooting.md` (Jobs stuck in `waiting` section); diagnose queue-name / prefix / pm2 issues |
| "почему BullMQ ругается на `maxRetriesPerRequest must be null`" | Load `queues-and-workers.md` connection section; cite `recommended-defaults.md` |
| "как настроить retry с exponential backoff" | Load `job-options.md`; cite `recommended-defaults.md` table for canonical values (attempts: 5, delay: 5000) |
| "FlowProducer — fan out parent на 3 children" | Load `flows-and-children.md`; show `FlowProducer.add()` example |
| "CPU-heavy задача жрёт event loop" | Load `production-patterns.md` sandboxed section + `troubleshooting.md` (CPU-bound starvation); cite `templates/sandboxed-processor.ts.template` |
| "каждый день в 8 утра по Москве" | Load `job-options.md` repeat section; cite `queue.upsertJobScheduler` pattern + `templates/repeating-job.ts.template` |
| "graceful shutdown — finish in-flight then exit" | Load `production-patterns.md` shutdown section + `troubleshooting.md` (Graceful shutdown drops jobs) |
| "dashboard для очередей в Fastify" | Load `observability.md` Bull Board section; cite `examples/bull-board-on-fastify.md` |
| "rate-limit 100 jobs / минуту на все воркеры" | Load `concurrency-and-rate-limit.md`; cite `limiter: { max: 100, duration: 60_000 }` |
| "migrate Bull → BullMQ, что меняется" | Load `migration.md`; flag `QueueScheduler` removed + `queue.upsertJobScheduler` replaces `repeat` |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "настроить Redis ACL users" | `redis` | Pure Redis ops, not queue surface |
| "Postgres SKIP LOCKED queue pattern" | `postgresql` | Postgres-native queue, different domain |
| "Inngest workflow steps" | (no skill) | Managed SaaS, out of scope per SKIP rule |
| "Trigger.dev cron job" | (no skill) | Managed SaaS, SKIP rule |
| "Agenda с MongoDB" | (no skill) | Legacy + MongoDB, SKIP rule |
| "Fastify schema validation request body" | `fastify` | HTTP framework concern, not queue |
| "Zod discriminated union" | `zod` | Validation library |
| "Piscina pool of worker_threads" | `nodejs` | Generic Node worker pool, not queue |
| "Prisma findMany с пагинацией" | `prisma` | ORM query |
| "BullMQ vs Celery — что выбрать" | (no skill — architectural) | Cross-language comparison; bullmq covers Node only |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "validate job data with Zod at worker entry" | **bullmq** primary (load `queues-and-workers.md` worker entry pattern) + cross-link `zod`. Show Zod parse inside the handler function. |
| "BullMQ on Redis Cluster — будет работать?" | **bullmq** primary (load `recommended-defaults.md` HA section) + cross-link `redis` for cluster slot semantics. Note: needs `{queue-name}` hash tags. |
| "worker пишет в Postgres через Prisma" | **bullmq** primary (load `production-patterns.md` worker structure) + cross-link `prisma` for the DB code. Worker handler is the bullmq surface; DB write is the prisma surface. |
| "сравни BullMQ и Postgres SKIP LOCKED" | Ambiguous. If user already has Redis → **bullmq** primary with tradeoffs. If they need transactional consistency with same DB → **postgresql** primary. Surface both, ask. |
| "BullMQ Pro group keys и observables" | **bullmq** primary; note BullMQ Pro is the commercial fork — features exist but require license. Direct to <https://bullmq.io/pro/>. |

## How to verify (manual)

1. Open a fresh session with this skill in `~/.claude/skills/bullmq/`.
2. Paste each Positive prompt → confirm:
   - The system reminder lists `bullmq` as an active skill
   - The response references files matching the "Expected behavior" column
3. Paste each Negative prompt → confirm `bullmq` does NOT appear in the routed skill response, and the suggested fallback skill is mentioned
4. Edge cases: confirm the response calls out the cross-link explicitly ("primary: bullmq, see also: zod/prisma/redis")

If a prompt routes wrong:
- Negative becoming Positive → tighten the `description` SKIP rules
- Positive becoming Negative → add the missing trigger term to `description`
- Edge routing only to one skill → enrich Related Skills cross-links

Run after any change to `SKILL.md` description or major reference restructure — that's the regression check.
