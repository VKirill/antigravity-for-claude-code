# Wrong vs Right — typescript

Side-by-side contrast for common TypeScript footguns.

---

### `as` cast vs `satisfies`

**❌ Wrong — `as` widens or lies:**

```ts
const routes = {
  home: '/',
  about: '/about',
  contact: '/contact',
} as Record<string, string>;

// routes.home is now `string` — literal lost
// Spelling errors at usage sites silently typecheck:
const path = routes['homee']; // string (undefined at runtime)
```

**✅ Right — `satisfies` validates without widening:**

```ts
const routes = {
  home: '/',
  about: '/about',
  contact: '/contact',
} satisfies Record<string, string>;

// routes.home is the literal '/'
// Spelling errors fail at compile time:
const path = routes['homee']; // ts error: Property 'homee' does not exist
```

**Why it matters:** `as` is an unchecked assertion — the compiler trusts you. `satisfies` (TS 4.9+) checks the value against the type **without changing the value's inferred type**. You get both type validation and literal preservation. Reach for `as` only when you genuinely know more than the type checker (e.g., serialization boundary, branded-type construction). Default to `satisfies`.

---

### `any` vs `unknown` at boundaries

**❌ Wrong — `any` poisons the call site:**

```ts
function parse(json: string): any {
  return JSON.parse(json);
}

const data = parse('{"x":1}');
data.foo.bar.baz();   // typechecks, crashes at runtime
data.length;          // typechecks, undefined
```

**✅ Right — `unknown` forces a narrow:**

```ts
function parse(json: string): unknown {
  return JSON.parse(json);
}

const data = parse('{"x":1}');
// data.foo;  // ts error: Object is of type 'unknown'

// Narrow first
if (typeof data === 'object' && data !== null && 'x' in data) {
  // here data is { x: unknown }
}

// Or use a Zod / runtime-validation lib
const Schema = z.object({ x: z.number() });
const safe = Schema.parse(data);  // safe.x is number
```

**Why it matters:** `any` opts out of the type system. `unknown` requires you to narrow before access — exactly what you want at I/O boundaries (JSON, query params, env vars). Save `any` for last-resort migrations and `@ts-expect-error`-justified escapes. At every API/file/network boundary, `unknown` + a validator is the correct shape.

---

### `enum` vs `as const` object

**❌ Wrong — runtime enum object pollutes bundle and emits code:**

```ts
enum Status {
  Active = 'active',
  Disabled = 'disabled',
  Pending = 'pending',
}

function update(s: Status) { /* ... */ }
update(Status.Active);
```

Numeric enums also allow nonsensical reverse mappings (`Status[1] === 'Active'`). Even string enums emit a runtime object, can't be used as JS object literals, and don't tree-shake well.

**✅ Right — `as const` object + derived union:**

```ts
const Status = {
  Active: 'active',
  Disabled: 'disabled',
  Pending: 'pending',
} as const;

type Status = (typeof Status)[keyof typeof Status];
// type Status = 'active' | 'disabled' | 'pending'

function update(s: Status) { /* ... */ }
update(Status.Active);          // works
update('active');               // also works — literal narrows
```

**Why it matters:** `as const` objects produce a plain JS object (tree-shakable, JSON-serializable), and the derived type is a clean string union. They interop with JSON APIs and Zod enums (`z.enum([...])`) without translation. Enums are a TS-specific construct that emits code, sometimes silently produces unsafe types (numeric enums), and pre-dates modern union-narrowing.

Caveat: `const enum` (inlined at compile time) is still useful in performance-critical inner loops — but `isolatedModules: true` and `verbatimModuleSyntax: true` both reject it. Default to `as const` objects.

---

### `interface` declaration merging — accidental vs intentional

**❌ Wrong — accidental interface merge corrupts library types:**

```ts
// our-app.ts
interface Window {
  ourApp: { version: string };
}

// Now `Window.ourApp` exists globally — including in places that didn't import this file.
// Worse: a typo (`ourAPP`) silently merges into the global Window type.
```

**✅ Right — explicit ambient declaration:**

```ts
// types/global.d.ts (or via `declare global` inside a module)
export {};

declare global {
  interface Window {
    ourApp: { version: string };
  }
}
```

The `export {}` makes the file a module; `declare global` is the explicit, audit-friendly mechanism.

**Why it matters:** Interface declaration merging is powerful but invisible — TS happily merges any two `interface Foo` declarations across a project, including typos. Using `declare global` makes the augmentation intentional, locatable, and reviewable. For module-augmenting library types (e.g., Express `Request`), use the same pattern with `declare module 'express' { ... }`.
