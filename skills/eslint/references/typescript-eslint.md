# typescript-eslint integration

`typescript-eslint` is the umbrella package providing the parser, plugin, and shared configs. Install one package:

```bash
npm install --save-dev typescript-eslint
```

It bundles:
- `@typescript-eslint/parser` (parser)
- `@typescript-eslint/eslint-plugin` (rules)
- preset configs

## Minimum setup

```ts
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tseslint.configs.recommended,
);
```

That's it for type-info-free linting. For type-aware rules (recommended), enable the **project service**:

## Project service (type-aware)

```ts
export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
```

`projectService: true` auto-discovers `tsconfig.json` for each linted file. Replaces the legacy `project: "./tsconfig.json"` field (still supported but deprecated).

**Always** set `tsconfigRootDir: import.meta.dirname` — relative path resolution fails in monorepos.

## Scoping to `.ts`/`.tsx` files only

Don't apply TS parser to `.js` files in a polyglot codebase:

```ts
export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx,cts,mts}"],
  })),
);
```

Without this scoping, ESLint tries to parse `.js` config files (e.g. `vite.config.js`) with the TS parser and fails.

## Type-aware rules to enable

| Rule | Catches |
|---|---|
| `@typescript-eslint/no-floating-promises` | Async calls without `await` or `.catch()` |
| `@typescript-eslint/no-misused-promises` | Passing async fn where sync expected (e.g. event handlers) |
| `@typescript-eslint/await-thenable` | `await` on non-Promise |
| `@typescript-eslint/no-unsafe-assignment` | Assigning `any` to typed var |
| `@typescript-eslint/no-unsafe-call` | Calling `any` |
| `@typescript-eslint/no-unsafe-member-access` | `.foo` on `any` |
| `@typescript-eslint/restrict-template-expressions` | `${obj}` where obj is not stringifiable |
| `@typescript-eslint/no-base-to-string` | `${[1,2,3]}` → "1,2,3" |
| `@typescript-eslint/prefer-nullish-coalescing` | Suggest `??` over `\|\|` |
| `@typescript-eslint/prefer-optional-chain` | Suggest `a?.b` over `a && a.b` |
| `@typescript-eslint/no-unnecessary-condition` | `if (alwaysTruthy)` |

## Common rule replacements (legacy → new)

| Legacy ESLint rule | Replace with |
|---|---|
| `no-unused-vars` | `@typescript-eslint/no-unused-vars` |
| `no-shadow` | `@typescript-eslint/no-shadow` |
| `no-redeclare` | `@typescript-eslint/no-redeclare` |
| `no-use-before-define` | `@typescript-eslint/no-use-before-define` |
| `dot-notation` | `@typescript-eslint/dot-notation` |
| `require-await` | `@typescript-eslint/require-await` |

In flat config, **disable the legacy rule** before enabling the TS variant:

```ts
{
  rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
}
```

## Performance

Type-aware rules require running TypeScript's program analysis, which can 5–10x lint time. Mitigations:

1. **`projectService: true`** — faster than legacy `project:` field
2. **`--cache`** — only re-lint changed files
3. **Scope to source files** — exclude generated `*.d.ts` via `ignores`
4. **Smaller `tsconfig.eslint.json`** — separate config that only includes lint-relevant files

```ts
parserOptions: {
  projectService: {
    allowDefaultProject: ["*.config.{js,ts}"],
  },
  tsconfigRootDir: import.meta.dirname,
},
```

## Version compatibility

| `typescript-eslint` | Supports TypeScript |
|---|---|
| `8.x` | `4.8` – `5.9` |
| `9.x` (canary) | `5.x` – `6.x` |

Match major versions. Mismatched versions cause `'X' is not assignable to type 'Y'` errors deep in lint output.
