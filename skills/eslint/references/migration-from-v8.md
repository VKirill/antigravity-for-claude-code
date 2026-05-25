# Migration from ESLint v8 (`.eslintrc.*` → flat config)

ESLint 10 removed legacy config support entirely. `.eslintrc.json`, `.eslintrc.js`, `.eslintrc.yml`, and the `eslintConfig` field in `package.json` are all **ignored**. You must migrate.

## Automated migration

```bash
npx @eslint/migrate-config .eslintrc.json
```

Generates `eslint.config.js` based on your legacy config. Handles:
- `extends` → array of preset imports
- `parser` → `languageOptions.parser`
- `parserOptions` → `languageOptions.parserOptions`
- `globals` → `languageOptions.globals`
- `plugins` → `plugins: { ... }`
- `rules` → `rules: { ... }`
- `overrides` → multiple config objects with `files` glob

## Manual migration steps

### 1. Install dependencies

```bash
npm install --save-dev eslint@^10 @eslint/js typescript-eslint
```

### 2. Translate `extends`

Before:
```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended"
  ]
}
```

After:
```ts
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
];
```

### 3. Translate `parserOptions`

Before:
```json
{
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json",
    "ecmaVersion": 2022,
    "sourceType": "module"
  }
}
```

After:
```ts
{
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      projectService: true,             // replaces project: "./tsconfig.json"
      tsconfigRootDir: import.meta.dirname,
      ecmaVersion: 2022,
      sourceType: "module",
    },
  },
}
```

### 4. Translate `overrides`

Before:
```json
{
  "rules": { "no-console": "warn" },
  "overrides": [
    {
      "files": ["**/*.test.ts"],
      "rules": { "no-console": "off" }
    }
  ]
}
```

After:
```ts
export default [
  { rules: { "no-console": "warn" } },
  {
    files: ["**/*.test.ts"],
    rules: { "no-console": "off" },
  },
];
```

### 5. Translate `.eslintignore`

`.eslintignore` is no longer read. Move patterns into a global `ignores`:

```ts
export default [
  { ignores: ["dist/**", "build/**", "node_modules/**"] },
  // ...rest
];
```

### 6. Translate `globals`

Before:
```json
{
  "env": { "browser": true, "node": true },
  "globals": { "MY_GLOBAL": "readonly" }
}
```

After:
```ts
import globals from "globals";

{
  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.node,
      MY_GLOBAL: "readonly",
    },
  },
}
```

Install `globals`:
```bash
npm install --save-dev globals
```

### 7. Translate plugin presets

Some plugins ship flat configs differently:

| Plugin | Flat preset import |
|---|---|
| `eslint-plugin-react` | `react.configs.flat.recommended` |
| `eslint-plugin-vue` | `vue.configs["flat/recommended"]` (array — use `...`) |
| `eslint-plugin-jsx-a11y` | `jsxA11y.flatConfigs.recommended` |
| `eslint-plugin-import-x` | `importX.flatConfigs.recommended` |
| `@next/eslint-plugin-next` | use `next.configs.recommended.rules` manually |

Check the plugin's README for the exact flat preset path.

### 8. Verify migration

```bash
# Print resolved config for any file
npx eslint --print-config src/index.ts > /tmp/new-config.json

# Compare rule output count
npx eslint . --format json | jq '[.[] | .messages | length] | add'
```

If lint output is wildly different, look at the printed config — usually a missing preset or an unscoped `files` glob.

### 9. Remove old files

```bash
rm -f .eslintrc.json .eslintrc.js .eslintrc.yml .eslintignore
```

Remove `eslintConfig` from `package.json` if present.

## Common migration issues

| Symptom | Cause | Fix |
|---|---|---|
| "Parsing error: ESLint was configured to run on …" | TS parser applied to `.js` files | Add `files: ["**/*.{ts,tsx}"]` to TS configs |
| `no-undef` reports on `process`, `window` | Missing `globals` | Add `...globals.node` / `...globals.browser` |
| All rules disabled | `eslint-config-prettier` placed mid-array | Move it to the end |
| Plugin rules don't fire | Missing `plugins: { "name": plugin }` registration | Plugins must be registered AND rules referenced as `"name/rule"` |
| Slow lint | `project: "./tsconfig.json"` instead of `projectService: true` | Switch to `projectService: true` |
