# Biome — Formatter Reference

## Philosophy

Biome's formatter is opinionated like Prettier: most decisions are not configurable. The goal is zero-config formatting consensus, not flexibility. If you need a setting that Biome doesn't expose, that is intentional.

## Prettier compatibility

Biome aims for 96%+ compatibility with Prettier output. The remaining ~4% are intentional differences or edge cases. Most migrations from Prettier produce identical output on ~95% of files.

Key compatibility guarantees:
- Same print algorithm (Wadler/Lindig)
- Same line width enforcement
- Same trailing-comma semantics (`es5`, `all`, `none`)
- Same semicolon insertion

## Configuration options

All formatter options live in `biome.json`. There is no `.prettierrc` or `.editorconfig` override.

### Global formatter settings

```json
"formatter": {
  "enabled": true,
  "indentStyle": "space",   // "space" | "tab"
  "indentWidth": 2,          // 2 or 4
  "lineWidth": 80,           // max chars per line
  "lineEnding": "lf",        // "lf" | "crlf" | "cr"
  "bracketSpacing": true,    // { key: value } vs {key: value}
  "attributePosition": "auto" // JSX: "auto" | "multiline"
}
```

### JavaScript/TypeScript formatter

```json
"javascript": {
  "formatter": {
    "quoteStyle": "double",        // "double" | "single"
    "jsxQuoteStyle": "double",     // same options, for JSX attributes
    "quoteProperties": "asNeeded", // "asNeeded" | "preserve" | "consistent"
    "trailingCommas": "all",       // "all" | "es5" | "none"
    "semicolons": "always",        // "always" | "asNeeded"
    "arrowParentheses": "always",  // "always" | "asNeeded"
    "bracketSameLine": false,      // JSX: closing > on same line as last prop
    "bracketSpacing": true,        // overrides global for JS
    "attributePosition": "auto"   // JSX attribute line-breaking
  }
}
```

### JSON formatter

```json
"json": {
  "formatter": {
    "trailingCommas": "none",    // JSON spec: "none" only; JSONC: any
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 80
  }
}
```

### CSS formatter

```json
"css": {
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 80,
    "quoteStyle": "double"     // for CSS string values
  }
}
```

## Prettier vs Biome: key differences

| Behavior | Prettier | Biome |
|---|---|---|
| Default quote style | double (JS), single (CSS) | double for both |
| Trailing commas default | `"all"` (Prettier 3) | `"all"` |
| JSX parentheses in arrow returns | yes | yes |
| Long JSX attribute wrapping | `bracketSameLine: false` | `bracketSameLine: false` |
| Object method shorthand | preserves | normalizes |
| Template literal formatting | preserves inner | normalizes |
| `.editorconfig` support | full | partial (only for unsupported files) |
| Embedded language formatting | yes (via plugins) | no plugin system |
| Markdown formatting | yes | no |
| HTML formatting | yes | no |
| GraphQL formatting | yes | no |

## `bracketSpacing` behavior

```ts
// bracketSpacing: true (default)
const obj = { key: value };

// bracketSpacing: false
const obj = {key: value};
```

## `trailingCommas` behavior

```ts
// "all" — trailing commas everywhere valid in ES2017+
function foo(
  a: string,
  b: number,   // ← trailing comma
) { ... }

const arr = [
  1,
  2,
  3,           // ← trailing comma
];

// "es5" — trailing commas only where ES5 allows (arrays, objects, not params)
function foo(
  a: string,
  b: number    // ← no trailing comma
) { ... }

// "none" — never
```

## `attributePosition` for JSX

```tsx
// "auto" — Biome decides based on line width
<Button variant="primary" onClick={handleClick} />

// When too long, wraps:
<Button
  variant="primary"
  onClick={handleClick}
  disabled={isLoading}
/>

// "multiline" — always multi-line when ≥2 attributes
<Button
  variant="primary"
  onClick={handleClick}
/>
```

## Suppressing formatting for a block

```ts
// biome-ignore format: keep manual matrix alignment
const kernel = [
  1, 0, 0,
  0, 1, 0,
  0, 0, 1,
];
```

Note: `// biome-ignore format` suppresses the formatter for the next node. There is no block-level suppression like `// prettier-ignore-start`.

## Migrating from Prettier

Run:
```bash
npx @biomejs/biome migrate prettier --write
```

This reads `.prettierrc`, `.prettierrc.json`, `.prettierrc.js`, `prettier.config.js` and maps settings to `biome.json`. After migration:

1. Delete `.prettierrc*` and `prettier.config.*`
2. Remove `prettier` from devDependencies
3. Run `biome format --write .` to normalize all files
4. Commit the formatting-only diff separately for clean history

## Per-directory formatter overrides

```json
"overrides": [
  {
    "include": ["packages/legacy/**"],
    "formatter": {
      "indentWidth": 4,
      "quoteStyle": "single"
    }
  },
  {
    "include": ["*.json"],
    "formatter": {
      "indentWidth": 4
    }
  }
]
```

## Running the formatter

```bash
# Check (read-only, non-zero exit if changes needed)
biome format .

# Auto-fix
biome format --write .

# Single file
biome format --write src/index.ts

# Pipe stdin
echo 'const x={a:1}' | biome format --stdin-file-path=test.ts
```

## Performance benchmark

Representative timings on a 50k-file TypeScript monorepo:

| Tool | Time | Notes |
|---|---|---|
| Biome | ~0.8s | Rust, parallel |
| Prettier (no cache) | ~45s | JS, sequential |
| Prettier (cache) | ~3s | Requires valid cache |

Biome is fast enough for pre-commit hooks without `--staged` filtering or parallelization tricks.

## Ignoring files from formatting

```json
"formatter": {
  "ignore": ["**/*.min.js", "src/generated/**", "dist/**"]
}
```

Files in `files.ignore` are excluded from ALL Biome operations (lint + format). Files in `formatter.ignore` are excluded only from formatting but still linted.
