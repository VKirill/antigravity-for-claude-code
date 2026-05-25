# TypeScript — Reference Index

Decision map: given a problem, which file to open.

## Quick decision map

| Problem | File |
|---|---|
| "How do I write a conditional type?" | [type-system.md](type-system.md) § Conditional Types |
| "How do I extract type from `Promise<T>`?" | [type-system.md](type-system.md) § Infer |
| "How do I map over object keys and change the type?" | [type-system.md](type-system.md) § Mapped Types |
| "How do I make UserId and OrderId incompatible?" | [examples/branded-types.md](../examples/branded-types.md) |
| "How do I model a tagged union with exhaustive check?" | [examples/discriminated-unions.md](../examples/discriminated-unions.md) |
| "What's the difference between `satisfies` and `as`?" | [type-system.md](type-system.md) § satisfies |
| "How do I constrain a generic to a subset of keys?" | [generics.md](generics.md) § Key Constraints |
| "How do I prevent inference widening on one param?" | [generics.md](generics.md) § NoInfer |
| "Which tsconfig flags do I need beyond `strict: true`?" | [tsconfig.md](tsconfig.md) § Beyond Strict |
| "How do I set up project references in a monorepo?" | [tsconfig.md](tsconfig.md) § Project References |
| "Why is tsc so slow? How do I profile it?" | [performance.md](performance.md) |
| "How do I migrate a JS file to TS without breaking everything?" | [migration.md](migration.md) |
| "How do I add types for an untyped npm package?" | [type-system.md](type-system.md) § Declaration Files |
| "What's new in TS 6.0?" | [type-system.md](type-system.md) § TS 6.0 Features |
| "What's new in TS 5.9 (carryover)?" | [type-system.md](type-system.md) § TS 5.9 Features |

## File summary

| File | Lines | Coverage |
|---|---|---|
| [type-system.md](type-system.md) | ~450 | Conditional, mapped, template-literal, infer, satisfies, declaration merging, TS 6.0 + TS 5.9 carryover |
| [generics.md](generics.md) | ~350 | Generic constraints, variance, NoInfer, const type params, HKT simulation |
| [tsconfig.md](tsconfig.md) | ~400 | All compiler flags, module resolution, project references, composite builds |
| [performance.md](performance.md) | ~280 | Build profiling, incremental, bottleneck patterns, monorepo CI strategies |
| [migration.md](migration.md) | ~320 | JS→TS strategies, JSDoc typing, strict ramp, @ts-ignore debt management |
| [eval-cases.md](eval-cases.md) | ~120 | Routing regression tests: 10 positive, 10 negative, 5 edge |

## Operational artifacts

| Type | File | When to use |
|---|---|---|
| Template | [templates/tsconfig-strict.json](../templates/tsconfig-strict.json) | Starting any new TS project |
| Template | [templates/utility-types.ts.template](../templates/utility-types.ts.template) | Need common utility type implementations |
| Example | [examples/branded-types.md](../examples/branded-types.md) | Adding brand types to domain primitives |
| Example | [examples/discriminated-unions.md](../examples/discriminated-unions.md) | Modeling sum types |
| Checklist | [checklists/migration-checklist.md](../checklists/migration-checklist.md) | Migrating a JS codebase to TypeScript |

## Common error index

| Error | Where to look |
|---|---|
| `ts(2322)` Type 'X' is not assignable to type 'Y' | [type-system.md](type-system.md) — structural compatibility |
| `ts(2345)` Argument of type 'X' is not assignable to parameter of type 'Y' | [generics.md](generics.md) — constraint mismatch |
| `ts(2589)` Type instantiation is excessively deep and possibly infinite | [performance.md](performance.md) — recursive type limit |
| `ts(2304)` Cannot find name 'X' | [tsconfig.md](tsconfig.md) — lib, types, paths config |
| `ts(1484)` 'X' is a type and must be imported using a type-only import | [tsconfig.md](tsconfig.md) — verbatimModuleSyntax |
| `ts(2540)` Cannot assign to 'X' because it is a read-only property | [type-system.md](type-system.md) — Readonly, const assertions |
| `ts(7006)` Parameter 'x' implicitly has an 'any' type | [tsconfig.md](tsconfig.md) — noImplicitAny |
| `ts(2532)` Object is possibly 'undefined' | [tsconfig.md](tsconfig.md) — noUncheckedIndexedAccess |
