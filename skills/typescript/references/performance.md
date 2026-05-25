# TypeScript — Build Performance

Profiling tsc, incremental builds, bottleneck patterns, monorepo CI strategies.

---

## Profiling First

Before tuning anything, measure:

```bash
# Basic diagnostics
tsc --noEmit --diagnostics

# Extended (more detail per-file)
tsc --noEmit --extendedDiagnostics

# Generate trace for TypeScript performance visualizer
tsc --noEmit --generateTrace ./trace-output
```

Key metrics from `--extendedDiagnostics`:
- `Files`: total files in the program (includes `node_modules` if `skipLibCheck: false`)
- `Instantiations`: how many times TS instantiated generic types — primary driver of slow checks
- `Check time`: time spent on actual type checking (vs parse + emit)

Open `trace-output/trace.json` in Chrome DevTools (`chrome://tracing`) to see per-file breakdown.

---

## The Big Wins (in order)

### 1. `skipLibCheck: true`

Skip type-checking all `.d.ts` files in `node_modules`. Single highest-impact flag.

```jsonc
{ "compilerOptions": { "skipLibCheck": true } }
```

Reduces `Files` count dramatically and skips re-checking dependency types on every run.

### 2. Incremental builds / project references

For a single package:
```jsonc
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}
```

For monorepo: use `composite: true` + `tsc --build` (see `tsconfig.md` § Project References).

**Impact**: subsequent runs skip unchanged files. First run is same speed; re-runs 5–30× faster.

### 3. `isolatedModules: true`

When bundlers (esbuild, swc, Vite) are doing actual compilation, use `tsc --noEmit` only for type-checking — skip emit entirely. Combine with `isolatedModules: true` so TS doesn't cross-file reference for value resolution.

### 4. Match `lib` to target

Don't include `DOM` types in Node.js packages:
```jsonc
// Node.js service — don't include DOM
{ "lib": ["ES2024"] }
// Browser app — include DOM
{ "lib": ["ES2024", "DOM", "DOM.Iterable"] }
```

DOM types add ~500 files to the program.

### 5. Narrow `include`/`exclude`

```jsonc
{
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

Explicitly including `node_modules` or leaving `include` as `"**/*"` drags in thousands of files.

---

## Common Bottlenecks

### Deep recursive conditional types

```ts
// Slow — deep recursion builds a large type graph
type DeepPartial<T> =
  T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

// Applied to a deeply nested object: may hit ts(2589)
```

**Fix**: add a depth counter or flatten the recursion:
```ts
type DeepPartial<T, Depth extends number = 5> =
  Depth extends 0 ? T :
  T extends object
    ? { [K in keyof T]?: DeepPartial<T[K], Prev[Depth]> }
    : T;

type Prev = [never, 0, 1, 2, 3, 4, 5];
```

### Large union types

Unions with thousands of members (e.g., `keyof typeof largeObject`) cause slow distribution. Use `Extract<>` to narrow before operating on them.

### Missing `out` variance annotation

```ts
// Without 'out': TS must infer variance by scanning the interface (slow for complex generics)
interface Container<T> {
  value: T;
  transform: (fn: (x: T) => T) => T;
}

// With 'out': TS trusts the annotation (fast)
interface Container<out T> {
  readonly value: T;
}
```

For interfaces with many generic usages across many files, adding variance annotations measurably reduces check time.

### Circular references through `index.ts` barrels

```ts
// Barrel: packages/utils/index.ts
export * from "./string-utils";
export * from "./number-utils";
// ...30 more

// When utils/string-utils.ts imports from utils/number-utils.ts via barrel:
import { formatNumber } from "../index"; // circular!
```

**Fix**: import directly from the source file, not the barrel. Barrels are for external consumers only.

---

## CI Strategy

### Separate type-check from build

```yaml
# CI: type-check and build are parallel jobs
jobs:
  typecheck:
    run: tsc --noEmit

  build:
    run: vite build  # or tsc --build for Node.js
```

Never rely on the bundler's type-checking — most bundlers (`esbuild`, `swc`, `Vite`) skip types entirely by design.

### Monorepo: cache `.tsbuildinfo` files

```yaml
- uses: actions/cache@v4
  with:
    path: |
      packages/*/tsconfig.tsbuildinfo
      apps/*/tsconfig.tsbuildinfo
    key: tsbuildinfo-${{ hashFiles('**/*.ts', '**/tsconfig*.json') }}
```

Without caching, project references rebuild from scratch on every CI run.

### Turborepo / Nx pipeline

Both tools understand `tsc --build` outputs and cache them. Configure in `turbo.json`:
```json
{
  "pipeline": {
    "typecheck": {
      "dependsOn": ["^typecheck"],
      "outputs": ["tsconfig.tsbuildinfo"]
    }
  }
}
```

---

## `--watch` Performance

In development:
```bash
# Incremental watch (project references)
tsc --build --watch

# Single package watch
tsc --watch
```

tsc watch is cheaper than re-running full check: it rebuilds only files affected by the change and invalidates only downstream types.

**Prefer `tsc --watch` over `tsc` in pre-commit hooks** for large codebases — hook runs one-time full check instead of incremental.

---

## Error `ts(2589)`: Type Instantiation Excessively Deep

Occurs when a recursive type exceeds TS's recursion depth limit (~100 levels).

**Root cause**: a conditional type distributes over a large union, or a recursive mapped/conditional type has no termination condition.

**Fix options**:
1. Add explicit depth limit (see DeepPartial example above)
2. Break the type into smaller intermediate steps with named aliases
3. Use `interface` (non-distributive) instead of `type` alias where distribution is not needed
4. Replace deep inference with simpler utility types (`Pick`, `Omit`) at specific call sites

---

## Diagnostics Reference

Output from `tsc --diagnostics`:

```
Files:              127        ← total files in program
Lines:            18,432
Nodes:           162,847
Identifiers:      71,203
Symbols:          52,104
Types:            28,916       ← higher = slower check
Instantiations: 152,371        ← primary bottleneck indicator
Memory used:    228 MB
I/O read:         0.08s
Parse time:       0.62s
ResolveModule:    0.19s
ResolveLibrary:   0.03s
Program time:     0.96s
Bind time:        0.31s
Check time:       2.14s        ← target for optimization
transformTime:    0.00s
Total time:       3.44s
```

If `Instantiations` is > 1M, look for overly generic utility types applied to large interfaces.
