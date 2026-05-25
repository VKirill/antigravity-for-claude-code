# TypeScript — Type System

Conditional types, mapped types, template-literal types, `infer`, `satisfies`, declaration files, TS 5.9 features.

---

## Conditional Types

```ts
type IsArray<T> = T extends any[] ? true : false;
// IsArray<string[]> → true
// IsArray<string>   → false
```

**Distribution**: when `T` is a bare type parameter and `T extends U`, the conditional distributes over union members:

```ts
type ToArray<T> = T extends any ? T[] : never;
// ToArray<string | number> → string[] | number[]
// Prevent distribution: wrap in tuple → [T] extends [any] ? T[] : never
```

**Non-distributive** (wrap in tuple):
```ts
type Exact<T, U> = [T] extends [U] ? ([U] extends [T] ? true : false) : false;
```

---

## `infer`

Extract type variables from a matched pattern:

```ts
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
// UnwrapPromise<Promise<string>> → string
// UnwrapPromise<number>          → number

type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;
type Parameters<T> = T extends (...args: infer P) => any ? P : never;

// Infer from nested positions
type FirstArg<T> = T extends (first: infer F, ...rest: any[]) => any ? F : never;

// Multiple infer in same type
type UnwrapPair<T> = T extends readonly [infer A, infer B] ? [B, A] : never;
```

**Infer in template literals** (TS 4.7+):
```ts
type TrimPrefix<S extends string, P extends string> =
  S extends `${P}${infer Rest}` ? Rest : S;
// TrimPrefix<"get_name", "get_"> → "name"
```

---

## Mapped Types

Iterate over a union of keys and produce a new object type:

```ts
// Basic: readonly version
type Readonly<T> = { readonly [K in keyof T]: T[K] };

// Modifier: remove readonly
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

// Modifier: make all optional
type Partial<T> = { [K in keyof T]?: T[K] };

// Modifier: remove optionality
type Required<T> = { [K in keyof T]-?: T[K] };
```

**`as` remapping** (TS 4.1+) — rename or filter keys:

```ts
// Filter: keep only non-function properties
type NoMethods<T> = {
  [K in keyof T as T[K] extends Function ? never : K]: T[K]
};

// Rename: prefix all keys with "get"
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K]
};
```

**Mapped type over union** (not object):
```ts
type EventMap = "click" | "focus" | "blur";
type EventHandlers = { [K in EventMap]: (e: Event) => void };
```

---

## Template-Literal Types

```ts
type EventName<T extends string> = `on${Capitalize<T>}`;
// EventName<"click"> → "onClick"

// Combinatorial expansion over union
type Direction = "top" | "bottom" | "left" | "right";
type Margin = `margin-${Direction}`;
// "margin-top" | "margin-bottom" | "margin-left" | "margin-right"

// Validate string structure at type level
type HexColor = `#${string}`;
const valid: HexColor = "#ff00ff"; // ok
const invalid: HexColor = "ff00ff"; // error
```

**TS 5.9 — Regex literal types**: string patterns act as type-level constraints. (Exact syntax is spec-defined; consult TS release notes for production usage.)

---

## `satisfies` Operator (TS 4.9)

Validate a value against a type without widening the inferred type:

```ts
type Config = { port: number; host: string };

// As annotation: type is widened to Config
const cfg1: Config = { port: 3000, host: "localhost" };
cfg1.port; // type: number (widened)

// With satisfies: type is preserved as literal
const cfg2 = { port: 3000, host: "localhost" } satisfies Config;
cfg2.port; // type: 3000 (literal preserved)
```

Use `satisfies` over `as` when:
- You want the type check but need access to the specific (narrower) shape
- You're building config objects where literal types matter downstream

Never use `as` to satisfy a constraint — it bypasses the check entirely.

---

## Type Guards

**Predicate guards** narrow in a caller's scope:
```ts
function isString(x: unknown): x is string {
  return typeof x === "string";
}

function processItems(items: (string | number)[]) {
  const strings = items.filter((x): x is string => typeof x === "string");
  // strings: string[]
}
```

**Asserts** — throw if condition fails:
```ts
function assertDefined<T>(val: T | null | undefined, name: string): asserts val is T {
  if (val == null) throw new Error(`Expected ${name} to be defined`);
}

function processUser(user: User | null) {
  assertDefined(user, "user");
  user.name; // safely narrowed
}
```

**Common narrowing patterns**:
```ts
// Discriminated union narrowing
if (result.kind === "success") { /* result.data available */ }

// Array filter pitfall — doesn't narrow automatically:
const arr: (string | null)[] = ["a", null, "b"];
const strings = arr.filter(Boolean); // type: (string | null)[] — NOT narrowed
// Fix:
const strings2 = arr.filter((x): x is string => x !== null);
```

---

## Utility Types — Standard Library

| Type | Behavior |
|---|---|
| `Partial<T>` | All properties optional |
| `Required<T>` | All properties required |
| `Readonly<T>` | All properties readonly |
| `Pick<T, K>` | Keep only keys K |
| `Omit<T, K>` | Remove keys K |
| `Record<K, V>` | Object type with keys K and values V |
| `Exclude<T, U>` | Remove from union T the members assignable to U |
| `Extract<T, U>` | Keep from union T only members assignable to U |
| `NonNullable<T>` | Remove `null` and `undefined` from T |
| `ReturnType<T>` | Return type of function T |
| `Parameters<T>` | Tuple of parameter types of function T |
| `Awaited<T>` | Recursively unwrap Promise (TS 4.5+) |
| `NoInfer<T>` | Block inference for this position (TS 5.4+) |

---

## Declaration Files & Module Augmentation

**Ambient module declaration** — type an untyped package:
```ts
// types/untyped-pkg.d.ts
declare module "untyped-pkg" {
  export function doThing(input: string): number;
  export interface Config { debug: boolean }
}
```

**Global augmentation** — add to global scope:
```ts
// globals.d.ts
declare global {
  interface Window { analytics: Analytics }
  const __DEV__: boolean;
}
export {}; // needed to make this an ambient module
```

**Module augmentation** — extend an existing package's types:
```ts
// augment.d.ts
import "express";
declare module "express" {
  interface Request {
    user?: { id: string; role: "admin" | "user" }
  }
}
```

**Declaration merging rules**:
- Interfaces merge (each `interface Foo` contributes members)
- Namespaces merge (and can merge with classes/functions)
- Types do NOT merge (`type Foo` declared twice = error)
- Classes do NOT merge

---

## TS 6.0 Features

> TS 6.0 (released 2026-03-23) is positioned as a **bridge release** between 5.x and the Go-port TS 7. The biggest changes are default shifts, not new type-system primitives.

### Default-shifts (breaking)

| Option | Old default | TS 6.0 default | Action |
|---|---|---|---|
| `strict` | `false` | `true` | Explicitly set `false` only if migrating legacy JS |
| `module` | `commonjs` | `esnext` | Set `nodenext` for Node-native ESM packages |
| `target` | `es5` (or `es3`) | `es2025` | Bump `lib` to match: `["ES2025", ...]` |
| `types` | implicit auto-load of all `@types/*` | `[]` | Add `"types": ["node"]` explicitly to avoid surprise globals |

Also removed/deprecated: `amd`, `umd`, `systemjs` module systems; `--baseUrl`, `--moduleResolution classic`, `--outFile` deprecated; `esModuleInterop: false` and `allowSyntheticDefaultImports: false` no longer permitted. `target: es5` deprecated.

### Subpath imports (`#/` prefix)

Node's subpath-import convention works natively without intermediate directory names:

```jsonc
// package.json
{ "imports": { "#/*": "./dist/*" } }

// src/foo.ts
import { bar } from "#/lib/bar.js";
```

Saves one level of `paths` indirection in tsconfig for monorepo internals.

### Inference: `this`-free function priority

Functions without explicit `this` usage are now treated with **higher priority during type-argument inference**. Fewer surprising errors in generic helper combinators (e.g., `pipe`, `compose`) where the wrong overload used to win.

### Built-in JS API types

- **Temporal API** (stage 4) — `Temporal.PlainDateTime`, `Temporal.Duration`, etc.
- **`RegExp.escape(str)`** — escape user input before constructing a RegExp.
- **Map/WeakMap upsert** — `map.getOrInsert(key, default)`, `map.getOrInsertComputed(key, () => default)`.

These ship in the built-in `lib.es2025.*` files — no `@types/*` install needed.

---

## TS 5.9 Features (carryover)

### `import defer`
```ts
// Module evaluation is deferred until first property access
import defer * as heavyModule from "./heavy-computations.js";
// heavyModule is not initialized here

function onlyWhenNeeded() {
  heavyModule.compute(); // initialization happens here
}
```

Reduces startup time by deferring side-effectful module initialization.

### Regex literal types
TS 5.9 adds narrowing based on regex-matched string patterns. A string validated against a regex produces a more specific string type. Consult TS 5.9 release notes for exact syntax — the feature extends template-literal type inference.

### `--noLib` improvements
`--noLib` now allows providing a complete custom `lib.d.ts` replacement — useful for embedded environments (Workers, Deno edge), where standard DOM/Node types must not appear.

### `verbatimModuleSyntax` (stable recommendation)
Replaces legacy `importsNotUsedAsValues` + `preserveValueImports`. Ensures `import type` is used for type-only imports, preventing bundlers from emitting spurious runtime imports. Should be `true` for all new projects.

---

## Deep Readonly (Custom Utility)

```ts
type DeepReadonly<T> =
  T extends (infer U)[] ? DeepReadonlyArray<U> :
  T extends object ? DeepReadonlyObject<T> :
  T;

interface DeepReadonlyArray<T> extends ReadonlyArray<DeepReadonly<T>> {}

type DeepReadonlyObject<T> = {
  readonly [K in keyof T]: DeepReadonly<T[K]>
};
```

---

## PickByValue (Custom Utility)

```ts
type PickByValue<T, V> = {
  [K in keyof T as T[K] extends V ? K : never]: T[K]
};

// Example
type OnlyStrings = PickByValue<{ a: string; b: number; c: string }, string>;
// { a: string; c: string }
```

---

## Exhaustive Checks

```ts
function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(x)}`);
}

type Shape = { kind: "circle"; radius: number } | { kind: "square"; side: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle": return Math.PI * shape.radius ** 2;
    case "square": return shape.side ** 2;
    default: return assertNever(shape); // TS error if a case is missing
  }
}
```
