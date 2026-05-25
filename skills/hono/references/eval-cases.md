# hono — Eval Cases

v3 format: **user-voice phrasing** (Russian/typos/incomplete welcome) + **Expected behavior** column (which sub-files / templates should load, not just "this skill activates").

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "хочу Hono на Cloudflare Workers с KV биндингом" | Load `runtimes.md` Workers section + `recommended-defaults.md` Bindings table; cite `templates/cloudflare-workers.ts.template` |
| "как настроить @hono/zod-validator body+query" | Load `validators-zod.md`; show inline `zValidator('json', schema)` + `c.req.valid('json')` |
| "Body has already been consumed — что я делаю не так" | Load `troubleshooting.md` (Body consumed) + `wrong-vs-right.md` pair #1 |
| "hc<AppType>() возвращает any вместо типов" | Load `troubleshooting.md` (RPC type drift) + `wrong-vs-right.md` pair #5 |
| "Hono 3 → 4 migration — что изменилось" | Load `migration.md`; flag `{Bindings, Variables}` generic shape + `hono/cookie`/`hono/jwt` split |
| "JWT middleware для /admin endpoints" | Load `middleware.md` JWT section + `recommended-defaults.md` alg pinning note |
| "тот же Hono app на Bun и на Node — entry shape" | Load `runtimes.md` Bun + Node sections |
| "RegExpRouter vs LinearRouter — когда что" | Load `recommended-defaults.md` Router choice table + `core-api.md` Routers |
| "setCookie с sameSite Strict но cookie не ставится cross-origin" | Load `troubleshooting.md` (Cookie not setting on Workers) + `recommended-defaults.md` Cookies |
| "HMAC проверка на Workers через crypto.subtle" | Load `troubleshooting.md` (Edge runtime API mismatch) + `wrong-vs-right.md` pair #3 |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "Fastify 5 production server с Pino и JSON Schema" | `fastify` | Node-native framework |
| "Express 4 middleware error handler" | `express` cascade / `nodejs` | Different framework |
| "NestJS @Injectable controller" | `nestjs` cascade | Different framework |
| "Cloudflare Workers KV без HTTP routing" | `cloudflare-workers` cascade | KV-only, no Hono concern |
| "raw node http.createServer routing" | `nodejs` | No framework |
| "Drizzle relation query include" | `drizzle` cascade | ORM concern |
| "Zod discriminated union nested" | `zod` | Validation library |
| "TypeScript conditional type для route params" | `typescript` | Type system |
| "Next.js Route Handler /api/users" | `nextjs` | Different framework |
| "BullMQ worker concurrency tuning" | `bullmq` | Queue concern |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "Hono внутри Next.js App Router catch-all" | **hono** PRIMARY (Hono handles routing → load `runtimes.md`); cross-link `nextjs` for mount pattern at `/api/[[...path]]/route.ts` |
| "validate Hono request body через Valibot вместо Zod" | **hono** PRIMARY (`@hono/valibot-validator` → load `validators-zod.md` multi-validator table); cross-link to general validator skill |
| "Hono или Fastify на bare-metal Node для max throughput" | Ambiguous. Surface tradeoffs: steady-state high QPS → fastify; cold start / portability → hono. Cross-link both. |
| "Cloudflare D1 query внутри Hono Worker route" | **hono** PRIMARY (route + binding → load `runtimes.md` Workers + `recommended-defaults.md` D1 binding); cross-link `prisma` if Prisma D1 adapter is in use |
| "grammY Telegram webhook на Workers через Hono" | **hono** PRIMARY (HTTP shell → load `runtimes.md`); cross-link `telegram-bot` for grammY adapter |

## How to verify (manual)

1. Open a fresh session with this skill in `~/.claude/skills/hono/`.
2. Paste each Positive prompt → confirm:
   - System reminder lists `hono` as active
   - Response references files matching the "Expected behavior" column
3. Paste each Negative prompt → confirm `hono` does NOT appear, fallback skill mentioned
4. Edge cases: confirm cross-link is explicit ("primary: hono, see also: prisma/telegram-bot")

If a prompt routes wrong:
- Negative becoming Positive → tighten `description` SKIP rules
- Positive becoming Negative → add missing trigger term to `description`
- Edge routing only to one skill → enrich Related Skills cross-links

Run after any change to `SKILL.md` description or major reference restructure.
