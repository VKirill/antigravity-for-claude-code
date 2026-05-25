# Flat config (`eslint.config.js` / `eslint.config.ts`)

Flat config is the **only** config format supported in ESLint 10. Legacy `.eslintrc.*` has been removed.

## File resolution

ESLint looks for these files at the project root, in order:

1. `eslint.config.js`
2. `eslint.config.mjs`
3. `eslint.config.cjs`
4. `eslint.config.ts` (native in v10 — no `tsx` or `ts-node` shim needed)
5. `eslint.config.mts`
6. `eslint.config.cts`

Pick `.ts` if the project is TypeScript-first — you get type checking on the config itself.

## Shape

Default export is an **array of config objects**. Each object can have:

```ts
{
  name: string,              // optional, for debugging
  files: string[],           // glob patterns — config applies only to these
  ignores: string[],         // glob patterns — exclude from this config
  languageOptions: {
    ecmaVersion: number | "latest",
    sourceType: "module" | "commonjs" | "script",
    globals: Record<string, "readonly" | "writable" | "off">,
    parser: Parser,
    parserOptions: object,
  },
  linterOptions: {
    noInlineConfig: boolean,
    reportUnusedDisableDirectives: "off" | "warn" | "error",
  },
  plugins: Record<string, Plugin>,
  rules: Record<string, RuleSeverity | [RuleSeverity, ...options]>,
  settings: Record<string, unknown>,
}
```

## Minimal example

```js
// eslint.config.js
import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    rules: {
      "no-console": "warn",
    },
  },
];
```

## Realistic TypeScript + React example

```ts
// eslint.config.ts
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  // 1. Global ignores — apply to all configs
  {
    ignores: ["dist/**", "build/**", ".next/**", "coverage/**", "node_modules/**"],
  },

  // 2. JS recommended
  js.configs.recommended,

  // 3. TS recommended (type-checked variant)
  ...tseslint.configs.recommendedTypeChecked,

  // 4. TS-specific language options
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // 5. React + hooks + a11y for JSX files only
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: { react, "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      "react/react-in-jsx-scope": "off", // not needed with React 17+
    },
    settings: { react: { version: "detect" } },
  },

  // 6. Project-specific rule overrides
  {
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // 7. Test files — relaxed
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // 8. Prettier — MUST be last
  prettier,
);
```

## `tseslint.config()` helper

`typescript-eslint` exports a `config()` helper that takes the same array but adds TS-level type checking on each entry. Prefer it over hand-spreading arrays:

```ts
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: { /* ... */ } },
);
```

Without `tseslint.config()`, TypeScript can't infer rule names and you lose autocomplete in `rules: {}`.

## Global ignores

A config object with **only** an `ignores` field applies globally. This replaces `.eslintignore` (removed):

```js
export default [
  { ignores: ["dist/**", "*.config.js"] },  // global
  // ...rest of config
];
```

If `ignores` appears alongside `files`/`rules`, it only excludes files from THAT config object (not globally).

## `--inspect-config` debugger

```bash
eslint --inspect-config
```

Opens a browser inspector that shows the merged config for any file path. Best tool for "why is rule X enabled/disabled on file Y".

## Common pitfalls

- **Forgetting `files` glob on plugin configs** — React rules applied to backend `.ts` files cause noise
- **Order matters** — `eslint-config-prettier` must be last to override style rules
- **`ignores` with other keys** — only excludes from that config, not globally
- **`.eslintrc.*` and `eslint.config.*` together** — ESLint 10 ignores legacy entirely, no warning
- **Relative `tsconfigRootDir`** — fails in monorepos; always use `import.meta.dirname`
