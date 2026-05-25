# nodejs — Eval Cases

v3 format: **user-voice phrasing** (Russian/typos/incomplete welcome) + **Expected behavior** column (which sub-files / templates should load, not just "skill activates").

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "процесс просто молча падает в проде, в логах ничего" | Load `troubleshooting.md` (Process crashes silently); recommend `--unhandled-rejections=strict` + `--enable-source-maps`; cite [recommended-defaults.md](recommended-defaults.md) NODE_OPTIONS |
| "память течёт после 6 часов uptime, RSS растёт" | Load `troubleshooting.md` (Memory leak); recommend `--heapsnapshot-near-heap-limit` + `--heapsnapshot-signal=SIGUSR2`; cite `references/monitoring.md` |
| "node 24 не понимает .ts с enum" | Load `troubleshooting.md` (Type stripping limitations) + `references/type-stripping.md`; recommend `as const` object or `--experimental-transform-types` |
| "graceful shutdown не успевает, deploy роняет 5xx" | Load `troubleshooting.md` (SIGTERM timeout) + `references/shutdown.md`; cite 30s grace from [recommended-defaults.md](recommended-defaults.md) |
| "как пробросить requestId через все async вызовы без prop-drilling" | Load `references/async-patterns.md` AsyncLocalStorage section + `wrong-vs-right.md` (ALS scope); cite `examples/async-context-tracing.md` |
| "Pino redact для авторизации и cookie" | Load `references/monitoring.md` Pino section; cite [recommended-defaults.md](recommended-defaults.md) Pino redact paths |
| "argon2 хеш слишком жирный, под 512M пода OOM-ит" | Load `troubleshooting.md` (argon2 hangs) + `wrong-vs-right.md` (timing-safe verify); cite [recommended-defaults.md](recommended-defaults.md) argon2 |
| "worker_threads или Piscina для PDF генерации" | Load `references/workers.md`; cite Piscina defaults from [recommended-defaults.md](recommended-defaults.md) |
| "node:test иногда падает только в CI" | Load `troubleshooting.md` (node:test fails in CI) + `references/testing.md`; recommend explicit timeouts |
| "AbortSignal.timeout + retry с backoff для outbound HTTP" | Load `references/async-patterns.md` AbortSignal section; cite `examples/circuit-breaker-with-retry.md` + 15s default from [recommended-defaults.md](recommended-defaults.md) |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "Fastify onSend hook чтобы сжимать ответы" | `fastify` | Fastify-specific lifecycle hook, deeper than generic Node |
| "Hono RPC + Zod валидация на Cloudflare Workers" | `hono` | Hono RPC + CF specifics, not generic Node |
| "BullMQ FlowProducer parent-child" | `bullmq` | Queue-specific surface |
| "conditional types вытаскивающие optional ключи" | `typescript` | Pure TS type system, no Node runtime |
| "useMemo для тяжёлого React компонента" | `react` | Browser, not Node |
| "Prisma migration P3009 на проде" | `prisma` | ORM-specific |
| "Next.js App Router и Server Components" | `nextjs` | Next.js routing/RSC, Node is just the runtime |
| "DOM event listener селектор багует" | (no skill — browser) | Browser JS, not Node |
| "PostgreSQL RLS для multi-tenant" | `postgresql` | DB schema design |
| "Telegram bot обрабатывает inline queries" | `telegram-bot` | Domain-specific |

## Edge cases (5)

| User-voice prompt | Resolution |
|---|---|
| "REST API на Fastify + graceful shutdown" | **nodejs** primary for shutdown pattern (load `references/shutdown.md` + `troubleshooting.md` SIGTERM section), cross-link `fastify` for lifecycle hooks. Both skills are valid. |
| "node:sqlite для embedded БД" | **nodejs** primary (`references/modules.md`). Built-in module, no need for `prisma`/`postgresql`. Stable since Node v22.13/v23.4 per Context7. |
| "debug memory leak в Node сервисе" | **nodejs** starts (load `troubleshooting.md` Memory leak + `references/monitoring.md`). If user needs distributed-trace correlation → also surface `opentelemetry` cascade marker. |
| "node:test в GitHub Actions" | **nodejs** for `node:test` invocation (`references/testing.md`) + `github-actions` for workflow YAML. Both load. |
| "перевести CJS Express на ESM" | **nodejs** primary (`references/modules.md` + `troubleshooting.md` ESM/CJS interop). Not a TS-specific question. |

## How to verify (manual)

1. Open a fresh session and ensure `nodejs` skill is in the active set
2. Paste each Positive prompt → confirm:
   - The response references the file(s) listed in "Expected behavior"
   - Cited numeric values match [recommended-defaults.md](recommended-defaults.md) (no inline magic numbers from old SKILL.md)
3. Paste each Negative prompt → confirm `nodejs` does NOT dominate; the suggested fallback skill is named in the response
4. Edge cases → confirm the response explicitly calls out the cross-link ("primary: nodejs, see also: fastify/...")

Regression triggers:
- Negative becoming Positive → tighten the `SKIP:` clauses in `description`
- Positive becoming Negative → add the missing trigger term to `description`
- Edge prompt routes to only one skill → enrich Related Skills cross-links in SKILL.md

Run after any change to `SKILL.md` description, capability list, or after a Node 24 minor that lands a new flag.
