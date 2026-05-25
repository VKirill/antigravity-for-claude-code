# zod — Reference Index

## Decision map

| Task | Open this file |
|---|---|
| Defining string/number/boolean/date/enum/coerce primitives | [schema-primitives.md](schema-primitives.md) |
| Composing objects: extend, merge, pick, omit, partial, union, discriminatedUnion, branded, lazy | [composition.md](composition.md) |
| Writing transforms, refinements, pipe, async validation | [transforms-and-refinements.md](transforms-and-refinements.md) |
| Handling ZodError, safeParse patterns, flattening errors | [error-handling.md](error-handling.md) |
| React Hook Form + zodResolver integration | [integration-rhf.md](integration-rhf.md) |
| Migrating from Zod 3 to Zod 4 | [migration-3-to-4.md](migration-3-to-4.md) |
| Routing tests and negative examples | [eval-cases.md](eval-cases.md) |

## Quick-lookup: most-used patterns

```ts
// Object schema + type extraction
const UserSchema = z.object({
  id: z.number().int().positive(),
  email: z.email(),           // Zod 4 — NOT z.string().email()
  name: z.string().min(1),
  role: z.enum(["admin", "user"]),
});
type User = z.infer<typeof UserSchema>;

// Safe parse + error handling
const result = UserSchema.safeParse(rawInput);
if (!result.success) {
  const flat = result.error.flatten();
  // flat.fieldErrors: Record<string, string[]>
  // flat.formErrors: string[]
}

// Env var validation with coerce
const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1024).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  DEBUG: z.coerce.boolean().default(false),
});
export const env = EnvSchema.parse(process.env);

// Discriminated union
const EventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("created"), id: z.string() }),
  z.object({ type: z.literal("deleted"), id: z.string(), at: z.date() }),
]);
```

## Key Zod 4 changes at a glance

| Zod 3 | Zod 4 |
|---|---|
| `z.string().email()` | `z.email()` |
| `z.string().url()` | `z.url()` |
| `z.string().uuid()` | `z.uuid()` |
| `z.string().cuid()` | `z.cuid()` |
| `.extend(anotherZodObject)` | `.extend({ key: z.type() })` — plain shape only |
| `ZodError.format()` | `ZodError.flatten()` |
| `z.ZodType` generic bound | `z.ZodTypeAny` |

See full list in [migration-3-to-4.md](migration-3-to-4.md).

## Version pins

- Zod: `4.x`
- TypeScript: `5.9.x`
- `@hookform/resolvers`: `3.x` (for React Hook Form 8 bridge)
- `zod-to-json-schema`: `3.x`
