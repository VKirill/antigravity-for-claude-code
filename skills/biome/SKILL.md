---
name: biome
description: "Biome 2 — Rust-based lint + format for JS/TS/JSON/CSS. Use when: biome, biome.json, biome.jsonc, biome check, biome format, biome lint, biome ci, ESLint replacement, Prettier replacement, fast formatter, single-file-config, organize imports, recommended rules, suppression comments, VS Code Biome extension, pre-commit hook. SKIP: ESLint-specific flat config (→eslint), Prettier-only formatting questions, dprint."
stacks:
  - lint-format
packages:
  - "@biomejs/biome"
tags:
  - biome
  - lint
  - format
  - javascript
  - typescript
  - json
  - css
  - dx
source: vechkasov-global-skills
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Biome: `2.x`
- TypeScript: `6.0.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need, then follow the link to the relevant reference file for full detail.

## Use this skill when

- Configuring Biome for a new or existing JS/TS/JSON/CSS project (`biome.json` / `biome.jsonc`)
- Running `biome check`, `biome format`, `biome lint`, or `biome ci` and interpreting output
- Replacing ESLint + Prettier with Biome in an existing project (`biome migrate eslint` / `biome migrate prettier`)
- Tuning linter rules — enabling, disabling, or changing severity of specific rules
- Setting up organize imports (automatic import sorting as part of `biome check`)
- Wiring Biome into a pre-commit hook (lefthook, husky, lint-staged)
- Configuring `biome ci` for CI environments (exit codes, reporters, `--changed`)
- Installing and configuring the VS Code Biome extension as default formatter
- Writing or reviewing suppression comments (`// biome-ignore`)
- Handling overrides for specific file patterns (e.g., different rules for `*.test.ts`)
- Performance comparison with ESLint/Prettier (Biome is 10–100x faster for large repos)

## Do not use this skill when

- The task is exclusively ESLint flat config, custom plugins, or ESLint rule authoring — use `eslint`
- The task is Prettier-only formatting with no Biome involvement — Prettier knowledge is in `eslint` cascade
- The codebase uses dprint or standardjs and there is no Biome present
- The task is TypeScript type-checking (`tsc --noEmit`) — that is `typescript`, not a formatter
- The task is Rust or Go formatting — Biome does not support those languages

## Purpose

Biome 2 is a single Rust binary that replaces ESLint + Prettier in one pass. It ships a built-in rule set (no plugin system), a formatter opinionated like Prettier, and an organize-imports linter rule — all configured from a single `biome.json`. At this speed (10–100x faster than ESLint + Prettier on large repos), Biome runs comfortably in pre-commit hooks and CI without special caching.

This skill covers the full Biome lifecycle: initial configuration, rule tuning, organize imports, migration from ESLint/Prettier, CI integration, VS Code extension setup, suppression comments, and per-pattern overrides. It hands off to `eslint` for projects that retain ESLint alongside Biome (partial adoption), and to `typescript` for type-system questions.

What this skill does NOT do: ESLint plugin authoring, Prettier configuration-only questions, dprint, or TypeScript type checking.

## Capabilities

Each line below points to the canonical reference. The reference owns code, edge cases, and gotchas.

- **Configuration** — single `biome.json` / `biome.jsonc` at root: `$schema`, `vcs`, `files`, `formatter`, `linter`, `assist`, `overrides`. → [references/configuration.md](references/configuration.md)
- **Lint rules** — ~300 rules across `correctness` / `suspicious` / `style` / `performance` / `a11y` / `security` / `nursery`. Severity: `error` / `warn` / `info` / `off`. `"recommended": true` activates curated safe subset. → [references/lint-rules.md](references/lint-rules.md)
- **Formatter** — Prettier-compatible (not identical). Double quotes default, opinionated trailing commas. `biome check --write` = format + lint fixes in one pass. → [references/formatter.md](references/formatter.md)
- **Organize imports / assist** — Biome 2: `assist.actions.source.organizeImports`. Sort third-party before relative, alphabetical within groups. Disable per-glob via `overrides`. → [references/configuration.md](references/configuration.md)
- **Suppression** — `// biome-ignore lint/<category>/<rule>: <reason>` on line above. Unused suppressions reported as errors (breaks CI). → [references/lint-rules.md](references/lint-rules.md)
- **Migration** — `npx @biomejs/biome migrate eslint --write` + `migrate prettier --write`. Maps known rules, prints unmapped. → [references/migration-from-eslint-prettier.md](references/migration-from-eslint-prettier.md)
- **CI** — `biome ci` (not `check`) — non-zero exit, no implicit writes, `--changed --since=main` for diff-only. → [references/ci-integration.md](references/ci-integration.md)
- **VS Code** — extension `biomejs.biome` as `editor.defaultFormatter` + `formatOnSave` + `source.organizeImports.biome`. → [templates/.vscode/settings.json](templates/.vscode/settings.json)
- **Performance** — ~200k LOC/sec single-core; ~10–100× faster than ESLint + Prettier. Pre-commit viable without `--staged` caching.

## Behavioral Traits

- Chooses `biome.jsonc` over `biome.json` whenever the project would benefit from inline comments
- Always enables `"vcs": { "useIgnoreFile": true }` — respects `.gitignore` automatically
- Runs `biome check --write` (not separate format + lint) to apply all fixes in one pass
- Uses `biome ci` (not `biome check`) in CI — correct exit codes, no accidental writes
- Adds `"$schema"` line to every `biome.json` for IDE completion
- Checks for unmapped ESLint rules after `migrate eslint` and addresses them explicitly
- Treats suppression comments as technical debt — documents them with a reason, tracks them
- Prefers `overrides` for file-pattern exceptions rather than global rule disables
- Confirms Biome version matches `$schema` URL on every generated config

## Important Constraints

- NEVER mix `biome check` and `biome ci` in the same pipeline stage — `check` can silently succeed on violations if `--write` is not used; `ci` is the correct CI command
- NEVER leave unused suppression comments — Biome reports them as errors, breaking CI
- NEVER configure Biome to allow `--write` in CI — CI runs must be read-only lint checks
- ALWAYS set `"vcs": { "enabled": true, "useIgnoreFile": true }` — without this, Biome ignores `.gitignore`
- ALWAYS add `"$schema"` to `biome.json` — required for IDE autocompletion
- NEVER add `biome.json` rules for languages Biome does not support (Rust, Go, Python) — Biome silently ignores unsupported files, but the config is misleading
- ALWAYS run `biome migrate eslint --write` before manually editing rules — avoids duplicating what the migrator already handles

## Related Skills

**90%-filter applied** — cascade markers for mainstream stacks only.

### Language / type-checking
- ✓ `typescript` — TS type system (Biome formats/lints TS but does not type-check)

### Framework cascades (Biome is the linter/formatter)
- ✓ `react` — React 19 (Biome handles JSX/TSX formatting)
- ✓ `nextjs` — Next.js 16 (common Biome consumer)
- ✓ `vue` — Vue 3.5 (Biome supports `.vue` indirectly via JS/TS blocks)
- ✓ `nuxt` — Nuxt 4

### Legacy / comparison
- ✓ `eslint` — ESLint 10 (alternative/legacy; migration source)

### CI / tooling
- ✓ `nodejs` — Node.js 24 (runtime context for `npx @biomejs/biome`)

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Index + decision map + quick-lookup table | [references/REFERENCE.md](references/REFERENCE.md) |
| `biome.json` full option reference, overrides, ignore patterns, VCS integration | [references/configuration.md](references/configuration.md) |
| Lint rule catalog: categories, recommended set, enable/disable, severity | [references/lint-rules.md](references/lint-rules.md) |
| Formatter options, Prettier compatibility matrix, JS/TS/JSON/CSS differences | [references/formatter.md](references/formatter.md) |
| Migration from ESLint + Prettier: commands, unmapped rules, cleanup checklist | [references/migration-from-eslint-prettier.md](references/migration-from-eslint-prettier.md) |
| CI integration: `biome ci`, GitHub Actions, GitLab CI, lefthook, husky | [references/ci-integration.md](references/ci-integration.md) |
| Eval cases (routing tests) + positive/negative prompts | [references/eval-cases.md](references/eval-cases.md) |

### Templates

Production-ready configs — copy and adjust:

| Template | File |
|---|---|
| `biome.json` production preset (recommended rules + organize imports) | [templates/biome.json](templates/biome.json) |
| `biome.jsonc` with inline comments explaining every option | [templates/biome.jsonc](templates/biome.jsonc) |
| `.vscode/settings.json` — Biome as default formatter + format-on-save | [templates/.vscode/settings.json](templates/.vscode/settings.json) |

### Examples

| Scenario | File |
|---|---|
| Step-by-step ESLint + Prettier → Biome migration with unmapped rule handling | [examples/migrate-from-eslint.md](examples/migrate-from-eslint.md) |

### Checklists

| Checklist | File |
|---|---|
| Biome adoption: pre-flight, acceptance, team-rollout checklist | [checklists/biome-adoption.md](checklists/biome-adoption.md) |

**How to use**: navigate to the specific file for the topic you need. Don't read all files — look up only what's relevant to the current task.
