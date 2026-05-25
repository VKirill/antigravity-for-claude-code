# zod — Troubleshooting

Symptom-indexed.

## `discriminatedUnion` doesn't narrow type

**Symptom:** After `safeParse` success, the parsed value is typed as the union — TS doesn't narrow on `data.type === 'click'`.

**Causes:**
1. Used `z.union` instead of `z.discriminatedUnion` — `z.union` doesn't get O(1) dispatch or narrowing benefits
2. Discriminator field is not `z.literal()` — must be a literal, not a string
3. Two members share the same discriminator value — Zod can't distinguish

**Fix:**
```ts
// Wrong — z.string() not z.literal
z.discriminatedUnion('type', [
  z.object({ type: z.string(), x: z.number() }),   // ❌
])

// Right
z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), x: z.number() }),
  z.object({ type: z.literal('keypress'), key: z.string() }),
])
```

## Transform breaks type inference

**Symptom:** After `.transform()`, `z.infer<typeof schema>` is `any` or the wrong shape.

**Causes:**
1. Transform returns a value whose type TS can't infer (annotate explicitly)
2. Chained `.transform().refine()` — refinement on transformed output requires care

**Fix:**
```ts
const Schema = z.string().transform((s): number => {
  return parseInt(s, 10)
})

type Result = z.infer<typeof Schema>   // number ✓
```

Annotate the return type of the transform callback explicitly.

For piped schemas:
```ts
const Schema = z.string()
  .transform((s) => parseInt(s, 10))
  .pipe(z.number().int().positive())
```

## Async refine race condition

**Symptom:** Async `.refine` (e.g., uniqueness check against DB) sometimes passes for a value the user has already used.

**Cause:** Two concurrent requests both pass the uniqueness check before either commits — TOCTOU race.

**Fix:** Don't rely on Zod refine for uniqueness — enforce at the DB level (UNIQUE constraint, INSERT ... ON CONFLICT). Use refine for "good UX" early feedback, but treat the DB error as authoritative:

```ts
const Schema = z.object({
  email: z.email().refine(
    async (email) => !(await isEmailTaken(email)),
    { message: 'Email already in use' },
  ),
})

// At write time:
try {
  await db.users.create({ data })
} catch (e) {
  if (isUniqueViolation(e)) {
    // race lost — surface a field error
  }
}
```

## `.safeParse` on async refine returns `success: false` with weird error

**Symptom:** Schema with `.refineAsync` returns failure even with valid data, message says "Async refinement encountered during synchronous parse."

**Cause:** Used `.parse()` / `.safeParse()` on a schema with an async refine. Sync parse can't run async code.

**Fix:** Use `.parseAsync()` / `.safeParseAsync()`:
```ts
const result = await schema.safeParseAsync(data)
```

## `z.string().email()` is not a function

**Symptom:** TS error or runtime error after upgrading to Zod 4.

**Cause:** Zod 4 removed `.email()` (and `.url()`, `.uuid()`, etc.) as methods on `z.string()` — moved to top-level.

**Fix:**
```ts
// Wrong (Zod 3)
z.string().email()

// Right (Zod 4)
z.email()
```

Same for `z.url()`, `z.uuid()`, `z.cuid()`, `z.nanoid()`.

## `.extend()` throws after Zod 4 upgrade

**Symptom:** `Schema.extend(OtherSchema)` throws "expected an object shape, got ZodObject".

**Cause:** Zod 4 changed `.extend()` to only accept a plain shape (record of schemas), not another `ZodObject`.

**Fix:**
```ts
// Wrong (Zod 3 worked)
Schema.extend(OtherSchema)

// Right (Zod 4)
Schema.extend(OtherSchema.shape)
// or use .merge() if both are ZodObjects
Schema.merge(OtherSchema)
```

## `z.infer` returns `any`

**Symptom:** `type T = z.infer<typeof schema>` is `any`.

**Causes:**
1. Schema is typed as `z.ZodType` (which strips inference) — use the actual schema variable
2. Schema is recursive and TS gave up — annotate explicitly with `z.ZodType<Manual>`

**Fix:**
```ts
// Recursive — provide an interface
interface Category { name: string; children: Category[] }

const Category: z.ZodType<Category> = z.lazy(() =>
  z.object({
    name: z.string(),
    children: z.array(Category),
  })
)

type T = z.infer<typeof Category>   // Category ✓
```

## Validation message is "Required" but field is present

**Symptom:** `{ email: 'foo@bar.com' }` returns issue with message "Required" on `email`.

**Causes:**
1. Field value is wrong type — e.g., number where string expected
2. Schema uses `.email()` (Zod 3 chain) which is now `z.email()` — fails silently or with wrong error

**Fix:** Inspect `result.error.issues[0]`. The `code` field tells you what actually failed:
- `invalid_type` — wrong type
- `too_small` — string too short, number too low
- `invalid_string` — format violation (email, url, regex)
- `unrecognized_keys` — extra fields with `.strict()`

## Coerce silently produces `NaN`

**Symptom:** `z.coerce.number().parse('abc')` doesn't throw — returns `NaN`.

**Cause:** `z.coerce.number()` calls `Number('abc')` → `NaN`. NaN is technically a number.

**Fix:** Chain `.finite()`:
```ts
z.coerce.number().finite()          // rejects NaN and Infinity
z.coerce.number().int().positive()  // additionally rejects fractions and negatives
```

## See also

- [composition.md](composition.md), [error-handling.md](error-handling.md), [transforms-and-refinements.md](transforms-and-refinements.md), [migration-3-to-4.md](migration-3-to-4.md), [recommended-defaults.md](recommended-defaults.md)
