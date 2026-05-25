# zod — Recommended Defaults

Canonical Zod 4 patterns. Override only with a reason.

## Object schema mode — `strict` vs `strip` vs `passthrough`

| Mode | Behavior | When |
|---|---|---|
| `.strip()` (default) | unknown keys removed silently | most internal schemas |
| `.strict()` ⭐ | unknown keys throw `ZodError` | API request bodies, env vars |
| `.passthrough()` | unknown keys preserved | proxying payloads, flexible APIs |

**Rule:** Use `.strict()` at API boundaries. Catches typos and accidental extra fields early.

```ts
const CreateUserBody = z.object({
  email: z.email(),
  name: z.string().min(1),
}).strict()   // body with extra fields → 400
```

## Error map — custom messages

```ts
// Global custom error map
z.setErrorMap((issue, ctx) => {
  if (issue.code === 'invalid_type') {
    return { message: `Expected ${issue.expected}, got ${issue.received}` }
  }
  return { message: ctx.defaultError }
})
```

For i18n, build a map that switches on the user's locale.

For per-schema overrides:

```ts
z.string({
  required_error: 'Email is required',
  invalid_type_error: 'Email must be a string',
}).email('Must be a valid email')
```

## `safeParse` at boundaries, `parse` internally

```ts
// ✅ API handler — never throw on bad input
const result = CreateUserBody.safeParse(req.body)
if (!result.success) {
  return res.status(400).json({ errors: result.error.flatten().fieldErrors })
}
const user = result.data

// ✅ Internal trusted code — parse can throw (caller doesn't care about field errors)
const config = ConfigSchema.parse(rawConfig)
```

## Env var validation

```ts
// env.ts — runs at process startup, NOT per-request
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32),
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
})

export const env = envSchema.parse(process.env)   // throws at startup if invalid
```

`z.coerce.number()` converts the string env var to number. `.default()` provides fallback. NEVER access `process.env.X` directly anywhere else — use `env.X`.

## `discriminatedUnion` over `union`

```ts
// ✅ Right — O(1) dispatch, clearer errors
const Event = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), x: z.number(), y: z.number() }),
  z.object({ type: z.literal('keypress'), key: z.string() }),
])

// ❌ Wrong (for tagged unions) — z.union tries each schema in order
const Event = z.union([clickSchema, keypressSchema])
```

## Coerce vs preprocess

| Use | When |
|---|---|
| `z.coerce.number()` | env vars, query strings, form data — primitive conversion |
| `z.preprocess(fn, schema)` | normalize before parsing (trim strings, lowercase emails) |
| `.transform(fn)` | reshape AFTER validation (computed fields, type narrowing) |

```ts
const Email = z.preprocess(
  (v) => typeof v === 'string' ? v.trim().toLowerCase() : v,
  z.email(),
)
```

## Optional + default — combine pattern

```ts
// Field is missing-or-string; default fills missing
const PageSize = z.coerce.number().int().positive().default(20)

// Field is missing-or-null; nullish handles both
const Bio = z.string().nullish().default(null)
```

## When to brand

```ts
// Domain primitives that should NOT be interchangeable
const UserId = z.string().uuid().brand<'UserId'>()
const PostId = z.string().uuid().brand<'PostId'>()

type UserId = z.infer<typeof UserId>   // string & { __brand: 'UserId' }
type PostId = z.infer<typeof PostId>

// TS error — branded types prevent cross-domain mixing
const u: UserId = 'abc' as UserId
const p: PostId = u  // ❌ Type error
```

## Tuning ranges

| Pattern | Default | When to switch |
|---|---|---|
| Object mode | `.strip()` | `.strict()` at API boundary, `.passthrough()` for proxies |
| Error reporting | `.safeParse()` | `.parse()` for trusted internal code only |
| Number parsing | `z.number()` | `z.coerce.number()` for env/query strings |
| Format validation | `z.email()` (Zod 4) | NOT `z.string().email()` (Zod 3 — removed) |

## See also

- [composition.md](composition.md), [error-handling.md](error-handling.md), [migration-3-to-4.md](migration-3-to-4.md), [troubleshooting.md](troubleshooting.md)
