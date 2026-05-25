# fastify — Eval Cases

v3 format: **user-voice phrasing** (Russian/typos/incomplete welcome) + **Expected behavior** column (which sub-files / templates should load, not just "this skill activates").

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "подними fastify 5 с pino и graceful shutdown" | Load `core-api.md` lifecycle section + `recommended-defaults.md` Pino/keepAlive blocks; cite `templates/minimal-server.ts.template` |
| "withTypeProvider TypeBoxTypeProvider чтобы body был типизирован" | Load `validation-schemas.md` TypeBox section |
| "Fastify 4 schemas (shorthand) → Fastify 5 — что нужно поменять" | Load `migration.md`; flag full JSON Schema requirement + type provider split |
| "@fastify/jwt preHandler hook для /admin" | Load `authentication.md`; cite `templates/jwt-auth-plugin.ts.template` |
| "обернуть Prisma в fastify-plugin как app.db" | Load `plugins-ecosystem.md` (fp + encapsulation matrix) |
| "response schema strips fields - почему email пропал в ответе" | Load `troubleshooting.md` (Schema serialization rejects valid response) |
| "CloudPayments webhook на Fastify — HMAC проверяется неверно" | Load `troubleshooting.md` (Raw body lost) + `examples/webhook-with-hmac.md` |
| "@fastify/rate-limit global + override для /login" | Load `recommended-defaults.md` Rate-limit table + `plugins-ecosystem.md` registration order |
| "тест роута через app.inject в Vitest" | Load `testing.md`; show `buildApp()` factory pattern |
| "502 от nginx когда трафика мало — Fastify за прокси" | Load `troubleshooting.md` (502/504 upstream) + `recommended-defaults.md` keepAliveTimeout rule |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "Cloudflare Workers Hono c Zod валидацией" | `hono` | Edge runtime, not Node Fastify |
| "Express 5 async error middleware" | `express` cascade / `nodejs` | Different framework |
| "NestJS @Injectable provider" | `nestjs` cascade | Different framework |
| "node:http без фреймворка — basic routing" | `nodejs` | Raw Node, not framework |
| "Prisma findUnique возвращает undefined" | `prisma` | ORM concern |
| "BullMQ worker concurrency" | `bullmq` | Queue concern |
| "Zod discriminated union nested" | `zod` | Validation library, no Fastify mention |
| "TS conditional type infer route params" | `typescript` | Type system |
| "Next.js Route Handler /api/users" | `nextjs` | Different framework |
| "pgBouncer перед Postgres" | `postgresql` / `linux-sysadmin` | Infra |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "validate Fastify body Zod" | **fastify** PRIMARY (`fastify-type-provider-zod` setup → load `validation-schemas.md` Zod section); cross-link `zod` for schema authoring |
| "CloudPayments webhook на Fastify с HMAC" | **fastify** PRIMARY (raw-body parser → load `troubleshooting.md` + `examples/webhook-with-hmac.md`); cross-link `cloudpayments` for HMAC formula |
| "Fastify или Hono для нового бота — что выбрать" | Ambiguous. Surface tradeoffs: Node host → fastify; edge/Workers → hono. Cross-link both. |
| "Fastify на Cloudflare Workers — возможно?" | **hono** PRIMARY (Fastify не targets Workers); note the mismatch in `runtimes.md` (hono) |
| "Migrate Express 4 → Fastify 5" | **fastify** PRIMARY (target). Reference Express patterns from `nodejs`; load `core-api.md` + `migration.md` |

## How to verify (manual)

1. Open a fresh session with this skill in `~/.claude/skills/fastify/`.
2. Paste each Positive prompt → confirm:
   - System reminder lists `fastify` as an active skill
   - Response references files matching the "Expected behavior" column
3. Paste each Negative prompt → confirm `fastify` does NOT appear, the suggested fallback skill is mentioned
4. Edge cases: confirm cross-link is explicit ("primary: fastify, see also: zod/cloudpayments")

If a prompt routes wrong:
- Negative becoming Positive → tighten `description` SKIP rules
- Positive becoming Negative → add missing trigger term to `description`
- Edge routing only to one skill → enrich Related Skills cross-links

Run after any change to `SKILL.md` description or major reference restructure.
