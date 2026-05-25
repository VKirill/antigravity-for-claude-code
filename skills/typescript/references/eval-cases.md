# typescript — Eval Cases

v3 format: **user-voice phrasing** (Russian/typos/incomplete welcome) + **Expected behavior** column.

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "conditional type который distributes over union как написать" | Load `references/type-system.md` conditional types section |
| "branded type UserId vs OrderId чтобы не мешать" | Load `examples/branded-types.md`; cite `templates/utility-types.ts.template` |
| "какие tsconfig флаги добавить кроме strict: true" | Load `references/tsconfig.md` + cite `templates/tsconfig-strict.json` and `references/recommended-defaults.md` |
| "tsc тормозит, как профилировать" | Load `references/performance.md` + `references/troubleshooting.md` (slow tsc section) |
| "project references в монорепо настроить" | Load `references/tsconfig.md` project references section; cite `references/recommended-defaults.md` |
| "что делает NoInfer<T>" | Load `references/generics.md` NoInfer section |
| "satisfies vs as разница" | Load `references/type-system.md` + `references/wrong-vs-right.md` `as` vs `satisfies` pair |
| "мигрировать js в ts инкрементально" | Load `references/migration.md` + `checklists/migration-checklist.md` |
| "ts(2589) Type instantiation is excessively deep" | Load `references/troubleshooting.md` (deep instantiation section) + `references/performance.md` |
| "типы для npm пакета без @types" | Load `references/type-system.md` declaration files section |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "--experimental-strip-types в node 24" | `nodejs` | Runtime, not type system |
| "react component props не выводятся" | `react` | Framework-specific |
| "defineProps в vue 3 как типизировать" | `vue` | Vue-specific |
| "eslint c @typescript-eslint" | `eslint` | Lint config |
| "prisma type error в schema" | `prisma` | ORM-specific |
| "biome для ts проекта" | `biome` | Tooling |
| "z.infer<> с zod" | `zod` | Runtime validation types |
| "vitest setup для ts" | `vitest` | Test framework |
| "next.js server action type error" | `nextjs` | Framework-specific |
| "ts-node в продакшене" | `nodejs` | Runtime concern |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "vue composable с Ref<T>" | If core question is `Ref<T>` / Vue reactivity → **vue**; if generic inference in composable signature → **typescript** |
| "ts(2345) в zod schema" | If Zod API usage → **zod**; if TS inference behind `z.infer<>` → **typescript** |
| "type-safe event emitter" | **typescript** — discriminated union over event strings; no framework involved |
| "interface vs type для domain models" | **typescript** — structural compatibility, declaration merging |
| "tsc в CI занимает 3 минуты" | **typescript** — load `references/performance.md` + `references/troubleshooting.md` |

## How to verify (manual)

1. Open a fresh session with this skill at `~/.claude/skills/typescript/`.
2. Paste each Positive prompt → confirm:
   - System reminder lists `typescript` as active
   - Response references files matching the "Expected behavior" column
3. Paste each Negative prompt → confirm `typescript` is NOT routed; fallback is mentioned
4. Edge cases: confirm the cross-link decision is explicit

If a prompt routes wrong:
- Negative → Positive: tighten SKIP rules in description
- Positive → Negative: add the missing trigger term
- Edge routes only to one: enrich Related Skills cross-links

Run after any description or major reference restructure — that's the regression check.
