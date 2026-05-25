# Zod 4 — Schema Primitives

## String primitives

```ts
z.string()             // any string
z.string().min(1)      // at least 1 char
z.string().max(255)    // at most 255 chars
z.string().length(10)  // exactly 10 chars
z.string().regex(/^\d+$/)
z.string().startsWith("prefix")
z.string().endsWith(".ts")
z.string().includes("substring")
z.string().trim()      // transform: trims whitespace
z.string().toLowerCase()
z.string().toUpperCase()
```

**Zod 4 format validators — top-level, NOT chained from `z.string()`:**

```ts
z.email()       // was z.string().email() in Zod 3
z.url()         // was z.string().url()
z.uuid()        // was z.string().uuid()
z.cuid()        // was z.string().cuid()
z.cuid2()
z.ulid()
z.nanoid()
z.ip()          // IPv4 or IPv6
z.ip({ version: "v4" })
z.cidr()
z.base64()
z.base64url()
z.jwt()
z.datetime()    // ISO 8601 datetime string
z.date()        // z.date() still parses JS Date objects
```

These top-level validators return a `ZodString` subtype, so `.min()`, `.max()`, `.regex()` still chain:

```ts
z.email().endsWith("@company.com")
z.url().startsWith("https://")
```

## Number primitives

```ts
z.number()
z.number().min(0)          // >= 0
z.number().max(100)        // <= 100
z.number().gt(0)           // > 0
z.number().gte(0)          // >= 0 (alias for .min)
z.number().lt(100)         // < 100
z.number().lte(100)        // <= 100 (alias for .max)
z.number().int()           // integer only
z.number().positive()      // > 0
z.number().nonnegative()   // >= 0
z.number().negative()      // < 0
z.number().nonpositive()   // <= 0
z.number().finite()        // excludes Infinity/-Infinity
z.number().safe()          // within Number.MAX_SAFE_INTEGER
z.number().multipleOf(5)   // divisible by 5
```

## Boolean, Date, BigInt

```ts
z.boolean()

z.date()                          // must be a JS Date instance
z.date().min(new Date("2020-01-01"))
z.date().max(new Date())

z.bigint()
z.bigint().min(0n)
z.bigint().max(BigInt(2 ** 53))
```

## Literal, Enum, NativeEnum

```ts
// Literal — exactly one value
z.literal("active")
z.literal(42)
z.literal(true)
z.literal(null)

// Enum — TS union from string array
const StatusSchema = z.enum(["pending", "active", "closed"]);
type Status = z.infer<typeof StatusSchema>;   // "pending" | "active" | "closed"
StatusSchema.enum.pending                     // "pending" — access enum values

// Native enum — wrap TypeScript enum
enum Direction { Up = "UP", Down = "DOWN" }
const DirSchema = z.nativeEnum(Direction);
type Dir = z.infer<typeof DirSchema>;         // Direction
```

## Array

```ts
z.array(z.string())
z.array(z.number()).min(1)
z.array(z.string()).max(10)
z.array(z.string()).length(3)
z.array(z.string()).nonempty()   // at least 1 element; output typed as [string, ...string[]]

// Element access
const schema = z.array(z.string());
schema.element  // → ZodString
```

## Tuple

```ts
const CoordSchema = z.tuple([z.number(), z.number()]);
type Coord = z.infer<typeof CoordSchema>; // [number, number]

// With rest element
const ArgsSchema = z.tuple([z.string()]).rest(z.number());
// [string, ...number[]]
```

## Record & Map & Set

```ts
// Record: string keys + schema values
z.record(z.string(), z.number())   // Record<string, number>

// Enum-keyed record
z.record(z.enum(["a", "b"]), z.boolean())  // { a: boolean, b: boolean }

// Map
z.map(z.string(), z.number())   // Map<string, number>

// Set
z.set(z.string())               // Set<string>
z.set(z.string()).min(1).max(5)
```

## Optional, Nullable, Nullish

```ts
z.string().optional()   // string | undefined
z.string().nullable()   // string | null
z.string().nullish()    // string | null | undefined

// Unwrap
const opt = z.string().optional();
opt.unwrap()   // ZodString — inner type
```

## Default and Catch

```ts
// .default() — supply value when input is undefined
z.string().optional().default("anon")         // static value
z.string().optional().default(() => "anon")   // factory (runs on each parse)

// .catch() — return fallback instead of throwing on any error
z.number().catch(0)          // if parsing fails → 0
z.string().catch("")         // if parsing fails → ""
```

## Coerce

`z.coerce.*` calls the JavaScript constructor before parsing. Essential for env vars.

```ts
z.coerce.string()    // String(value) → then validates as string
z.coerce.number()    // Number(value) → then validates as number
z.coerce.boolean()   // Boolean(value) → careful: any truthy string → true
z.coerce.date()      // new Date(value) → converts ISO strings and timestamps
z.coerce.bigint()    // BigInt(value)

// Common patterns
z.coerce.number().int().min(1)            // PORT=3000 from env
z.coerce.boolean().default(false)         // DEBUG=false from env
z.coerce.date()                           // "2024-01-01" from query string
```

**Boolean coerce gotcha:** `z.coerce.boolean().parse("false")` returns `true` because `Boolean("false") === true`. For env vars that must be strictly `"true"/"false"`:

```ts
const BoolEnvSchema = z.string()
  .transform(v => v === "true")
  .pipe(z.boolean());
```

## Void, Any, Unknown, Never

```ts
z.void()     // undefined (typically for functions returning void)
z.any()      // accepts any value, output type is `any` — avoid at boundaries
z.unknown()  // accepts any value, output type is `unknown` — safe
z.never()    // rejects everything — useful in discriminated union exhaustiveness
```

## Custom error messages

Every constraint accepts a string or object second argument:

```ts
z.string().min(1, "Name is required")
z.number().max(100, { message: "Must be ≤ 100" })
z.string().email({ message: "Invalid email address" })  // top-level format validator
z.string().regex(/^\d+$/, "Must contain only digits")
```

## Preprocess (input coercion before schema)

For complex transformations before parsing — different from `z.coerce`:

```ts
const NumberFromString = z.preprocess(
  (val) => (typeof val === "string" ? Number(val) : val),
  z.number()
);
```

Use `z.preprocess` when you need conditional logic. Prefer `z.coerce` for simple type coercions.
