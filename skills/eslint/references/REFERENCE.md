# eslint — Reference Index

## Decision map

| Situation | Open this file |
|---|---|
| Writing a flat config from scratch (`eslint.config.js` / `.ts`) | [flat-config.md](flat-config.md) |
| Picking a recommended preset and tuning severity | [recommended-rules.md](recommended-rules.md) |
| Adding TypeScript support, type-aware rules | [typescript-eslint.md](typescript-eslint.md) |
| Adding React, Vue, Next.js, Nuxt, or jsx-a11y plugins | [framework-plugins.md](framework-plugins.md) |
| Making ESLint and Prettier stop fighting | [prettier-coexistence.md](prettier-coexistence.md) |
| Converting `.eslintrc.*` to flat config | [migration-from-v8.md](migration-from-v8.md) |
| Wiring `eslint --cache` and `--max-warnings` into CI | [ci-integration.md](ci-integration.md) |
| Setting up VS Code / JetBrains integration | [editor-integration.md](editor-integration.md) |
| Testing routing for this skill | [eval-cases.md](eval-cases.md) |

## Quick-lookup: most-used CLI commands

| Command | What it does |
|---|---|
| `eslint .` | Lint current directory using `eslint.config.js` |
| `eslint . --fix` | Lint + auto-fix safe violations |
| `eslint . --cache` | Reuse previous results, much faster on rerun |
| `eslint . --max-warnings 0` | Treat warnings as failures (CI standard) |
| `eslint --inspect-config` | Open browser inspector to debug merged config |
| `eslint --print-config file.ts` | Print resolved config for a specific file |
| `npx @eslint/migrate-config .eslintrc.json` | Migrate legacy config to flat |

## Quick-lookup: severity levels

| Value | Meaning |
|---|---|
| `"off"` or `0` | Rule disabled |
| `"warn"` or `1` | Warning — non-zero exit only with `--max-warnings 0` |
| `"error"` or `2` | Error — non-zero exit |

## Supported file types (out of the box, JS parser)

| Extension | Notes |
|---|---|
| `.js`, `.mjs`, `.cjs` | Native |
| `.jsx` | Requires `parserOptions: { ecmaFeatures: { jsx: true } }` |
| `.ts`, `.tsx`, `.cts`, `.mts` | Requires `typescript-eslint` parser |
| `.vue` | Requires `eslint-plugin-vue` + `vue-eslint-parser` |
| `.svelte` | Requires `eslint-plugin-svelte` + `svelte-eslint-parser` |
| `.astro` | Requires `eslint-plugin-astro` + `astro-eslint-parser` |

## Version block reference

ESLint skill is registered in `sync_skill_versions.py` as `["ESLint", "TypeScript"]`. The version block above is auto-managed — do not edit manually.
