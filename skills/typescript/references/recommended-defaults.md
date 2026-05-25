# Recommended defaults — typescript

Canonical defaults for TypeScript 6.0.x. **Other files cite this — do not redefine inline.**

> **TS 6.0 defaults shifted**: `strict: true`, `module: esnext`, `target: es2025`, `types: []` are now defaults — the baseline below keeps them explicit for clarity, monorepo extension, and tooling that snapshots resolved config.

> Citation rule: every recommendation includes a default + a tune-up/tune-down condition.

## Strict-mode baseline tsconfig

Start every new TS project with this baseline. See [templates/tsconfig-strict.json](../templates/tsconfig-strict.json) for the full annotated version.

```jsonc
{
  "compilerOptions": {
    // Strictness
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "useUnknownInCatchVariables": true,
    "noFallthroughCasesInSwitch": true,

    // Module system
    "module": "ESNext",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,

    // Output / target — TS 6.0 default is es2025
    "target": "ES2025",
    "lib": ["ES2025", "DOM"],

    // Type-check perf
    "skipLibCheck": true,
    "incremental": true,

    // Quality of life
    "forceConsistentCasingInFileNames": true,
    "noEmit": true
  }
}
```

| Flag | Default | Tune-down when |
|---|---|---|
| `strict` | `true` | Migrating from JS — flip per-file with `@ts-check` first |
| `noUncheckedIndexedAccess` | `true` | Disabled only when migrating a large codebase — flip on once you can absorb the diff |
| `exactOptionalPropertyTypes` | `true` | Disabled if you have a lot of code that relies on `{a?: string}` accepting `undefined` |
| `verbatimModuleSyntax` | `true` | Disabled for legacy CJS interop projects |
| `skipLibCheck` | `true` | Disabled when actively maintaining your own `@types/*` package |

## Module resolution decision

| Bundler / runtime | `moduleResolution` |
|---|---|
| Vite / Bun / Rollup / esbuild / Next.js modern | `bundler` |
| Node 20+ with native ESM | `nodenext` |
| Older toolchain / TS < 4.7 | `node` |
| Deno | `bundler` + Deno-specific flags |

`bundler` is the modern default. Only fall back to `nodenext` if you publish a package that Node executes directly.

## Project references (monorepo)

```jsonc
// packages/core/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "references": []
}

// packages/app/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "composite": true, "outDir": "./dist", "rootDir": "./src" },
  "references": [{ "path": "../core" }]
}
```

| Knob | Default | Why |
|---|---|---|
| `composite: true` | required for project references | Forces declaration + declarationMap, enables `.tsbuildinfo` |
| `declaration: true` | required | Cross-package consumption |
| `incremental: true` | default with `composite` | `.tsbuildinfo` cache for 10–50× faster rebuilds |
| `--build` (tsc) | use for monorepos | Walks references in order |

## Build performance flags

```bash
tsc --build --diagnostics                # for routine builds
tsc --build --extendedDiagnostics        # when investigating slow builds
tsc --build --explainFiles               # see why each file is loaded
```

| Symptom | Knob |
|---|---|
| Full rebuild every time | `incremental: true` + `.tsbuildinfo` in cache key |
| One package re-checks the world | Split into project reference; isolate complex generics |
| `node_modules` types kill perf | `skipLibCheck: true` |
| Deep recursive types stack-overflow | Flatten via intermediate `infer`; see `references/performance.md` |

## Strict-migration ramp (existing JS codebase)

| Stage | tsconfig | Goal |
|---|---|---|
| 1 | `allowJs: true, checkJs: false, strict: false` | Compile the existing JS |
| 2 | `checkJs: true` + `// @ts-check` on key files | Type-check key JS files via JSDoc |
| 3 | Rename `.js` → `.ts` per package; fix errors | Migrate file by file |
| 4 | `strict: true` after ~80% coverage | Lock in correctness |
| 5 | Add `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` | Final tightening |

## `import type` rules with `verbatimModuleSyntax`

```ts
// ❌ Wrong — value import for types only
import { User } from './user';

// ✅ Right — type-only import
import type { User } from './user';
```

`verbatimModuleSyntax: true` enforces this. Type-only imports are erased at build time; value imports preserved. Mixing them causes spurious bundles and circular-import bugs.

## CI integration

```bash
# Always run tsc --noEmit in CI — bundlers skip type-check silently
tsc --noEmit

# For monorepos
tsc --build --noEmit
```

Pair with ESLint / Biome but keep type-check as its own job — different signal.

## Citation rule

Other files MUST NOT redefine these values inline. Use:

> Defaults: see [recommended-defaults.md](recommended-defaults.md).

## Last verified

2026-05-16 against TypeScript 6.0.x official docs (https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/).
