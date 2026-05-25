# biome — Eval Cases

v3 format: **user-voice phrasing** (Russian/typos/incomplete welcome) + **Expected behavior** column (which sub-files / templates should load, not just "skill activates").

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "поставь биом в проект, заменим eslint+prettier" | Load `migration-from-eslint-prettier.md` + `templates/biome.jsonc`; cite `biome migrate eslint --write` flow |
| "biome.json для монорепо, разные правила в packages/*" | Load `configuration.md` (overrides section); show glob-based `overrides` array |
| "biome check падает на CI, экзит 1 а локально ок" | Load `ci-integration.md`; flag `biome check` vs `biome ci` mismatch + `--write` ban in CI |
| "включить organize imports в biome 2" | Load `configuration.md`; cite `assist.actions.source.organizeImports = "on"` (NOT old `organizeImports.enabled`) |
| "suppress noExplicitAny on one line" | Load `lint-rules.md` suppression section; cite `// biome-ignore lint/suspicious/noExplicitAny: <reason>` |
| "biome jsonc with comments where i can explain each field" | Cite `templates/biome.jsonc` directly |
| "Biome VS Code не форматит .ts на сохранении" | Cite `templates/.vscode/settings.json`; flag `editor.defaultFormatter = biomejs.biome` |
| "migrate eslint --write оставил какие-то правила unmapped" | Load `migration-from-eslint-prettier.md` (unmapped table) + `examples/migrate-from-eslint.md` walkthrough |
| "lefthook pre-commit hook for biome" | Load `ci-integration.md` hooks section |
| "почему biome 2 быстрее eslint в 50 раз" | Load SKILL.md Performance bullet; reference benchmark notes |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "напиши кастомное правило eslint" | `eslint` | Plugin authoring, Biome has no plugin system |
| "tsc --noEmit fails" | `typescript` | Type-checking, not linting/formatting |
| "prettier-plugin-tailwindcss order" | `tailwind` / `eslint` | Prettier-only ecosystem, not Biome |
| "dprint config for Rust" | (no skill) | Different tool, Biome doesn't support Rust |
| "Jest snapshot mismatch" | `vitest` | Test runner, unrelated |
| "ESLint flat config typescript-eslint strict" | `eslint` | ESLint-specific surface |
| "Prettier ignore patterns" | (no skill) | Prettier-only |
| "standardjs setup" | (no skill) | Different linter |
| "Go gofmt config" | (no skill) | Go ecosystem |
| "vue SFC `<script setup>` formatting fails in editor" | `vue` + biome (secondary) | Vue tool chain primary; biome only formats JS/TS blocks |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "Biome vs ESLint — что выбрать в новом проекте" | **biome** primary (comparison about Biome adoption); surface tradeoffs from SKILL.md Performance + lint-rules sections. Cross-link `eslint` for cases requiring plugins. |
| "оставить eslint для react-hooks, biome для всего остального" | **biome** primary (`configuration.md` overrides) + cross-link `eslint`. Pattern: ESLint runs only on `*.tsx` with react-hooks plugin; Biome handles format + base lint. |
| "Biome 1 → Biome 2 migration" | **biome** primary; load `configuration.md` (Biome 2 schema changes: `assist` replaces `organizeImports.enabled` at top level). Cite `$schema` URL bump. |
| "Biome в Next.js проекте — что выключить" | **biome** primary + `nextjs` cross-link. Disable rules conflicting with Next conventions (e.g. `useImportType` on type-only imports from `next/*`). |
| "Biome для `.vue` файлов" | **biome** primary with caveat. Biome 2 has no native `.vue` parser; only formats JS/TS `<script>` blocks via overrides. Recommend Volar + Biome split; cross-link `vue`. |

## How to verify (manual)

1. Open a fresh session with this skill in `~/.claude/skills/biome/`.
2. Paste each Positive prompt → confirm:
   - The system reminder lists `biome` as an active skill
   - The response references files matching the "Expected behavior" column
3. Paste each Negative prompt → confirm `biome` does NOT appear in the routed skill response, and the suggested fallback skill is mentioned.
4. Edge cases: confirm response surfaces both surfaces explicitly ("primary: biome, see also: eslint/nextjs/vue").

If a prompt routes wrong:
- Negative becoming Positive → tighten the `description` SKIP rules
- Positive becoming Negative → add the missing trigger term to `description`
- Edge routing only to one skill → enrich Related Skills cross-links

Run after any change to `SKILL.md` description or major reference restructure.
