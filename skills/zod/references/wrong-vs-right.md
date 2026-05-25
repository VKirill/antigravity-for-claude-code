# zod — Wrong vs Right

Pattern pairs.

## 1. `parse` in user-facing handlers vs `safeParse`

```ts
// ❌ Wrong — throws ZodError, caller has to catch and translate
app.post('/users', (req, res) => {
  const user = CreateUser.parse(req.body)   // throws on bad input
  // ...
})

// ✅ Right — safeParse + structured response
app.post('/users', (req, res) => {
  const parsed = CreateUser.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors })
  }
  const user = parsed.data
  // ...
})
```

`parse` is fine for trusted internal code where a thrown error is acceptable. At HTTP / form / external-input boundaries, always `safeParse`.

## 2. `z.string().email()` (Zod 3) vs `z.email()` (Zod 4)

```ts
// ❌ Wrong (Zod 4 — removed)
const Email = z.string().email()

// ✅ Right (Zod 4)
const Email = z.email()
// also: z.url(), z.uuid(), z.cuid(), z.nanoid()
```

The chained methods on `z.string()` are gone in Zod 4.

## 3. `z.union` vs `z.discriminatedUnion` for tagged unions

```ts
// ❌ Wrong — O(n) dispatch, opaque error messages
const Event = z.union([
  z.object({ type: z.literal('click'), x: z.number() }),
  z.object({ type: z.literal('keypress'), key: z.string() }),
])

// ✅ Right — O(1) dispatch via discriminator
const Event = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), x: z.number() }),
  z.object({ type: z.literal('keypress'), key: z.string() }),
])
```

Discriminated unions narrow TS types correctly and produce clearer errors.

## 4. Raw `process.env` vs Zod-validated env

```ts
// ❌ Wrong — silent coercion bugs (Number('abc') = NaN)
const port = Number(process.env.PORT) || 3000
const dbUrl = process.env.DATABASE_URL!   // ! lies; might be undefined

// ✅ Right — validated at startup
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
})
export const env = envSchema.parse(process.env)
```

Throws at process start if env is misconfigured — fail fast.

## 5. `z.preprocess` for type change vs `.transform()`

```ts
// ❌ Wrong — preprocess that semantically changes type
const Schema = z.preprocess(
  (v) => parseInt(v as string, 10),
  z.number()
)
// works but obscures intent

// ✅ Right — transform for shape change after validation
const Schema = z.string()
  .transform((s) => parseInt(s, 10))
  .pipe(z.number().int().positive())
```

`preprocess` is for *normalization* (trim, lowercase). `transform` is for *output type change*.

## 6. `.extend(otherZodObject)` (Zod 3) vs `.extend(shape)` (Zod 4)

```ts
const Base = z.object({ id: z.string() })
const Other = z.object({ name: z.string() })

// ❌ Wrong (Zod 4 throws)
const Extended = Base.extend(Other)

// ✅ Right (Zod 4)
const Extended = Base.extend(Other.shape)
// or
const Extended = Base.merge(Other)
```

## 7. Strip mode (default) vs `strict()` at API boundary

```ts
// ❌ Wrong — extra typo'd fields silently dropped
const Body = z.object({ email: z.email(), name: z.string() })
Body.parse({ email: 'a@b.com', name: 'X', emial: 'typo@b.com' })   // typo ignored

// ✅ Right — strict() throws on unknown keys
const Body = z.object({ email: z.email(), name: z.string() }).strict()
Body.parse({ ..., emial: 'typo' })   // throws — caller knows about the typo
```

Use `.strict()` at API request boundaries to catch typos in real time.

## 8. No `z.any()` at boundaries

```ts
// ❌ Wrong — defeats the purpose
const Body = z.object({
  payload: z.any(),
})

// ✅ Right — describe the shape, or at minimum z.unknown() + refine
const Body = z.object({
  payload: z.unknown().refine(...)  // forces deliberate handling
})
```

`z.any()` allows anything; `z.unknown()` forces the developer to validate before use.

## See also

- [composition.md](composition.md), [transforms-and-refinements.md](transforms-and-refinements.md), [error-handling.md](error-handling.md), [migration-3-to-4.md](migration-3-to-4.md), [recommended-defaults.md](recommended-defaults.md), [troubleshooting.md](troubleshooting.md)
