# eslint — Eval Cases

v3 format: **user-voice phrasing** + **Expected behavior** column (which sub-files / templates should load, not just "skill activates").

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "поставь eslint flat config в новый ts-проект" | Load `flat-config.md` + `typescript-eslint.md`; cite `templates/eslint.config.node.ts.template` |
| "мигрируй .eslintrc.json в eslint.config.ts" | Load `migration-from-v8.md`; cite `npx @eslint/migrate-config` + manual review of plugins/extends/overrides |
| "typescript-eslint projectService для монорепо" | Load `typescript-eslint.md`; flag `tsconfigRootDir: import.meta.dirname` requirement |
| "eslint и prettier дерутся, что отключить" | Load `prettier-coexistence.md`; cite `eslint-config-prettier` LAST in array, NOT `eslint-plugin-prettier` |
| "next/core-web-vitals в flat config" | Load `framework-plugins.md` Next section; cite `@next/eslint-plugin-next` registration pattern |
| "@nuxt/eslint модуль в Nuxt 4" | Load `framework-plugins.md` Nuxt section; cite module-generated config flow |
| "eslint --max-warnings 0 --cache в ci" | Load `ci-integration.md`; cite cache-restore pattern across runs |
| "vscode eslint flat config не подсвечивает ошибки" | Load `editor-integration.md`; cite `eslint.useFlatConfig: true` + `codeActionsOnSave.source.fixAll.eslint` |
| "lint-staged запускает eslint на staged файлах" | Load `ci-integration.md` pre-commit section |
| "type-aware rules медленно работают на большом проекте" | Load `typescript-eslint.md` perf section + `troubleshooting` notes (scoped `files` glob `**/*.{ts,tsx}`) |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "поставь Biome заместо eslint+prettier" | `biome` | Biome-only adoption, ESLint replaced |
| "tsc --noEmit падает" | `typescript` | Type-check, not lint |
| "Prettier ignore patterns настройка" | (no skill) | Prettier-only |
| "dprint для js" | (no skill) | Different tool |
| "Vitest snapshot diff" | `vitest` | Test runner |
| "vue 3 SFC `<script setup>` type narrowing" | `vue` | Vue compiler/types, not lint rules |
| "biome.jsonc rules" | `biome` | Biome config |
| "standardjs auto-fix" | (no skill) | Different linter |
| "go vet config" | (no skill) | Go ecosystem |
| "stylelint для css modules" | (no skill — cascade) | CSS-only linter, separate skill |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "ESLint + Biome одновременно — как поделить ответственность" | **eslint** primary (`prettier-coexistence.md` end-of-array tactic) + cross-link `biome`. Pattern: Biome format + base lint; ESLint react-hooks + next/core-web-vitals + custom. |
| "пишу плагин eslint, нужны ast utils" | **eslint** primary (load `flat-config.md` plugin authoring) + cross-link `typescript` for AST/typing. Note: AST utilities live in `typescript-eslint/utils`. |
| "выключи `no-unused-vars` для `_` префикса" | **eslint** primary (`recommended-rules.md` severity tuning) — show `argsIgnorePattern: '^_'` config snippet |
| "ESLint 10 не видит мой eslint.config.ts" | **eslint** primary (`flat-config.md` v10 TS loader section); flag node version + bundled loader requirement |
| "Nuxt @nuxt/eslint vs ручной flat config" | **eslint** primary + `nuxt` cross-link. Recommend module unless project has special composition needs. |

## How to verify (manual)

1. Open a fresh session with this skill in `~/.claude/skills/eslint/`.
2. Paste each Positive prompt → confirm:
   - The system reminder lists `eslint` as an active skill
   - The response references files matching the "Expected behavior" column
3. Paste each Negative prompt → confirm `eslint` does NOT appear in the routed skill response, and the suggested fallback skill is mentioned.
4. Edge cases: confirm response surfaces cross-link explicitly ("primary: eslint, see also: biome/typescript/nuxt").

If a prompt routes wrong:
- Negative becoming Positive → tighten the `description` SKIP rules
- Positive becoming Negative → add the missing trigger term to `description`
- Edge routing only to one skill → enrich Related Skills cross-links

Run after any change to `SKILL.md` description or major reference restructure.
