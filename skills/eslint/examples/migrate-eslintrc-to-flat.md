# Example: migrate `.eslintrc.json` → `eslint.config.ts`

End-to-end walkthrough for a TypeScript + React + Prettier project on ESLint 8 moving to ESLint 10.

## Starting state

### `.eslintrc.json`
```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json",
    "ecmaVersion": 2022,
    "sourceType": "module",
    "ecmaFeatures": { "jsx": true }
  },
  "env": { "browser": true, "node": true, "es2022": true },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-type-checked",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "prettier"
  ],
  "plugins": ["@typescript-eslint", "react", "react-hooks", "jsx-a11y"],
  "settings": { "react": { "version": "detect" } },
  "rules": {
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-floating-promises": "error"
  },
  "overrides": [
    {
      "files": ["**/*.test.ts", "**/*.test.tsx"],
      "rules": { "@typescript-eslint/no-explicit-any": "off" }
    }
  ]
}
```

### `.eslintignore`
```
dist
build
node_modules
coverage
.next
```

### `package.json` (relevant subset)
```json
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx --max-warnings 0"
  },
  "devDependencies": {
    "eslint": "^8.57.0",
    "@typescript-eslint/parser": "^7.0.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "eslint-plugin-react": "^7.34.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-jsx-a11y": "^6.8.0",
    "eslint-config-prettier": "^9.1.0"
  }
}
```

## Step 1: Upgrade dependencies

```bash
npm install --save-dev \
  eslint@^10 \
  @eslint/js \
  typescript-eslint \
  eslint-plugin-react \
  eslint-plugin-react-hooks \
  eslint-plugin-jsx-a11y \
  eslint-config-prettier \
  globals

# Remove legacy packages
npm uninstall \
  @typescript-eslint/parser \
  @typescript-eslint/eslint-plugin
```

Note: `typescript-eslint` (umbrella) replaces both `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin`.

## Step 2: Try the automated migrator

```bash
npx @eslint/migrate-config .eslintrc.json
```

It generates `eslint.config.js`. Review and adjust. Then rename to `.ts` for type-checked config.

## Step 3: Final `eslint.config.ts`

```ts
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  // .eslintignore → global ignores
  {
    ignores: ["dist/**", "build/**", "node_modules/**", "coverage/**", ".next/**"],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,                    // replaces project: "./tsconfig.json"
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  {
    files: ["**/*.{jsx,tsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },

  {
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-floating-promises": "error",
    },
  },

  // overrides[0] → separate config object with `files`
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },

  // "prettier" from extends → eslint-config-prettier last
  prettier,
);
```

## Step 4: Remove legacy files

```bash
rm .eslintrc.json .eslintignore
```

## Step 5: Update `package.json` scripts

The `--ext` flag is gone in v10 (flat config uses `files` globs). Simplify:

```json
{
  "scripts": {
    "lint": "eslint . --cache --max-warnings 0",
    "lint:fix": "eslint . --cache --fix"
  }
}
```

## Step 6: Verify

```bash
# Should produce roughly the same number of violations as before
npx eslint .

# Confirm config resolution for a sample file
npx eslint --print-config src/App.tsx | jq '.rules | keys | length'
```

If output is wildly different, common causes:
- Missing `globals.browser` / `globals.node` → `no-undef` spikes
- Plugin config without `files` glob → React rules on backend files
- `eslint-config-prettier` not last → style rules still active

## Step 7: Update editor

Update `.vscode/settings.json`:
```json
{
  "eslint.useFlatConfig": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

Reload window. Done.

## Total time

- Automated migrator: ~2 min
- Reviewing and converting overrides: ~10 min
- Removing legacy packages, verifying: ~10 min
- Fixing new violations from stricter type-checked rules: ~30 min (varies)

Total: ~50 minutes for a medium TypeScript React project.
