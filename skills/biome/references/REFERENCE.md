# biome — Reference Index

## Decision map

| Situation | Open this file |
|---|---|
| Setting up Biome from scratch, all `biome.json` options | [configuration.md](configuration.md) |
| Finding or tuning a specific lint rule | [lint-rules.md](lint-rules.md) |
| Formatter options, Prettier diff, per-language settings | [formatter.md](formatter.md) |
| Migrating from ESLint or Prettier | [migration-from-eslint-prettier.md](migration-from-eslint-prettier.md) |
| CI pipeline, GitHub Actions, lefthook, husky | [ci-integration.md](ci-integration.md) |
| Testing skill routing (positive/negative prompts) | [eval-cases.md](eval-cases.md) |

## Quick-lookup: most-used CLI commands

| Command | What it does |
|---|---|
| `biome check .` | Lint + format check + organize imports (read-only) |
| `biome check --write .` | Same, auto-fix everything |
| `biome format --write .` | Format only, auto-fix |
| `biome lint --write .` | Lint only, auto-fix |
| `biome ci .` | CI-safe check: no writes, non-zero on violation |
| `biome ci --changed --since=main .` | CI check: only files changed vs base branch |
| `biome migrate eslint --write` | Auto-migrate `.eslintrc.*` → `biome.json` |
| `biome migrate prettier --write` | Auto-migrate `.prettierrc` → `biome.json` |
| `biome init` | Scaffold a starter `biome.json` |

## Quick-lookup: suppression comment syntax

```ts
// biome-ignore lint/<category>/<rule>: <reason>
// biome-ignore format: <reason>
```

Both must appear on the line immediately above the affected node. Biome reports unused suppressions as errors.

## Supported languages

| Language | Extension(s) | Lint | Format | Organize Imports |
|---|---|---|---|---|
| JavaScript | `.js`, `.cjs`, `.mjs` | Yes | Yes | Yes |
| TypeScript | `.ts`, `.cts`, `.mts` | Yes | Yes | Yes |
| JSX | `.jsx` | Yes | Yes | Yes |
| TSX | `.tsx` | Yes | Yes | Yes |
| JSON | `.json` | Yes (limited) | Yes | No |
| JSONC | `.jsonc` | Yes (limited) | Yes | No |
| CSS | `.css` | Partial | Yes | No |

Not supported: `.vue` SFCs (only the JS/TS blocks inside are touched if extracted), `.svelte`, `.astro`, Rust, Go, Python.

## Version block reference

Biome is in `SKILL_STACKS` in `sync_skill_versions.py` as `["Biome", "TypeScript"]`. The version block is auto-managed — do not edit manually.
