---
name: eslint
description: "ESLint 10 — JS/TS linter with flat config, typescript-eslint, framework plugins, Prettier/Biome coexistence. Use when: eslint, eslint.config.js, eslint.config.ts, flat config, typescript-eslint, eslint-plugin-react, eslint-plugin-vue, next/core-web-vitals, @nuxt/eslint, eslint-config-prettier, .eslintrc migration, custom rules, eslint --fix, --cache, lint-staged. SKIP: Biome-only projects (→biome), Prettier-only formatting, Standard JS, dprint."
stacks:
  - lint-format
packages:
  - "eslint"
  - "typescript-eslint"
  - "@eslint/js"
tags:
  - eslint
  - lint
  - flat-config
  - javascript
  - typescript
  - dx
source: vechkasov-global-skills
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- ESLint: `10.x`
- TypeScript: `6.0.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need, then follow the link to the relevant reference file for full detail.

## Use this skill when

- Configuring ESLint 10 from scratch with flat config (`eslint.config.js` / `eslint.config.ts`)
- Migrating an existing project from `.eslintrc.*` legacy config to flat config (`@eslint/migrate-config` or manual)
- Wiring `typescript-eslint` (parser + plugin) with type-aware rules (`parserOptions.projectService`)
- Adding framework plugins: `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-vue`, `eslint-plugin-jsx-a11y`, `@next/eslint-plugin-next`, `@nuxt/eslint`
- Layering `next/core-web-vitals` or `@nuxt/eslint-config` on top of `@eslint/js` recommended
- Coexisting with Prettier via `eslint-config-prettier` (turn off conflicting style rules)
- Coexisting with Biome (ESLint handles framework rules, Biome handles format + base lint)
- Setting up `eslint --fix`, `eslint --cache`, and incremental lint in CI
- Configuring editor integration (VS Code `dbaeumer.vscode-eslint`, JetBrains)
- Writing custom rules or sharing config across a monorepo
- Investigating "Parsing error", "no-undef on TypeScript", or `tsconfig.json` `include` mismatches

## Do not use this skill when

- The project uses Biome as the single linter/formatter with no ESLint — use `biome`
- The task is Prettier-only formatting (no ESLint involved) — handled as cascade dep of `eslint` or skip
- The task is TypeScript type-checking (`tsc --noEmit`) — that is `typescript`
- The task is dprint, Standard JS, or XO — different tools
- The task is ESLint plugin authoring at the AST level for a niche rule — load this skill but expect to also load `typescript` for AST/typing detail

## Purpose

ESLint 10 is the mainstream JavaScript/TypeScript linter when Biome's rule set is insufficient — specifically when a project needs React, Vue, Next.js, Nuxt, Storybook, jsx-a11y, or custom-authored rules that have no Biome equivalent. Flat config (`eslint.config.js`) is the only supported config format in v10; legacy `.eslintrc.*` has been removed.

This skill covers the full ESLint 10 lifecycle: flat config authoring (JS or TS), `typescript-eslint` integration, framework plugin composition, Prettier coexistence, migration from v8/v9 `.eslintrc`, CI integration with caching, and editor setup. It hands off to `biome` for projects that have already adopted Biome end-to-end, and to `typescript` for type-system questions.

What this skill does NOT do: Biome configuration, Prettier-only formatting, or `tsc` type-checking.

## Capabilities

Each line below points to the canonical reference. The reference owns code, edge cases, and gotchas.

- **Flat config** — array of config objects, no `extends` (composition via spread). `eslint.config.ts` supported natively in v10 (no `tsx`/`ts-node` needed). `defineConfig` helper from `eslint/config` for type-safe definition. → [references/flat-config.md](references/flat-config.md)
- **Recommended rules** — three baseline presets: `js.configs.recommended` + `tseslint.configs.recommended` (or `recommendedTypeChecked`) + framework preset. → [references/recommended-rules.md](references/recommended-rules.md)
- **typescript-eslint** — `tseslint.config()` helper; use `parserOptions.projectService: true` (NOT legacy `project: "./tsconfig.json"`); requires `tsconfigRootDir: import.meta.dirname` in monorepos. → [references/typescript-eslint.md](references/typescript-eslint.md)
- **Framework plugins** — React (`eslint-plugin-react` + `react-hooks`), Vue (`eslint-plugin-vue` flat), Next (`next/core-web-vitals`), Nuxt (`@nuxt/eslint` module-generated), a11y (`eslint-plugin-jsx-a11y`). → [references/framework-plugins.md](references/framework-plugins.md)
- **Prettier coexistence** — `eslint-config-prettier` LAST in array; NEVER `eslint-plugin-prettier` (slow, noisy). → [references/prettier-coexistence.md](references/prettier-coexistence.md)
- **Migration v8 → 10** — `npx @eslint/migrate-config .eslintrc.json` generates `eslint.config.js`; manually review plugins/extends/overrides. ESLint 10 removed legacy config entirely. → [references/migration-from-v8.md](references/migration-from-v8.md)
- **CI** — `eslint . --max-warnings 0 --cache --cache-location node_modules/.cache/eslint`; restore cache between runs. → [references/ci-integration.md](references/ci-integration.md)
- **Editor** — `dbaeumer.vscode-eslint` extension; `eslint.useFlatConfig: true` (default in recent versions); `editor.codeActionsOnSave.source.fixAll.eslint: explicit`. → [references/editor-integration.md](references/editor-integration.md)
- **Biome coexistence** — Biome format + base lint; ESLint for framework rules with no Biome equivalent. Use `eslint-config-prettier` at end to neutralise style rules duplicated by Biome's formatter. → [references/prettier-coexistence.md](references/prettier-coexistence.md)

## Behavioral Traits

- Defaults to `eslint.config.ts` (typed config) over `eslint.config.js` when the project already uses TypeScript
- Always pins `eslint`, `typescript-eslint`, and `@eslint/js` together — version drift between them causes obscure errors
- Uses `projectService: true` over the legacy `project:` field for type-aware linting
- Puts `eslint-config-prettier` last in the array — order matters, it must override earlier style rules
- Adds `--cache` to every `eslint` invocation in CI and pre-commit
- Prefers `tseslint.config()` helper over hand-spreading arrays — gives type safety and better error messages
- Scopes type-aware rules to `**/*.{ts,tsx}` via `files` glob — avoids parsing `.js` files with TS parser
- Treats `next/core-web-vitals` as the source of truth for Next.js — does not override its rules without justification
- Does not run Prettier through ESLint (`eslint-plugin-prettier` is anti-pattern in 2026)

## Important Constraints

- NEVER mix `.eslintrc.*` and `eslint.config.js` in the same project — ESLint 10 ignores legacy config entirely
- NEVER use `eslint-plugin-prettier` — slow, noisy diagnostics; use `eslint-config-prettier` only
- NEVER omit `tsconfigRootDir` when using `projectService` — relative path resolution fails in monorepos
- NEVER lint generated files (`dist/`, `.next/`, `node_modules/`) — always `ignores` them at the top of the config
- ALWAYS run `eslint --fix` before committing — catches auto-fixable rule violations
- ALWAYS scope React/Vue plugin configs with `files: ["**/*.{jsx,tsx}"]` or `["**/*.vue"]` — avoid parsing every file with framework parsers
- NEVER add `eslint-plugin-import` for module resolution in 2026 — `typescript-eslint`'s `consistent-type-imports` and TypeScript's `verbatimModuleSyntax` cover the same ground faster
- ALWAYS verify `typescript-eslint` major version matches the `typescript` major version range it supports

## Related Skills

**90%-filter applied** — cascade markers for mainstream stacks only.

### Language / type-checking
- ✓ `typescript` — TS type system (ESLint enforces style + bug-class rules, `tsc` does type-check)

### Framework cascades (ESLint plugins live here)
- ✓ `react` — React 19 + `eslint-plugin-react-hooks`
- ✓ `nextjs` — Next.js 16 + `next/core-web-vitals`
- ✓ `vue` — Vue 3.5 + `eslint-plugin-vue`
- ✓ `nuxt` — Nuxt 4 + `@nuxt/eslint`

### Runtime / tooling
- ✓ `nodejs` — Node.js 24 (runtime for ESLint binary, hooks)

### Alternative
- ✓ `biome` — Biome 2 (faster all-in-one alternative; common partial-coexistence pattern)

### Cascade markers (loaded only if active)
- `prettier` — formatting peer (use `eslint-config-prettier`)

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Index, decision map, CLI quick-lookup | [references/REFERENCE.md](references/REFERENCE.md) |
| Flat config (`eslint.config.js` / `eslint.config.ts`) full reference | [references/flat-config.md](references/flat-config.md) |
| Recommended rule presets and severity tuning | [references/recommended-rules.md](references/recommended-rules.md) |
| `typescript-eslint` parser + plugin + type-aware rules | [references/typescript-eslint.md](references/typescript-eslint.md) |
| Framework plugins: React, Vue, Next.js, Nuxt, jsx-a11y | [references/framework-plugins.md](references/framework-plugins.md) |
| Prettier coexistence via `eslint-config-prettier` | [references/prettier-coexistence.md](references/prettier-coexistence.md) |
| Migration from v8 `.eslintrc.*` to flat config | [references/migration-from-v8.md](references/migration-from-v8.md) |
| CI integration: GitHub Actions, caching, `--max-warnings` | [references/ci-integration.md](references/ci-integration.md) |
| Editor integration: VS Code, JetBrains, format-on-save | [references/editor-integration.md](references/editor-integration.md) |
| Eval cases (routing tests) — positive/negative/edge prompts | [references/eval-cases.md](references/eval-cases.md) |

### Templates

Production-ready configs — copy and adjust:

| Template | File |
|---|---|
| `eslint.config.ts` — TS strict + React + typescript-eslint | [templates/eslint.config.react.ts.template](templates/eslint.config.react.ts.template) |
| `eslint.config.ts` — Node.js backend (no React) | [templates/eslint.config.node.ts.template](templates/eslint.config.node.ts.template) |
| `package.json` lint/CI scripts | [templates/package.json.scripts.json](templates/package.json.scripts.json) |

### Examples

| Scenario | File |
|---|---|
| Full migration walkthrough: `.eslintrc.json` → `eslint.config.ts` | [examples/migrate-eslintrc-to-flat.md](examples/migrate-eslintrc-to-flat.md) |

**How to use**: navigate to the specific file for the topic you need. Don't read all files — look up only what's relevant to the current task.
