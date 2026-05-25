# Troubleshooting — typescript

Symptom-indexed. Find what you see, follow diagnosis, apply fix.

---

## `tsc` is slow

**Symptoms**
- `tsc --noEmit` takes minutes
- CI type-check is the longest job
- Editor type info lags

**Diagnose**
```bash
# 1. Get a per-phase breakdown
tsc --extendedDiagnostics --noEmit

# 2. Understand which files are loaded and why
tsc --explainFiles --noEmit > /tmp/explain.txt

# 3. For monorepos, check whether project references are wired
tsc --build --dry --verbose
```

**Common causes**
- No project references — entire monorepo type-checks on every change
- `skipLibCheck: false` — TS type-checks all `node_modules/@types/*`
- Deep recursive conditional types
- One source-of-truth file imported everywhere → full graph re-checked

**Fix**
1. Add `composite: true` and `references: [...]` to split packages
2. `skipLibCheck: true` in baseline (see `references/recommended-defaults.md`)
3. Cache `.tsbuildinfo` in CI (e.g., `actions/cache` with key `tsbuildinfo-${{ hashFiles(...) }}`)
4. Profile with `--extendedDiagnostics` and inspect "Check time" vs "Parse time"

See `references/performance.md` for the full lever list.

---

## ts(2589) — Type instantiation is excessively deep

**Symptoms**
- TS error: "Type instantiation is excessively deep and possibly infinite"
- Build dies on a specific generic invocation

**Common causes**
- Recursive conditional type without a depth bound
- Combining mapped types with conditional types over deeply nested data
- An external `@types/*` package with a recursive type accidentally instantiated against a large union

**Fix**
```ts
// Before — recurses without intermediate step
type DeepNested<T> = T extends object
  ? { [K in keyof T]: DeepNested<T[K]> }
  : T;

// After — break recursion with an intermediate type
type DeepNestedHelper<T> = { [K in keyof T]: DeepNested<T[K]> };
type DeepNested<T> = T extends object ? DeepNestedHelper<T> : T;
```

If the offending instantiation is from an external lib, isolate it:
```ts
type Cached = Pick<SomeLibType, 'a' | 'b'>; // narrow before passing further
```

See `references/type-system.md` recursive conditional patterns.

---

## `verbatimModuleSyntax` cascade errors

**Symptoms**
- After enabling `verbatimModuleSyntax: true`, hundreds of errors:
  - "'X' is a type and must be imported using a type-only import"
  - "X is a value and must not be re-exported as a type"

**Cause**
- Project was using mixed value/type imports without distinction
- `import { User } from './user'` where `User` is only used as a type

**Fix — codemod**
```bash
# Use ts-morph or the built-in TS codemod
npx -y @typescript-eslint/eslint-plugin --fix \
  --rule '@typescript-eslint/consistent-type-imports: error'

# Or the standalone tool
npx -y type-coverage --check
```

Then `tsc --noEmit` should pass. See `references/recommended-defaults.md` for the rule.

---

## `noUncheckedIndexedAccess` migration

**Symptoms**
- After flipping `noUncheckedIndexedAccess: true`, errors everywhere:
  - "Object is possibly 'undefined'" on `arr[i]` and `obj[key]`

**Cause**
- Index signatures now return `T | undefined` (correctly reflecting runtime behavior)

**Fix — incremental**
```ts
// Wrong fix — silences the type system
const v = arr[0] as string;

// Right fix #1 — check
const v = arr[0];
if (v === undefined) throw new Error('empty');
// v is string here

// Right fix #2 — use `at()` with explicit handling
const v = arr.at(0) ?? throwOnEmpty();

// Right fix #3 — narrowing helper
function nonEmpty<T>(arr: T[]): [T, ...T[]] {
  if (arr.length === 0) throw new Error('empty');
  return arr as [T, ...T[]];
}
const v = nonEmpty(arr)[0]; // string, not string | undefined
```

For incremental migration, flip the flag per-package via project references — see `references/recommended-defaults.md`.

---

## Generated types missing after schema change (Prisma / GraphQL codegen)

**Symptoms**
- Type errors about a field that exists in the schema
- Editor shows old type info

**Cause**
- Generated `.d.ts` files were not regenerated
- IDE caches old types

**Fix**
```bash
# Prisma
npx prisma generate

# GraphQL codegen
npx graphql-codegen

# Then reload editor TS server
# VS Code: cmd+shift+p → "TypeScript: Restart TS Server"
```

Add to CI to catch drift:
```bash
npx prisma generate
git diff --exit-code prisma/.client/  # fail if generated types diverged
```

This is a typescript-adjacent issue but lives at the codegen tool — for ORM-specific patterns see `prisma` or `graphql-codegen` skills.

---

## `tsc --noEmit` passes but bundler fails

**Symptoms**
- Type-check is green
- `vite build` / `next build` errors out

**Cause**
- Bundler uses isolated transpilation (e.g., `esbuild --jsx`) which has stricter rules than tsc
- Missing `isolatedModules: true` in tsconfig — tsc allowed code the bundler can't isolate

**Fix**
- Set `isolatedModules: true` in baseline (see `references/recommended-defaults.md`)
- The error reveals: re-exports of types without `export type { Foo }`, `const enum` use, namespace barrels

---

## "Type 'X' is not assignable to type 'Y'" — but they look identical

**Common causes**
- Two distinct `.d.ts` definitions for the same type (duplicate `@types/*` versions in `node_modules`)
- Branded type with private symbol (intended — see `examples/branded-types.md`)
- Variance issue: `Foo<A>` not assignable to `Foo<B>` even when `A extends B`

**Diagnose**
```bash
# Find duplicate @types/X
npm ls @types/express   # or whichever type

# Compare definitions
diff $(find node_modules -name 'index.d.ts' -path '*@types/express*')
```

**Fix**
- Dedup with `npm dedupe` or pnpm overrides
- Pin `@types/*` version explicitly
- For variance issues: see `references/generics.md` variance section

---

## More symptoms?

Capture: `tsc --version`, full `tsconfig.json`, the offending source snippet, and `tsc --extendedDiagnostics` output. The TypeScript GitHub issues at <https://github.com/microsoft/TypeScript/issues> are responsive when the repro is minimal.
