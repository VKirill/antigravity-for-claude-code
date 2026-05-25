---
name: typescript
description: "TypeScript expert — TS 6.0 type system, conditional/mapped types, branded types, generics, tsconfig strict (now default), build performance, monorepo project references, declaration merging, ES2025 target. Use when: typescript, ts, conditional types, mapped types, infer, satisfies, branded types, tsconfig, strict mode, declaration files, generic constraints, type narrowing, utility types, project references, build perf, subpath imports. SKIP: TypeScript-on-Node runtime (→nodejs), React component types (→react), Vue typed templates (→vue)."
stacks:
  - typescript
  - frontend
  - backend
risk: medium-stakes
tags:
  - typescript
  - types
  - generics
  - tsconfig
  - monorepo
  - build
packages:
  - typescript
  - ts-morph
  - "@types/node"
manifests:
  - tsconfig.json
  - tsconfig.base.json
source: generated-zero-baseline
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- TypeScript: `6.0.x`
- Node.js: `24.x (Active LTS)`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need, then follow the link to the relevant reference file for full detail.

## Use this skill when

- Designing type-level logic: conditional types, mapped types, template-literal types, `infer`
- Applying branded/nominal types to prevent primitive-type mix-ups (UserId vs OrderId)
- Constraining generics: `extends`, `keyof`, `infer`, variance (`in`/`out`), `NoInfer`
- Using TS 5.x/6.x features: `satisfies`, `const` type parameters, `import defer`, regex literal types, subpath `#/` imports (TS 6.0)
- Auditing or writing a strict `tsconfig.json` — `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`
- Setting up a monorepo with TypeScript project references and composite builds
- Improving tsc build performance: incremental builds, `isolatedModules`, path mappings, `skipLibCheck`
- Writing or consuming `.d.ts` declaration files and declaration merging
- Narrowing types safely: discriminated unions, type guards, `asserts` predicates
- Migrating a JavaScript codebase to TypeScript incrementally
- Diagnosing `ts(xxxx)` errors, understanding TS's structural type system

## Do not use this skill when

- Task is about running TypeScript at runtime on Node.js — use `nodejs` (type stripping, `ts-node`, build pipeline)
- Task is React component prop types, hooks typing, or JSX generics — use `react`
- Task is Vue typed templates, `defineProps`, `defineEmits`, or Composition API types — use `vue`
- Task is Nuxt-specific typed composables or `defineNuxtConfig` — use `nuxt`
- Task is linting or formatting TypeScript code (ESLint rules, Biome config) — use `eslint` or `biome`
- Task is Prisma schema types or generated Prisma client types — use `prisma`
- Task is schema validation at runtime (Zod inference, `z.infer<>`) — the runtime layer belongs to `zod`

## Purpose

TypeScript's type system is Turing-complete at compile time — it can express almost any constraint your domain needs. In practice, most codebases stay in a shallow layer of basic types and `any` escapes, leaving correctness gaps that types were meant to close. This skill bridges that gap: it covers the full type-level programming surface of TS 6.0 — conditional types, mapped types, template literals, branded types, variance annotations — plus the config and tooling decisions that make TypeScript fast and maintainable in large monorepos.

> **TS 6.0 is a bridge release to TS 7 (Go-port).** Key defaults changed: `strict: true` is now default, `module` defaults to `esnext`, `target` defaults to `es2025`, and `types` defaults to `[]` (no auto-load of all `@types/*`). Several module systems (`amd`, `umd`, `systemjs`) and flags (`--baseUrl`, `--moduleResolution classic`, `--outFile`) are removed/deprecated. `esModuleInterop: false` and `allowSyntheticDefaultImports: false` are no longer permitted. See `references/migration.md` for the upgrade checklist.

The skill deliberately scopes to the **type-system layer only**. It hands off to `nodejs` for runtime behavior, `react`/`vue` for framework-specific component types, and `prisma`/`zod` for ORM/validation type inference — those domains have their own type patterns that don't generalize. Here we focus on what is transferable across any TypeScript project: how to think in types, how to structure `tsconfig.json` for correctness and speed, and how to migrate safely from JavaScript.

## Capabilities

### Conditional & Mapped Types

The backbone of type-level programming. `T extends U ? X : Y` distributes over unions when `T` is a bare type parameter. `infer` extracts type variables from a matched shape. `Mapped types` iterate over a union of keys and transform each member. Combining them produces utility types that track domain invariants at the type level.

Key patterns: `UnwrapPromise<T>`, `DeepReadonly<T>`, `PickByValue<T, V>`, `FlattenTuple<T>`, recursive conditional types, `as` remapping in mapped types (`[K in keyof T as Rename<K>]`).

TS 5.x/6.x: template-literal types as discriminants, regex literal types (TS 5.9) validate string patterns at compile time. TS 6.0 improves inference for functions without explicit `this` usage (higher priority during type argument inference, fewer surprising generic errors).

> Full reference with working code for each pattern: [references/type-system.md](references/type-system.md)

### Generics & Constraints

Generics are parameterized type slots — not templates. Constraint rules: `T extends object` is structural, not nominal. `NoInfer<T>` (TS 5.4) blocks contextual inference for a type parameter, preventing accidental widening. `const T` (TS 5.0) captures literal types from arguments.

Variance annotations: `in T` (contravariant, write-only), `out T` (covariant, read-only). Explicit variance is 3–5× faster for type-check on complex generics compared to inferring it.

Higher-kinded types are not native in TS — simulate with interface mapping tricks or type-level dictionaries.

> Full reference: [references/generics.md](references/generics.md)

### Branded & Nominal Types

TypeScript is structurally typed — two shapes with the same fields are interchangeable. Branded types add a phantom tag that makes `UserId` and `OrderId` incompatible even if both are `string` underneath. Pattern: `type UserId = string & { readonly __brand: "UserId" }`. Constructor function enforces runtime creation.

`satisfies` operator (TS 4.9): validates a value against a type without widening — preserves the literal type of properties. Use instead of explicit annotation when you need both narrowing and type safety.

> Full patterns with examples and anti-patterns: [examples/branded-types.md](examples/branded-types.md)

### Discriminated Unions

Sum types built on a common literal discriminant field. TS exhaustiveness check via `never` in a default branch. `switch`-on-discriminant fully narrows in each case. Better than class hierarchies for data modeling — no runtime overhead, no `instanceof`.

> Full patterns and anti-patterns: [examples/discriminated-unions.md](examples/discriminated-unions.md)

### Type Guards & Narrowing

`typeof`, `instanceof`, `in`, equality narrowing, discriminant narrowing — TS understands all of these natively. Custom type guards: `value is T` return type. `asserts value is T` for throwing guards (eliminates null checks in callers). Control-flow narrowing with `never` for exhaustive branches.

Common narrowing pitfalls: narrowing doesn't survive `Array.filter(Boolean)` without an explicit predicate; closures captured after narrowing can widen back.

> Full reference with narrowing pitfalls: [references/type-system.md](references/type-system.md)

### tsconfig Strict Deep-Dive

`strict: true` enables 8 flags. Beyond `strict`, the high-value additions: `exactOptionalPropertyTypes` (distinguishes `{a?: string}` from `{a: string | undefined}`), `noUncheckedIndexedAccess` (index signatures return `T | undefined`), `noImplicitOverride`, `useUnknownInCatchVariables` (catch binds `unknown` not `any`).

Build flags: `isolatedModules: true` (required for type-stripping and esbuild), `verbatimModuleSyntax` (TS 5.0 — replaces `importsNotUsedAsValues`), `moduleResolution: "bundler"` for Vite/Bun projects. **TS 6.0 defaults shifted**: `strict: true`, `module: esnext`, `target: es2025`, `types: []` (no implicit `@types/*` auto-load).

> Full annotated tsconfig with every flag explained: [templates/tsconfig-strict.json](templates/tsconfig-strict.json)

> Deep-dive reference: [references/tsconfig.md](references/tsconfig.md)

### Monorepo Project References

`composite: true` + `references: [{path: "..."}]` — tsc builds packages in dependency order, emits `.d.ts` declarations, and caches with `.tsbuildinfo`. Incremental builds are 10–50× faster than full rebuilds on large monorepos.

`paths` in `tsconfig.base.json` + `moduleNameMapper` in Jest/Vitest aligns resolver behavior. `verbatimModuleSyntax` prevents spurious re-exports. Turborepo / Nx coordinate build ordering; TS project references handle type correctness independently.

> Full monorepo setup guide: [references/tsconfig.md](references/tsconfig.md)

### Build Performance

Three levers: (1) `incremental + tsBuildInfo` — skip files with no changes; (2) `skipLibCheck: true` — skip type-checking in `node_modules`; (3) isolate heavy paths — if one package has complex generics, split it into its own project reference so only it re-checks when it changes.

Profile with `tsc --diagnostics` and `tsc --extendedDiagnostics`. Common bottleneck: overly deep recursive conditional types — flatten via `infer` at an intermediate step.

> Profiling guide, bottleneck patterns, build flag matrix: [references/performance.md](references/performance.md)

### JS → TS Migration

Three strategies: (1) rename-and-fix — rename `.js` → `.ts`, fix errors immediately; (2) `allowJs + checkJs` — type-check JS in place, migrate files incrementally; (3) `noImplicitAny: false` → tighten over time. Recommended: start with `allowJs: true`, `checkJs: false`, `strict: false`; enable strict per-file via `// @ts-check` + JSDoc; then flip flags globally once coverage reaches ~80%.

> Step-by-step migration playbook with `// @ts-ignore` debt tracking: [references/migration.md](references/migration.md)

> Migration checklist: [checklists/migration-checklist.md](checklists/migration-checklist.md)

### Declaration files, module augmentation, TS 6.0

`.d.ts` describes JS packages; ambient declarations: `declare module "untyped-pkg" { ... }`. Module augmentation extends existing types: `declare module "express" { interface Request { user?: AuthUser } }`. Declaration merging: interfaces and namespaces merge; classes and types do not.

TS 6.0 highlights: subpath imports (`"#/*": "./dist/*"` via Node's `#/` prefix), built-in types for Temporal API (stage 4), `RegExp.escape()`, Map/WeakMap upsert (`getOrInsert`, `getOrInsertComputed`), ES2025 target. Carryovers from 5.9: `import defer` (lazy module eval), regex literal types, `verbatimModuleSyntax` (replaces legacy `importsNotUsedAsValues` + `preserveValueImports`).

> Full reference: [references/type-system.md](references/type-system.md)

## Behavioral Traits

- Reaches for `satisfies` when you need both type validation and literal-type preservation — not `as` casts
- Uses branded types proactively for domain primitives (IDs, timestamps, currency amounts) that share underlying types
- Prefers discriminated unions over class hierarchies for sum types — no runtime overhead
- Writes explicit variance annotations (`in`/`out`) on generic interfaces with complex type graphs — faster type-check
- Uses `NoInfer<T>` when a generic should be inferred from one argument only, not widened by another
- Adds `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` beyond `strict: true` for new projects
- Profiles type-check time with `tsc --extendedDiagnostics` before blaming "TypeScript is slow"
- Avoids deep recursive conditional types — flattens via intermediate `infer` to prevent tsc stack overflows
- Uses `const` type parameters for functions that should capture literal types from callers
- Never uses `@ts-ignore` without a comment explaining why — uses `@ts-expect-error` instead (fails if suppressed error disappears)
- Sets `isolatedModules: true` from day one — required for type-stripping, esbuild, and most bundlers

## Important Constraints

- NEVER use `any` without a `// eslint-disable` or type-level justification — `unknown` is always safer at boundaries
- NEVER cast with `as T` when `satisfies T` or a type guard can express the same constraint more safely
- NEVER add `skipLibCheck: true` as a permanent fix for type errors in application code — it silences real bugs
- NEVER write recursive conditional types deeper than ~5 levels — TS has a recursion limit and deep types are slow
- NEVER use `namespace` for new code — ESM modules and `export` replace all namespace use cases
- NEVER rely on type assertion functions (`asserts`) to replace input validation — they crash at runtime, not compile time
- ALWAYS use `type` imports (`import type { Foo }`) for type-only imports with `verbatimModuleSyntax`
- ALWAYS set `composite: true` and `declaration: true` for packages in a monorepo project reference
- ALWAYS run `tsc --noEmit` in CI as a separate step from the build — bundlers skip type-checking silently
- ALWAYS set `moduleResolution` explicitly — default changed across TS versions and implicit default causes subtle resolution bugs

## Related Skills

90%-filter applied — mainstream 2026 choices only.

### Runtime
- ✓ `nodejs` — Node.js 24 (primary runtime for TypeScript; type stripping, build pipeline)

### Frameworks
- ✓ `react` — React 19 typed component patterns, JSX generics, hooks typing
- ✓ `nextjs` — Next.js 16 App Router — typed route handlers, Server Actions, metadata
- ✓ `vue` — Vue 3.5 typed templates, `defineProps`, Composition API types
- ✓ `nuxt` — Nuxt 4 typed composables, `defineNuxtConfig`, auto-imports
- ✓ `vitest` — Vitest 4 TypeScript test typing, `vi.fn<>`, `expect.extend`

### Tooling
- ✓ `eslint` — ESLint 10 with `@typescript-eslint` rules
- ✓ `biome` — Biome 2 (replaces ESLint + Prettier for most TS projects)
- ✓ `vite` — Vite 7: `moduleResolution: "bundler"`, plugin type APIs

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Index, decision map, quick lookup by problem type | [references/REFERENCE.md](references/REFERENCE.md) |
| Conditional types, mapped types, template literals, infer, declaration merging, TS 5.9 | [references/type-system.md](references/type-system.md) |
| Generics: constraints, variance, NoInfer, const type params, HKT simulation | [references/generics.md](references/generics.md) |
| tsconfig deep-dive: strict flags, module resolution, project references, composite | [references/tsconfig.md](references/tsconfig.md) |
| Build performance: diagnostics, incremental, skipLibCheck, bottleneck patterns | [references/performance.md](references/performance.md) |
| JS→TS migration: strategies, allowJs, JSDoc, strict ramp, @ts-ignore debt | [references/migration.md](references/migration.md) |
| Recommended defaults (strict-mode baseline, module resolution, project references, build perf, CI) | [references/recommended-defaults.md](references/recommended-defaults.md) |
| Troubleshooting (slow tsc, ts(2589), verbatimModuleSyntax cascade, noUncheckedIndexedAccess migration, codegen drift) | [references/troubleshooting.md](references/troubleshooting.md) |
| Wrong vs right code pairs (`as` vs `satisfies`, `any` vs `unknown`, `enum` vs `as const`, interface merging) | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Routing eval cases: 10 positive / 10 negative / 5 edge | [references/eval-cases.md](references/eval-cases.md) |
| Branded types: phantom tags, satisfies, constructor factories, anti-patterns | [examples/branded-types.md](examples/branded-types.md) |
| Discriminated unions: modeling, exhaustive checks, narrowing patterns | [examples/discriminated-unions.md](examples/discriminated-unions.md) |
| Production-ready strict tsconfig with every flag annotated | [templates/tsconfig-strict.json](templates/tsconfig-strict.json) |
| Canonical utility types with implementations and usage notes | [templates/utility-types.ts.template](templates/utility-types.ts.template) |
| Step-by-step JS→TS migration checklist with acceptance criteria | [checklists/migration-checklist.md](checklists/migration-checklist.md) |

**How to use**: navigate to the specific file for the topic you need. Don't read all files — look up only what's relevant to the current task.
