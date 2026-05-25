# zod — Eval Cases

v3 format: user-voice phrasing + Expected behavior + How to verify.

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "z.string().email() is not a function в Zod 4" | Load `migration-3-to-4.md`; show `z.email()` top-level pattern |
| "discriminatedUnion не сужает тип" | Load `troubleshooting.md` discriminated-union narrowing |
| ".extend() выбрасывает ошибку в Zod 4" | Load `migration-3-to-4.md` `.extend()` accepts plain shape only |
| ".safeParse возвращает success: false — как читать errors" | Load `error-handling.md`; `.flatten()` + per-field issues |
| "z.coerce.number() для PORT env var" | Load `recommended-defaults.md` env validation + `templates/env-schema.ts.template` |
| "zodResolver + react-hook-form" | Load `integration-rhf.md` |
| "recursive schema для tree" | Load `composition.md` `z.lazy()` + `examples/recursive-tree-schema.md` |
| "branded type UserId" | Load `composition.md` brand section |
| "async refine — race condition" | Load `troubleshooting.md` async refine race |
| "transform ломает inference" | Load `troubleshooting.md` transform breaks inference |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "yup schema validation" | (no skill) | Different lib; suggest migration |
| "TypeScript conditional types" | `typescript` | Type system |
| "tRPC input validation" | (trpc if active) | tRPC owns wiring |
| "RHF без resolver" | `react-hook-form` | RHF-specific |
| "AJV JSON Schema" | (no skill) | Different lib |
| "Pydantic model" | (no skill) | Python |
| "useState в React" | `react` | No validation |
| "Fastify response serialization" | `fastify` | Framework |
| "Prisma schema design" | `prisma` | ORM |
| "zod schema через GitHub Actions" | (no skill) | CI question |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "RHF + Zod" | Both **zod** + **react-hook-form** — load both |
| "Fastify schema с Zod" | **zod** primary (schema design) + cross-link `fastify` (integration plugin) |
| "Zod vs Valibot" | **zod** primary — 90%-filter favors Zod; surface comparison briefly |
| "Server Action validation с Zod" | Both **zod** + **nextjs** — load both |
| "zod-to-json-schema для Claude tools" | **zod** — schema conversion is in scope |

## How to verify (manual)

1. Open a fresh session with `zod` loaded.
2. Paste each Positive → confirm system reminder includes `zod` and response cites expected files.
3. Paste each Negative → confirm `zod` does NOT appear and fallback is mentioned.
4. Edge: confirm cross-link is called out explicitly.

If wrong: Negative→Positive tightens SKIP rules; Positive→Negative adds missing trigger; edge to one skill needs Related Skills enrichment.
