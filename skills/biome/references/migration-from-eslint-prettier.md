# Biome — Migration from ESLint + Prettier

## When to migrate

Migrate to Biome when:
- ESLint + Prettier are the only lint/format tools (no custom plugins)
- Pre-commit hooks or CI are slow due to ESLint startup time
- The team wants a single config file with no toolchain coordination

Do NOT migrate if the project relies on ESLint plugins without Biome equivalents (e.g., `eslint-plugin-security`, `eslint-plugin-import` for complex resolution rules, framework-specific plugins like `eslint-plugin-jest` edge cases).

## Automated migration commands

```bash
# Migrate ESLint config
npx @biomejs/biome migrate eslint --write

# Migrate Prettier config
npx @biomejs/biome migrate prettier --write

# Run both (Prettier first, then ESLint — ESLint takes precedence)
npx @biomejs/biome migrate prettier --write
npx @biomejs/biome migrate eslint --write
```

Both commands:
- Read the source config file(s)
- Write equivalent settings to `biome.json`
- Print a report of unmapped rules/settings

## ESLint migration in detail

### What `migrate eslint` does

1. Reads `.eslintrc.*`, `.eslintrc.json`, `.eslintrc.js`, `.eslintrc.cjs`, `eslint.config.*`
2. Maps ESLint rules to Biome rules where equivalents exist
3. Maps severity: `"error"` → `"error"`, `"warn"` → `"warn"`, `0/off` → `"off"`
4. Outputs unmapped rules to stderr — review these manually

### ESLint → Biome rule mapping (key rules)

| ESLint rule | Biome equivalent |
|---|---|
| `no-unused-vars` | `correctness/noUnusedVariables` |
| `no-undef` | `correctness/noUndeclaredVariables` |
| `eqeqeq` | `suspicious/noDoubleEquals` |
| `no-console` | `suspicious/noConsole` |
| `no-var` | `style/noVar` |
| `prefer-const` | `style/useConst` |
| `no-shadow` | `suspicious/noShadow` |
| `no-eval` | `security/noGlobalEval` |
| `no-prototype-builtins` | `suspicious/noPrototypeBuiltins` |
| `no-async-promise-executor` | `suspicious/noAsyncPromiseExecutor` |
| `no-fallthrough` | `suspicious/noFallthroughSwitchClause` |
| `no-self-compare` | `suspicious/noSelfCompare` |
| `prefer-template` | `style/useTemplate` |
| `object-shorthand` | `style/useShorthandAssign` |
| `react-hooks/rules-of-hooks` | `correctness/useHookAtTopLevel` |
| `react-hooks/exhaustive-deps` | `correctness/useExhaustiveDependencies` |
| `jsx-a11y/alt-text` | `a11y/useAltText` |
| `jsx-a11y/click-events-have-key-events` | `a11y/useKeyWithClickEvents` |

### Rules without Biome equivalents (require manual handling)

| ESLint rule | Action |
|---|---|
| `import/order` | Use Biome's built-in `organizeImports` (different algorithm) |
| `import/no-cycle` | No equivalent — keep ESLint for this rule only, or use Madge |
| `no-restricted-imports` | No equivalent — use `overrides` to suppress for specific patterns |
| `@typescript-eslint/no-floating-promises` | No equivalent — TypeScript type-checking catches this |
| `@typescript-eslint/consistent-type-imports` | Use `verbatimModuleSyntax: true` in tsconfig instead |
| `eslint-plugin-security` rules | No equivalent — remove or accept coverage gap |
| `eslint-plugin-jest/` rules | No equivalent — Vitest/Jest-specific |
| `eslint-plugin-storybook/` | No equivalent |

For rules without equivalents, options:
1. Accept the coverage gap (most style rules are not critical)
2. Keep ESLint running ONLY for those specific rules (dual-tool setup)
3. Enforce via TypeScript compiler options instead (type-level rules)

## Prettier migration in detail

### What `migrate prettier` does

1. Reads `.prettierrc`, `.prettierrc.json`, `.prettierrc.js`, `.prettierrc.yaml`, `prettier.config.*`
2. Maps Prettier options to `biome.json` formatter settings
3. Handles `printWidth` → `lineWidth`, `tabWidth` → `indentWidth`, etc.

### Prettier → Biome option mapping

| Prettier | Biome |
|---|---|
| `printWidth` | `formatter.lineWidth` |
| `tabWidth` | `formatter.indentWidth` |
| `useTabs` | `formatter.indentStyle: "tab"` |
| `semi: true` | `javascript.formatter.semicolons: "always"` |
| `semi: false` | `javascript.formatter.semicolons: "asNeeded"` |
| `singleQuote: true` | `javascript.formatter.quoteStyle: "single"` |
| `jsxSingleQuote: true` | `javascript.formatter.jsxQuoteStyle: "single"` |
| `trailingComma: "all"` | `javascript.formatter.trailingCommas: "all"` |
| `trailingComma: "es5"` | `javascript.formatter.trailingCommas: "es5"` |
| `trailingComma: "none"` | `javascript.formatter.trailingCommas: "none"` |
| `bracketSpacing: true` | `javascript.formatter.bracketSpacing: true` |
| `arrowParens: "always"` | `javascript.formatter.arrowParentheses: "always"` |
| `arrowParens: "avoid"` | `javascript.formatter.arrowParentheses: "asNeeded"` |
| `endOfLine: "lf"` | `formatter.lineEnding: "lf"` |
| `overrides` | `biome.json overrides` (different syntax) |

### Prettier options WITHOUT Biome equivalents

| Prettier option | Status |
|---|---|
| `proseWrap` | N/A — Biome doesn't format Markdown |
| `embeddedLanguageFormatting` | N/A — no embedded language formatting |
| `htmlWhitespaceSensitivity` | N/A — Biome doesn't format HTML |
| `rangeStart` / `rangeEnd` | N/A — Biome formats whole files only |
| `requirePragma` / `insertPragma` | N/A — Biome doesn't support pragma comments |
| `experimentalTernaries` | N/A |

## Step-by-step migration procedure

### Step 1: Install Biome

```bash
npm install --save-dev @biomejs/biome
```

### Step 2: Initialize

```bash
npx @biomejs/biome init
```

Creates a starter `biome.json`.

### Step 3: Migrate Prettier (if present)

```bash
npx @biomejs/biome migrate prettier --write
```

Review the output. Check for warnings about unsupported options.

### Step 4: Migrate ESLint

```bash
npx @biomejs/biome migrate eslint --write
```

Review the unmapped rules list carefully. Make a decision for each unmapped rule.

### Step 5: Do a dry run

```bash
npx @biomejs/biome check .
```

Count violations. A high number on first run is expected — mostly formatting changes.

### Step 6: Auto-fix formatting

```bash
npx @biomejs/biome check --write .
```

This applies all safe fixes. Commit this as a standalone formatting-only commit.

### Step 7: Review remaining violations

```bash
npx @biomejs/biome check . 2>&1 | grep "error\|warn" | wc -l
```

For each group of remaining violations, decide: fix the code, adjust the rule severity, or add suppression comments.

### Step 8: Remove old tooling

```bash
npm uninstall eslint prettier \
  eslint-config-prettier \
  eslint-plugin-prettier \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  eslint-plugin-react \
  eslint-plugin-react-hooks \
  eslint-plugin-jsx-a11y

# Delete old config files
rm -f .eslintrc .eslintrc.js .eslintrc.cjs .eslintrc.json .eslintrc.yaml \
       .eslintignore .prettierrc .prettierrc.js .prettierrc.json \
       .prettierignore prettier.config.js
```

### Step 9: Update package.json scripts

Before:
```json
"scripts": {
  "lint": "eslint . --ext .ts,.tsx",
  "format": "prettier --write .",
  "lint:fix": "eslint . --fix"
}
```

After:
```json
"scripts": {
  "lint": "biome lint .",
  "format": "biome format --write .",
  "check": "biome check --write .",
  "ci": "biome ci ."
}
```

### Step 10: Update CI pipeline

Replace:
```yaml
- run: npx eslint . && npx prettier --check .
```

With:
```yaml
- run: npx @biomejs/biome ci .
```

### Step 11: Update VS Code settings

See [templates/.vscode/settings.json](../templates/.vscode/settings.json).

Remove Prettier and ESLint VS Code extension settings, add Biome.

### Step 12: Update pre-commit hooks

See [references/ci-integration.md](ci-integration.md) for lefthook and husky configs.

## Handling `eslint-disable` comments

Biome does not recognize `eslint-disable` comments. After migration, convert them:

```ts
// Before
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parse(data: any) { ... }

// After
// biome-ignore lint/suspicious/noExplicitAny: external API returns unknown shape
function parse(data: any) { ... }
```

Find all remaining ESLint comments:
```bash
grep -rn "eslint-disable" src/
```

Each one needs to either be removed (if the rule doesn't exist in Biome), converted to `biome-ignore`, or left as a code comment (Biome ignores `eslint-disable` lines — they become dead comments).

## Rollback plan

If migration causes unexpected issues:
1. `git stash` or revert the migration commit
2. Reinstall ESLint + Prettier from `package-lock.json`
3. Document which unmapped rules caused problems before retrying

Keep ESLint/Prettier as peer dependencies during a phased rollout (team of 10+). Biome runs in parallel until confidence is established.
