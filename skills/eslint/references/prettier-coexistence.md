# Prettier coexistence

The 2026 best practice: **run them separately**. ESLint lints, Prettier formats. Connect them only via `eslint-config-prettier`, which turns off ESLint style rules that conflict.

## Do this

```bash
npm install --save-dev eslint-config-prettier
```

```ts
import prettier from "eslint-config-prettier";

export default [
  // ...all linting configs
  prettier,   // MUST be last
];
```

`eslint-config-prettier` is **just a list of rule disables** — `"indent": "off"`, `"quotes": "off"`, etc. It must be last so it overrides any preset that enabled them.

## Run Prettier separately

```json
// package.json
{
  "scripts": {
    "lint": "eslint . --cache",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "check": "npm run format:check && npm run lint"
  }
}
```

## Don't do this

**`eslint-plugin-prettier`** is an anti-pattern in 2026:

- Runs Prettier through ESLint → every formatting issue becomes a lint error
- 2–5x slower than running Prettier directly
- Noisy diff output — every space change is a lint diagnostic
- Confuses editor integrations

If you see `eslint-plugin-prettier` in `package.json`, remove it:

```bash
npm uninstall eslint-plugin-prettier
```

## Why `eslint-config-prettier` is enough

When Prettier formats your code, the file is already consistent. ESLint style rules (`indent`, `quotes`, `semi`, `comma-dangle`) are now redundant noise. `eslint-config-prettier` silences them without slowing down lint.

ESLint then focuses on what it's actually good at:
- Logic bugs (`no-unused-vars`, `no-undef`)
- Type-aware checks (`no-floating-promises`)
- Framework rules (`react-hooks/exhaustive-deps`)

## `.prettierrc` minimal

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

## Editor flow

VS Code with both extensions installed:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

Order: Prettier formats first (on save), then ESLint fixes remaining lint issues. No conflict because `eslint-config-prettier` disabled the overlapping rules.

## Co-existing with Biome

If a project uses **Biome for format + base lint** and **ESLint for framework rules**:

```ts
// eslint.config.ts
export default [
  // Disable everything Biome handles
  prettier,   // disables style rules
  // Then layer only framework rules ESLint owns
  ...reactHooksConfig,
  ...nextConfig,
];
```

Run Biome on commit, ESLint on PR — gives speed locally + thoroughness in CI.

## Migration: remove `eslint-plugin-prettier`

```bash
# 1. Remove the plugin
npm uninstall eslint-plugin-prettier

# 2. Add eslint-config-prettier instead
npm install --save-dev eslint-config-prettier

# 3. Remove "prettier/prettier" rule from eslint.config.ts
# 4. Make sure `prettier` from "eslint-config-prettier" is last in the array
# 5. Add `"format": "prettier --write ."` script

# 6. Verify
eslint . && prettier --check .
```
