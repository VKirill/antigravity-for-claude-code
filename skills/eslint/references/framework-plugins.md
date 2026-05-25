# Framework plugins

## React + React Hooks + jsx-a11y

```bash
npm install --save-dev eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y
```

```ts
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default [
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",        // React 17+
      "react/prop-types": "off",                // covered by TS
      "react-hooks/exhaustive-deps": "error",   // keep deps array honest
    },
  },
];
```

### Key React rules

| Rule | What it catches |
|---|---|
| `react-hooks/rules-of-hooks` | Hooks called conditionally / outside components |
| `react-hooks/exhaustive-deps` | Missing or stale deps in `useEffect`/`useMemo`/`useCallback` |
| `react/jsx-key` | Missing `key` in list rendering |
| `react/no-unescaped-entities` | Raw `<`, `>` etc. in JSX |
| `react/jsx-no-target-blank` | `target="_blank"` without `rel="noopener"` |

### React Compiler (React 19+)

If using the React Compiler:

```bash
npm install --save-dev eslint-plugin-react-compiler
```

```ts
import reactCompiler from "eslint-plugin-react-compiler";

{
  plugins: { "react-compiler": reactCompiler },
  rules: { "react-compiler/react-compiler": "error" },
}
```

## Next.js

```bash
npm install --save-dev @next/eslint-plugin-next
```

```ts
import next from "@next/eslint-plugin-next";

export default [
  {
    plugins: { "@next/next": next },
    rules: {
      ...next.configs.recommended.rules,
      ...next.configs["core-web-vitals"].rules,
    },
  },
];
```

`core-web-vitals` adds rules that catch perf issues: `no-img-element` (use `next/image`), `no-html-link-for-pages` (use `next/link`), `no-sync-scripts`, etc.

**Layer on top of React rules** — Next.js plugin doesn't include React rules.

## Vue 3

```bash
npm install --save-dev eslint-plugin-vue vue-eslint-parser
```

```ts
import vue from "eslint-plugin-vue";

export default [
  ...vue.configs["flat/recommended"],
];
```

Options:
- `flat/essential` — bug-class rules only
- `flat/strongly-recommended` — adds best practices
- `flat/recommended` — adds opinion (most projects)

For TypeScript in `.vue` SFCs:

```ts
import vue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";
import vueParser from "vue-eslint-parser";

export default [
  ...vue.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,        // TS parser for <script lang="ts">
        extraFileExtensions: [".vue"],
      },
    },
  },
];
```

## Nuxt 4

```bash
npx nuxt module add eslint
```

This installs `@nuxt/eslint` and generates a base config. Then in `eslint.config.mjs`:

```js
import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt(
  // your custom overrides
  {
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },
);
```

The Nuxt module handles Vue + TypeScript + auto-imports + globals.

## Astro

```bash
npm install --save-dev eslint-plugin-astro astro-eslint-parser
```

```ts
import astro from "eslint-plugin-astro";

export default [
  ...astro.configs.recommended,
];
```

## Storybook

```bash
npm install --save-dev eslint-plugin-storybook
```

```ts
import storybook from "eslint-plugin-storybook";

export default [
  {
    files: ["**/*.stories.{ts,tsx}"],
    plugins: { storybook },
    rules: storybook.configs.recommended.rules,
  },
];
```

## Anti-pattern: `eslint-plugin-import`

In 2026, `eslint-plugin-import` is mostly obsolete:

- Module resolution → TypeScript handles it
- Sorting imports → Biome's `organizeImports`, Prettier plugin, or `perfectionist`
- `consistent-type-imports` → `typescript-eslint` has it natively

Drop `eslint-plugin-import` unless you need a specific rule it offers that has no replacement.
