# Recommended rule presets

Every project should start from at least one recommended preset. Layer them in this order:

1. `@eslint/js` (core)
2. `typescript-eslint` (TS)
3. Framework presets (React, Vue, Next.js, Nuxt)
4. Project overrides
5. `eslint-config-prettier` (last — disables style conflicts)

## `@eslint/js`

```js
import js from "@eslint/js";

export default [
  js.configs.recommended,
];
```

Activates ~70 core rules: `no-undef`, `no-unused-vars`, `no-redeclare`, `no-cond-assign`, `no-irregular-whitespace`, `no-prototype-builtins`, `no-unsafe-finally`, etc.

Also available: `js.configs.all` (everything — typically too aggressive for production).

## `typescript-eslint` presets

| Preset | What it adds |
|---|---|
| `tseslint.configs.recommended` | Basic TS rules, no type info required, fast |
| `tseslint.configs.recommendedTypeChecked` | All of `recommended` + rules needing `tsc` (slow but catches real bugs) |
| `tseslint.configs.strict` | Stricter rules, more opinion |
| `tseslint.configs.strictTypeChecked` | `strict` + type-aware |
| `tseslint.configs.stylistic` | Style rules — superseded by Prettier in practice |
| `tseslint.configs.stylisticTypeChecked` | Same with type info |

**Use `recommendedTypeChecked`** unless lint speed is critical. The catch:

- `no-floating-promises` — silent missing `await`
- `no-misused-promises` — passing async fn where sync expected
- `no-unsafe-assignment` / `no-unsafe-call` / `no-unsafe-member-access` — catch leaked `any`

These rules pay for the slower lint many times over.

## Framework presets

### React

```js
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

// Apply only to JSX/TSX files
{
  files: ["**/*.{jsx,tsx}"],
  plugins: { react, "react-hooks": reactHooks },
  rules: {
    ...react.configs.recommended.rules,
    ...reactHooks.configs.recommended.rules,
    "react/react-in-jsx-scope": "off",     // React 17+
    "react/prop-types": "off",             // TypeScript covers this
  },
  settings: { react: { version: "detect" } },
}
```

### Vue 3

```js
import vue from "eslint-plugin-vue";

export default [
  ...vue.configs["flat/recommended"],
];
```

### Next.js

```js
import next from "@next/eslint-plugin-next";

{
  plugins: { "@next/next": next },
  rules: {
    ...next.configs.recommended.rules,
    ...next.configs["core-web-vitals"].rules,
  },
}
```

### Nuxt 4

Use `@nuxt/eslint` module — it auto-generates the flat config:

```js
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@nuxt/eslint"],
  eslint: { config: { stylistic: false } }, // disable stylistic (use Prettier/Biome)
});
```

Then in `eslint.config.mjs`:

```js
import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt(
  // ...your overrides
);
```

## Severity tuning

| Common project policy | Severity |
|---|---|
| `no-unused-vars` | `"error"` (catches dead code) |
| `no-console` | `["warn", { allow: ["warn", "error"] }]` |
| `no-debugger` | `"error"` |
| `@typescript-eslint/no-explicit-any` | `"warn"` (allow with reason) |
| `@typescript-eslint/no-floating-promises` | `"error"` |
| `@typescript-eslint/no-unused-vars` | `["error", { argsIgnorePattern: "^_" }]` |
| `react-hooks/exhaustive-deps` | `"error"` (keep dependencies honest) |

## Default-allow patterns

Some rules need exceptions for valid patterns:

```js
"@typescript-eslint/no-unused-vars": [
  "error",
  {
    argsIgnorePattern: "^_",      // _unused function args
    varsIgnorePattern: "^_",      // _unused variables
    caughtErrorsIgnorePattern: "^_",
  },
],
"no-restricted-syntax": [
  "error",
  {
    selector: "TSEnumDeclaration",
    message: "Use union types or const objects instead of enums",
  },
],
```

## Don't enable

These rules cause more pain than value in 2026:

- `@typescript-eslint/explicit-function-return-type` — TypeScript inference is usually right
- `@typescript-eslint/no-explicit-any` set to `"error"` — too punitive; warn + suppress is fine
- `import/no-default-export` — fights Next.js, Vue SFC, dynamic imports
- `prefer-arrow-callback` + `prettier` — Prettier handles arrow style
