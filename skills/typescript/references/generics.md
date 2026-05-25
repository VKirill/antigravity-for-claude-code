# TypeScript — Generics

Generic constraints, variance annotations, NoInfer, const type parameters, higher-kinded type simulation.

---

## Basics

A generic is a type slot, not a template instantiation:

```ts
function identity<T>(x: T): T { return x; }
// T is inferred from the argument; different callsites get different T
```

**Inference flow**: TypeScript infers `T` from argument positions. Return types and constraints shape what `T` can be.

---

## Constraints: `extends`

`T extends U` means "T must be assignable to U":

```ts
function getKey<T extends object, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
// K is constrained to actual keys of T — prevents runtime KeyError equivalents
```

**Structural constraint** — TS uses structural typing, so `T extends { id: string }` matches any shape with an `id: string` field, not just explicitly declared subtypes:

```ts
function printId<T extends { id: string }>(items: T[]): void {
  items.forEach(item => console.log(item.id));
}
```

**Multiple constraints** (intersection):
```ts
// TypeScript doesn't have `T extends A & B` directly from multiple clauses
// Use intersection in the constraint:
function merge<T extends object, U extends object>(a: T, b: U): T & U {
  return { ...a, ...b };
}
```

---

## Key Constraints: `keyof`, `in keyof`

```ts
// K must be a key of T
function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  return keys.reduce((acc, key) => ({ ...acc, [key]: obj[key] }), {} as Pick<T, K>);
}

// Lookup type: T[K]
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

**`PropertyKey`** — the union `string | number | symbol`, useful as the broadest key constraint:
```ts
function fromEntries<K extends PropertyKey, V>(entries: [K, V][]): Record<K, V> {
  return Object.fromEntries(entries) as Record<K, V>;
}
```

---

## `NoInfer<T>` (TS 5.4)

Blocks contextual inference from a specific position. Without `NoInfer`, TypeScript widens `T` by considering all argument positions:

```ts
// Without NoInfer — T inferred as string | "debug" | "info"
function createLogger<T extends string>(
  defaultLevel: T,
  levels: T[]
): Logger<T> { ... }
createLogger("debug", ["debug", "info"]); // T = "debug" | "info" ✓ but...
createLogger("warn", ["debug", "info"]); // T = "warn" | "debug" | "info" — "warn" widened in

// With NoInfer — T inferred only from levels[], defaultLevel checked against it
function createLogger<T extends string>(
  defaultLevel: NoInfer<T>,
  levels: T[]
): Logger<T> { ... }
createLogger("warn", ["debug", "info"]); // Error: "warn" not in levels ✓
```

Use `NoInfer<T>` when one parameter should define `T` and another should just be checked against it without influencing inference.

---

## `const` Type Parameters (TS 5.0)

Without `const`, generic inference widens literals to their base types:

```ts
function makeArray<T>(values: T[]): T[] { return values; }
makeArray(["a", "b"]); // T inferred as string[] — loses literal types

// With const modifier: captures literal types
function makeArray<const T>(values: T[]): T[] { return values; }
makeArray(["a", "b"]); // T inferred as ["a", "b"] — readonly tuple with literals
```

**Practical use**: factory functions that need to preserve literal types for downstream use (discriminated unions, mapped types):

```ts
function defineRoutes<const T extends Record<string, string>>(routes: T): T {
  return routes;
}
const routes = defineRoutes({ home: "/", about: "/about" });
routes.home; // type: "/" (literal, not string)
```

---

## Variance Annotations (TS 4.7)

Declare how a generic relates to its type parameter — covariant (read-only), contravariant (write-only), or invariant (both).

```ts
// Covariant: T only appears in output positions (safe to read)
interface Producer<out T> {
  produce(): T;
}

// Contravariant: T only appears in input positions (safe to write)
interface Consumer<in T> {
  consume(value: T): void;
}

// Invariant (default): T appears in both — cannot substitute
interface ReadWrite<T> {
  get(): T;
  set(value: T): void;
}
```

**Performance**: explicit variance is 3–5× faster for type-checking on complex type graphs. TypeScript must infer variance otherwise, which is expensive for deeply nested generics.

```ts
// Without annotation: TS infers variance by analyzing the shape (slow)
interface Box<T> { value: T }

// With annotation: TS skips inference (fast)
interface Box<out T> { readonly value: T }
```

---

## Default Type Parameters (TS 4.0)

```ts
interface ApiResponse<T = unknown> {
  data: T;
  status: number;
}

// Without type argument: T defaults to unknown
const res: ApiResponse = { data: "hello", status: 200 };
res.data; // type: unknown

// With type argument: T is concrete
const typed: ApiResponse<string> = { data: "hello", status: 200 };
typed.data; // type: string
```

---

## Conditional Types in Generics

Conditional types + generics enable type-level function application:

```ts
// Flatten one level of array
type Flatten<T> = T extends Array<infer U> ? U : T;

// Deep unwrap
type DeepAwaited<T> =
  T extends Promise<infer U> ? DeepAwaited<U> : T;

// Map function type over tuple
type MapFn<T extends any[], F extends (x: any) => any> =
  T extends [infer Head, ...infer Tail]
    ? [F extends (x: Head) => infer R ? R : never, ...MapFn<Tail, F>]
    : [];
```

---

## Generic Functions vs Generic Interfaces

```ts
// Generic interface — T is fixed at instantiation time
interface Repository<T> {
  findById(id: string): Promise<T>;
  save(entity: T): Promise<void>;
}

// Generic function — T is fresh per callsite
type Mapper = <T, U>(arr: T[], fn: (x: T) => U) => U[];
```

For factory patterns, prefer generic interfaces — they encode the relationship between multiple methods sharing `T`. For utility functions, use per-callsite generic functions.

---

## Higher-Kinded Type (HKT) Simulation

TypeScript lacks native HKT. Common simulation via type-level dictionary:

```ts
// Register type constructors
interface TypeMap {
  Array: { type: Array<any>; arg: any };
  Promise: { type: Promise<any>; arg: any };
  Set: { type: Set<any>; arg: any };
}

// Apply a constructor K to an argument T
type Apply<K extends keyof TypeMap, T> =
  K extends "Array" ? Array<T> :
  K extends "Promise" ? Promise<T> :
  K extends "Set" ? Set<T> :
  never;

// Functor-like: map over any registered container
function mapOver<K extends keyof TypeMap, T, U>(
  container: Apply<K, T>,
  fn: (x: T) => U,
  kind: K
): Apply<K, U> { ... }
```

This pattern is used in library-level code (fp-ts, effect). For application code, explicit generics over concrete types are simpler.

---

## Generic Constraints Anti-patterns

**Anti-pattern: `T extends any`**
```ts
// Useless — T extends any is always true, same as no constraint
function bad<T extends any>(x: T): T { return x; }
// Fix: just use <T>
```

**Anti-pattern: overly broad constraint loses type info**
```ts
// This loses the specific shape of T
function process<T extends object>(x: T): object { return x; }
// Fix: preserve T in return
function process<T extends object>(x: T): T { return x; }
```

**Anti-pattern: union constraint when intersection needed**
```ts
// Wrong: T must be string OR number — not useful
function add<T extends string | number>(a: T, b: T): T { ... }
// Problem: T can be inferred as string | number, then a+b won't typecheck
// Fix for this case: use overloads or separate type parameters
```

---

## Utility: `FunctionArgs<T>` and `PromiseResult<T>`

Frequently needed patterns not in stdlib:

```ts
type FunctionArgs<T extends (...args: any[]) => any> =
  T extends (...args: infer A) => any ? A : never;

type PromiseResult<T> =
  T extends Promise<infer R> ? R : T;

// Async return type
type AsyncReturnType<T extends (...args: any[]) => Promise<any>> =
  T extends (...args: any[]) => Promise<infer R> ? R : never;
```

See also `templates/utility-types.ts` for a curated set ready to copy into a project.
