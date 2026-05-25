# TypeScript — tsconfig Deep-Dive

Compiler flags, module resolution, project references, composite builds, and monorepo setup.

---

## `strict: true` — What It Enables

`strict: true` is shorthand for 8 flags:

| Flag | What it does |
|---|---|
| `strictNullChecks` | `null` and `undefined` are not assignable to other types |
| `strictFunctionTypes` | Function parameters checked contravariantly |
| `strictBindCallApply` | `bind`, `call`, `apply` have typed signatures |
| `strictPropertyInitialization` | Class properties must be initialized in constructor |
| `noImplicitAny` | Error on implicit `any` |
| `noImplicitThis` | Error on `this` with implicit `any` type |
| `alwaysStrict` | Emits `"use strict"` in output |
| `useUnknownInCatchVariables` | Catch binds `unknown` instead of `any` (TS 4.4+) |

Enable all of these. Never disable individual strict flags to silence errors — fix the code instead.

---

## Beyond `strict` — High-Value Additions

These are not part of `strict: true` but are recommended for new projects:

```jsonc
{
  "compilerOptions": {
    "strict": true,

    // Distinguishes {a?: string} (may not exist) from {a: string | undefined} (exists as undefined)
    "exactOptionalPropertyTypes": true,

    // Array/object index access returns T | undefined, not T
    "noUncheckedIndexedAccess": true,

    // Method overrides must use 'override' keyword
    "noImplicitOverride": true,

    // Error on unreachable code (if enabled by lint too)
    "noUnusedLocals": true,
    "noUnusedParameters": true,

    // Fall-through in switch is an error
    "noFallthroughCasesInSwitch": true
  }
}
```

**`exactOptionalPropertyTypes`** is the most impactful: it prevents treating `{a?: string}` and `{a: string | undefined}` as the same, which catches many subtle bugs in config and API response typing.

**`noUncheckedIndexedAccess`** forces explicit null-checks for `arr[0]` and `obj[key]` — any index access can be `undefined`. This is particularly valuable for `Record<string, T>` accessed with dynamic keys.

---

## Module Resolution

`moduleResolution` controls how TS resolves `import "foo"`:

| Value | When to use |
|---|---|
| `"node16"` / `"nodenext"` | Node.js ESM or CJS with package exports |
| `"bundler"` | Vite, Bun, Webpack, esbuild — lets the bundler handle resolution |
| `"node10"` (legacy) | Old Node.js CJS projects — do not use for new projects |

**Rule**: always set `moduleResolution` explicitly. The default has changed across TS versions.

For Node.js projects with type stripping (`--experimental-strip-types`):
```jsonc
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

For Vite/bundler projects:
```jsonc
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

---

## `verbatimModuleSyntax` (TS 5.0, default-on intent in TS 6)

Replaces the long-deprecated combination of `importsNotUsedAsValues` + `preserveValueImports` — **both flags are gone in TS 6**. With `verbatimModuleSyntax: true`:

- `import type { Foo }` — erased, never emitted
- `import { foo }` — kept if `foo` is used as a value
- Mixed imports must use `type` keyword: `import { type Foo, bar }` (TS 4.5 inline type import)

```ts
// Required with verbatimModuleSyntax
import type { User } from "./types";
import { createUser } from "./service"; // value import — kept

// ts(1484) error if you import type without 'type':
import { User } from "./types"; // error if User is only used as a type
```

Enable for all new projects. Required for compatibility with type-stripping runtimes.

---

## `isolatedModules: true`

Required for: esbuild, swc, Vite, Bun, and Node.js `--experimental-strip-types`. These tools process files one-at-a-time without full type information.

What it prevents:
- `const enum` usage (value not knowable without type info)
- `namespace` with values (erasure behavior differs)
- Re-exporting types without `export type`

```ts
// Error with isolatedModules: re-exported type is ambiguous
export { User } from "./types"; // error — is this a type or value?
// Fix:
export type { User } from "./types";
```

---

## Path Mapping

```jsonc
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@app/*": ["src/*"],
      "@shared/*": ["packages/shared/src/*"]
    }
  }
}
```

**Important**: `paths` only affects TypeScript's type resolution. Your bundler/runner also needs equivalent configuration:
- Vite: `resolve.alias` in `vite.config.ts`
- Jest/Vitest: `moduleNameMapper` in config
- Node.js: `--experimental-specifier-resolution` or `tsconfig-paths` package

---

## Project References (Monorepo)

Project references enable per-package incremental builds with cross-package type safety.

### Package tsconfig (`packages/utils/tsconfig.json`):
```jsonc
{
  "compilerOptions": {
    "composite": true,        // Required — enables declaration emit + .tsbuildinfo
    "declaration": true,      // Emit .d.ts files consumed by other packages
    "declarationMap": true,   // Source maps for .d.ts (enables go-to-source)
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

### Root tsconfig (`tsconfig.json`):
```jsonc
{
  "files": [],               // Root tsconfig contains no files directly
  "references": [
    { "path": "packages/utils" },
    { "path": "packages/api" },
    { "path": "apps/web" }
  ]
}
```

### Dependent package (`apps/web/tsconfig.json`):
```jsonc
{
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist"
  },
  "references": [
    { "path": "../../packages/utils" }  // Declares dependency on utils
  ]
}
```

### Build commands:
```bash
# Build all packages in dependency order
tsc --build

# Build specific package
tsc --build packages/utils

# Watch mode with project references
tsc --build --watch

# Force full rebuild (ignore .tsbuildinfo)
tsc --build --force

# Delete build outputs
tsc --build --clean
```

**`.tsbuildinfo`**: incremental build cache. Commit to `.gitignore` (regenerates on build). Store per package: `outDir + ".tsbuildinfo"` pattern works well.

---

## Incremental Builds (Single Package)

For single-package projects (not using project references):

```jsonc
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": "./.tsbuildinfo"
  }
}
```

Stores file hashes + type graph; rebuilds only changed files. 5–10× faster on re-runs.

---

## `lib` Configuration

```jsonc
{
  "compilerOptions": {
    // Node.js app — no DOM needed
    "lib": ["ES2024", "ESNext.AsyncIterable"],

    // Browser app
    "lib": ["ES2024", "DOM", "DOM.Iterable"],

    // Both (fullstack monorepo base)
    "lib": ["ES2024"]
  }
}
```

Match `lib` to actual target environment. DOM types in a Node.js package add noise and slow type-check.

`target` affects emitted JavaScript syntax level. `lib` affects available globals. They are independent:
```jsonc
{
  "target": "ES2022",   // Emit class fields natively
  "lib": ["ES2024"]     // But check against ES2024 APIs
}
```

---

## `skipLibCheck: true`

Skip type-checking of all `.d.ts` files in `node_modules`. Makes type-check faster but misses declaration errors from dependencies.

**When to use**: permanently enabled in most projects — type errors in `node_modules` are rarely actionable and slow down CI significantly.

**When to disable**: when debugging a dependency type mismatch where you need to see the actual error.

Never use `skipLibCheck` to silence errors in your own `.d.ts` files — those need fixing.

---

## `tsconfig.base.json` Pattern (Monorepo)

Shared base config inherited by all packages:

```jsonc
// tsconfig.base.json (monorepo root)
{
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "moduleDetection": "force"
  }
}
```

Each package extends it and adds its own `module`, `moduleResolution`, `outDir`:
```jsonc
// packages/api/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true,
    "declaration": true
  }
}
```

---

## Common Flags Quick Reference

| Flag | Default | Recommended |
|---|---|---|
| `strict` | false | true |
| `exactOptionalPropertyTypes` | false | true (new projects) |
| `noUncheckedIndexedAccess` | false | true (new projects) |
| `verbatimModuleSyntax` | false | true |
| `isolatedModules` | false | true |
| `skipLibCheck` | false | true |
| `esModuleInterop` | false | true |
| `moduleDetection` | "auto" | "force" (treats all files as modules) |
| `resolveJsonModule` | false | true |
| `noPropertyAccessFromIndexSignature` | false | true (opinionated) |
