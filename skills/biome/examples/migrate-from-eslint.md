# Migrate from ESLint + Prettier to Biome

## Scenario

A TypeScript React project using:
- `eslint` + `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser`
- `eslint-plugin-react` + `eslint-plugin-react-hooks`
- `eslint-plugin-jsx-a11y`
- `prettier` + `eslint-config-prettier` + `eslint-plugin-prettier`
- `.eslintrc.json` + `.prettierrc`

Goal: replace all of the above with Biome in one migration pass.

## Starting state

`.eslintrc.json`:
```json
{
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "prettier"
  ],
  "rules": {
    "no-console": "warn",
    "no-var": "error",
    "prefer-const": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "react/react-in-jsx-scope": "off"
  }
}
```

`.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100
}
```

## Step 1: Install Biome

```bash
npm install --save-dev @biomejs/biome
```

## Step 2: Migrate Prettier config

```bash
npx @biomejs/biome migrate prettier --write
```

Output:
```
Migration results for .prettierrc:
  ✓ semi → javascript.formatter.semicolons: "always"
  ✓ singleQuote: false → javascript.formatter.quoteStyle: "double"
  ✓ tabWidth: 2 → formatter.indentWidth: 2
  ✓ trailingComma: "all" → javascript.formatter.trailingCommas: "all"
  ✓ printWidth: 100 → formatter.lineWidth: 100
```

All Prettier options mapped successfully.

## Step 3: Migrate ESLint config

```bash
npx @biomejs/biome migrate eslint --write
```

Output:
```
Migration results for .eslintrc.json:
  ✓ no-console → suspicious/noConsole: "warn"
  ✓ no-var → style/noVar: "error"
  ✓ prefer-const → style/useConst: "error"
  ✓ @typescript-eslint/no-explicit-any → suspicious/noExplicitAny: "warn"
  ✓ @typescript-eslint/no-unused-vars → correctness/noUnusedVariables: "error"
  ✓ react-hooks/rules-of-hooks → correctness/useHookAtTopLevel: "error"
  ✓ react-hooks/exhaustive-deps → correctness/useExhaustiveDependencies: "error"
  ✓ jsx-a11y/alt-text → a11y/useAltText: "error"
  ✓ jsx-a11y/no-autofocus → a11y/noAutofocus: "error"

  ⚠ Unmapped rules (no Biome equivalent):
    - react/react-in-jsx-scope (was: "off") → no action needed (was already off)
    - @typescript-eslint/consistent-type-imports → use TypeScript's verbatimModuleSyntax instead
```

The unmapped rules are:
1. `react/react-in-jsx-scope: "off"` — was already disabled, nothing to do
2. `@typescript-eslint/consistent-type-imports` — enforce via `tsconfig.json`: `"verbatimModuleSyntax": true`

## Step 4: Fix the `argsIgnorePattern` gap

The original ESLint config had `"argsIgnorePattern": "^_"` — ignore unused function arguments starting with `_`. Biome's `noUnusedVariables` does this automatically: parameters prefixed with `_` are exempt by default.

No action needed.

## Step 5: Add `$schema` and VCS settings

The migrator generates a base config. Enhance it:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.0/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true,
    "defaultBranch": "main"
  },
  "files": {
    "ignore": ["dist", "build", "node_modules", ".next", "coverage"]
  },
  ...
}
```

## Step 6: Dry run to count violations

```bash
npx @biomejs/biome check .
```

Example output on a medium project:
```
src/components/Modal.tsx lint/suspicious/noExplicitAny  ━━━━━━━━━━━━━━━
  ✖ Unexpected any. Specify a different type.
   > 14 │ function parseData(data: any) {
        │                         ^^^

src/utils/api.ts format  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✖ Formatter would have printed the following content:
  ...

Found 47 errors.
  - 32 formatting
  - 15 lint violations
```

## Step 7: Apply auto-fixes

```bash
npx @biomejs/biome check --write .
```

This applies:
- All formatting changes (32 → 0)
- All safe lint auto-fixes

Remaining (requires manual fix or suppression):
```
Found 3 errors.
  - 3 lint violations (noExplicitAny — intentional any uses)
```

## Step 8: Handle remaining violations

Review each remaining violation:

```ts
// src/components/DataTable.tsx:45
// biome-ignore lint/suspicious/noExplicitAny: third-party DataGrid requires any for row data
function getRowId(row: any): string {
  return row.id;
}
```

## Step 9: Add verbatimModuleSyntax (replaces consistent-type-imports)

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "verbatimModuleSyntax": true
  }
}
```

This enforces `import type { Foo }` at the TypeScript level — stricter than ESLint rule.

## Step 10: Remove old tooling

```bash
npm uninstall \
  eslint \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  eslint-plugin-react \
  eslint-plugin-react-hooks \
  eslint-plugin-jsx-a11y \
  prettier \
  eslint-config-prettier \
  eslint-plugin-prettier

rm .eslintrc.json .eslintignore .prettierrc .prettierignore 2>/dev/null || true
```

## Step 11: Update `package.json` scripts

Before:
```json
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx --max-warnings 0",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

After:
```json
{
  "scripts": {
    "lint": "biome lint .",
    "format": "biome format --write .",
    "check": "biome check --write .",
    "ci": "biome ci ."
  }
}
```

## Step 12: Update GitHub Actions

Before:
```yaml
- run: npm run lint
- run: npm run format:check
```

After:
```yaml
- run: npx @biomejs/biome ci .
```

## Step 13: Update VS Code settings

Replace `.vscode/settings.json` with the template from [templates/.vscode/settings.json](../templates/.vscode/settings.json).

Key change:
```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "prettier.enable": false
}
```

## Verification

After migration, run:

```bash
# Should exit 0 with no output
npx @biomejs/biome ci .

# Confirm no eslint/prettier remnants
grep -r "eslint\|prettier" package.json | grep -v biome

# Confirm VS Code extension works
# Open a .ts file → save → verify formatting applies
```

## Final `biome.json`

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.0/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true,
    "defaultBranch": "main"
  },
  "files": {
    "ignore": ["dist", "build", "node_modules", ".next", "coverage"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noConsole": "warn",
        "noExplicitAny": "warn"
      },
      "style": {
        "noVar": "error",
        "useConst": "error"
      },
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error",
        "useExhaustiveDependencies": "error",
        "useHookAtTopLevel": "error"
      },
      "a11y": {
        "useAltText": "error",
        "noAutofocus": "error"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "trailingCommas": "all",
      "semicolons": "always"
    }
  }
}
```

## Total time

- Automated migration: ~5 minutes
- Reviewing unmapped rules: ~15 minutes
- Fixing remaining violations: ~20 minutes (depends on codebase size)
- Cleanup and updating CI/hooks: ~10 minutes

Total: ~50 minutes for a medium TypeScript React project.
