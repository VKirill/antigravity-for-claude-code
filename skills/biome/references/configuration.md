# Biome — Configuration Reference

Full `biome.json` / `biome.jsonc` option reference for Biome 2.

## File location

Biome looks for config in this order:
1. `biome.json` or `biome.jsonc` in the current working directory
2. Walking up to parent directories
3. `--config-path` CLI flag to specify a custom path

For monorepos: place a root `biome.json` and per-package `biome.json` with `"extends"` to share rules.

## Top-level schema

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.0/schema.json",
  "extends": [],
  "root": true,
  "vcs": { ... },
  "files": { ... },
  "formatter": { ... },
  "linter": { ... },
  "organizeImports": { ... },
  "javascript": { ... },
  "json": { ... },
  "css": { ... },
  "overrides": [ ... ]
}
```

## `$schema`

Always include. Enables IDE autocompletion. Must match installed Biome version:
```json
"$schema": "https://biomejs.dev/schemas/2.4.0/schema.json"
```

## `extends`

Array of paths to other `biome.json` files. Later entries override earlier:
```json
"extends": ["../../biome.json"]
```

Used in monorepos: root config → package-specific overrides.

## `root`

```json
"root": true
```

When `true`, stops walking up to parent configs. Set in root config to prevent unintended inheritance.

## `vcs`

Version control integration:
```json
"vcs": {
  "enabled": true,
  "clientKind": "git",
  "useIgnoreFile": true,
  "defaultBranch": "main"
}
```

- `enabled` — turns on VCS integration
- `clientKind` — only `"git"` supported
- `useIgnoreFile` — respects `.gitignore` automatically (recommended: always `true`)
- `defaultBranch` — used by `biome ci --changed --since=<branch>`

## `files`

```json
"files": {
  "maxSize": 1048576,
  "ignoreUnknown": false,
  "ignore": ["dist", "node_modules", ".next", "build", "coverage", "*.min.js"]
}
```

- `maxSize` — max file size in bytes (default: 1MB). Files larger than this are skipped.
- `ignoreUnknown` — if `true`, silently skip files with unsupported extensions (vs. warn)
- `ignore` — glob patterns relative to config file. Supports `**` glob syntax.

## `formatter`

Global formatter settings (apply to all languages unless overridden per-language):

```json
"formatter": {
  "enabled": true,
  "indentStyle": "space",
  "indentWidth": 2,
  "lineWidth": 100,
  "lineEnding": "lf",
  "attributePosition": "auto",
  "bracketSpacing": true,
  "ignore": ["*.generated.ts"]
}
```

- `indentStyle`: `"space"` (default) or `"tab"`
- `indentWidth`: 2 or 4 (only meaningful when `indentStyle: "space"`)
- `lineWidth`: max characters per line before wrapping (default: 80)
- `lineEnding`: `"lf"` (default), `"crlf"`, `"cr"`. Use `"lf"` everywhere.
- `bracketSpacing`: space inside object `{ key: value }` (default: `true`)
- `attributePosition`: `"auto"` | `"multiline"` — JSX/HTML attribute layout

## `linter`

```json
"linter": {
  "enabled": true,
  "rules": {
    "recommended": true,
    "correctness": {
      "noUnusedVariables": "error",
      "noUnusedImports": "error"
    },
    "suspicious": {
      "noExplicitAny": "warn"
    },
    "style": {
      "useConst": "error",
      "noVar": "error",
      "useTemplate": "warn"
    },
    "performance": {
      "noAccumulatingSpread": "warn"
    },
    "a11y": {
      "useAltText": "error"
    },
    "nursery": {
      "noSecrets": "warn"
    }
  },
  "ignore": ["src/generated/**"]
}
```

Rule severity values: `"error"` | `"warn"` | `"info"` | `"off"`.

`"recommended": true` activates ~150 safe rules. Override individual rules after enabling recommended.

## `organizeImports`

```json
"organizeImports": {
  "enabled": true,
  "ignore": ["src/polyfills.ts"]
}
```

When enabled, runs as part of `biome check --write`. Sort order: built-ins → external → relative, then alphabetical within each group. This is fixed — not configurable like ESLint `import/order`.

## `javascript`

Language-specific formatter and parser options:

```json
"javascript": {
  "formatter": {
    "quoteStyle": "double",
    "jsxQuoteStyle": "double",
    "quoteProperties": "asNeeded",
    "trailingCommas": "all",
    "semicolons": "always",
    "arrowParentheses": "always",
    "bracketSameLine": false,
    "bracketSpacing": true,
    "attributePosition": "auto"
  },
  "parser": {
    "unsafeParameterDecoratorsEnabled": false
  },
  "globals": ["__dirname", "__filename"]
}
```

- `quoteStyle`: `"double"` (Biome default) or `"single"`
- `trailingCommas`: `"all"` | `"es5"` | `"none"`
- `semicolons`: `"always"` | `"asNeeded"`
- `globals`: array of globally-available names (suppresses `noUndeclaredVariables` for them)
- `unsafeParameterDecoratorsEnabled`: enable TypeScript experimental decorators (legacy)

## `json`

```json
"json": {
  "formatter": {
    "trailingCommas": "none"
  },
  "parser": {
    "allowComments": true,
    "allowTrailingCommas": true
  }
}
```

`allowComments` + `allowTrailingCommas` effectively turns JSON parsing into JSONC mode.

## `css`

```json
"css": {
  "formatter": {
    "quoteStyle": "double",
    "indentWidth": 2
  },
  "linter": {
    "enabled": true
  }
}
```

CSS linting in Biome 2 is partial — covers common correctness rules (unknown properties, duplicate selectors) but not the full Stylelint rule set.

## `overrides`

Per-file-pattern overrides that replace the global config for matching files:

```json
"overrides": [
  {
    "include": ["*.test.ts", "*.spec.ts"],
    "linter": {
      "rules": {
        "suspicious": { "noExplicitAny": "off" }
      }
    }
  },
  {
    "include": ["scripts/**/*.js"],
    "linter": {
      "rules": {
        "style": { "noVar": "off" }
      }
    }
  },
  {
    "include": ["*.json"],
    "formatter": { "indentWidth": 4 }
  }
]
```

`include` uses glob patterns. `overrides` entries are applied in order; last match wins per key.

## Monorepo pattern

Root `biome.json`:
```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.0/schema.json",
  "root": true,
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "formatter": { "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "linter": { "rules": { "recommended": true } },
  "organizeImports": { "enabled": true }
}
```

Package `packages/ui/biome.json`:
```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.0/schema.json",
  "extends": ["../../biome.json"],
  "javascript": {
    "formatter": { "jsxQuoteStyle": "double" }
  },
  "linter": {
    "rules": {
      "a11y": { "useAltText": "error" }
    }
  }
}
```

## Common gotchas

- Biome does NOT read `.editorconfig` for all settings — it reads `biome.json` exclusively. EditorConfig may affect indentation for unsupported file types, but for JS/TS/JSON/CSS, `biome.json` wins.
- `"ignoreUnknown": false` is the default — Biome will warn about files it can't parse. Set to `true` if your project has many unsupported file types.
- Glob patterns in `ignore` are relative to the `biome.json` location. Use `**` for recursive patterns.
- The `$schema` URL must match the installed version of `@biomejs/biome`. A mismatch causes unknown property warnings in IDEs.
