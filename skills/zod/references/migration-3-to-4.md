# Zod 3 → 4 Migration Guide

## Summary of breaking changes

| Zod 3 | Zod 4 | Action |
|---|---|---|
| `z.string().email()` | `z.email()` | Move to top-level |
| `z.string().url()` | `z.url()` | Move to top-level |
| `z.string().uuid()` | `z.uuid()` | Move to top-level |
| `z.string().cuid()` | `z.cuid()` | Move to top-level |
| `z.string().cuid2()` | `z.cuid2()` | Move to top-level |
| `z.string().ulid()` | `z.ulid()` | Move to top-level |
| `z.string().nanoid()` | `z.nanoid()` | Move to top-level |
| `z.string().ip()` | `z.ip()` | Move to top-level |
| `z.string().datetime()` | `z.iso.datetime()` | Use `z.iso.*` namespace |
| `.extend(ZodObject)` | `.extend({ plainShape })` | Pass plain object, not schema |
| `ZodError.format()` | `ZodError.flatten()` | Replace all usages |
| `z.ZodType` as generic bound | `z.ZodTypeAny` | Update generic constraints |
| `z.object({}).strict()` throws on extra | Same behavior | No change |

## String format validators: top-level move

The most common migration change. All string format validators that check email, URL, UUID, etc. move from `z.string()` chains to top-level `z` functions.

### Before (Zod 3)

```ts
z.string().email()
z.string().email("Invalid email")
z.string().url()
z.string().uuid()
z.string().cuid()
z.string().nanoid()
z.string().ip()
z.string().datetime()
```

### After (Zod 4)

```ts
z.email()
z.email("Invalid email")           // or z.email({ message: "..." })
z.url()
z.uuid()
z.cuid()
z.nanoid()
z.ip()
z.iso.datetime()                   // datetime moved to z.iso namespace
```

### Chaining still works

Format validators still return a ZodString subtype, so most constraints chain:

```ts
// Still valid in Zod 4:
z.email().endsWith("@company.com")
z.url().startsWith("https://")
z.uuid().optional()
```

## .extend() change

In Zod 3, `.extend()` accepted both a plain shape and another ZodObject:

```ts
// Zod 3 — both worked:
UserSchema.extend({ role: z.string() })     // plain shape — still works
UserSchema.extend(AdminExtra)               // ZodObject — BROKEN in Zod 4
```

In Zod 4, `.extend()` only accepts a plain shape. Use `.merge()` to combine two ZodObjects:

```ts
// Zod 4:
UserSchema.extend({ role: z.string() })     // OK — plain shape
UserSchema.merge(AdminSchema)               // merge two ZodObjects
```

### Migration pattern

Search for `.extend(` and check whether the argument is a ZodObject variable:

```ts
// Pattern to find: .extend(VariableName)
// Replace: .merge(VariableName)

// Pattern to find: .extend({ ... }) — no change needed
```

## ZodError.format() deprecation

`format()` is removed in Zod 4. Replace with `flatten()`:

```ts
// Zod 3:
const formatted = error.format();
// { _errors: [...], email: { _errors: [...] } }

// Zod 4:
const flat = error.flatten();
// { formErrors: [...], fieldErrors: { email: [...] } }
```

**Access pattern changes:**

| Zod 3 `.format()` | Zod 4 `.flatten()` |
|---|---|
| `formatted._errors` | `flat.formErrors` |
| `formatted.email?._errors?.[0]` | `flat.fieldErrors.email?.[0]` |

## Generic type bounds

If you have code that accepts "any Zod schema" generically:

```ts
// Zod 3:
function validate<T extends z.ZodType>(schema: T, data: unknown) {
  return schema.parse(data);
}

// Zod 4:
function validate<T extends z.ZodTypeAny>(schema: T, data: unknown) {
  return schema.parse(data) as z.infer<T>;
}
```

## z.iso namespace (datetime)

In Zod 4, datetime-related string validators live under `z.iso`:

```ts
// Zod 3:
z.string().datetime()
z.string().datetime({ offset: true })
z.string().datetime({ precision: 3 })

// Zod 4:
z.iso.datetime()
z.iso.datetime({ offset: true })
z.iso.datetime({ precision: 3 })

// Also available:
z.iso.date()           // "2024-01-01" format
z.iso.time()           // "14:30:00" format
z.iso.duration()       // ISO 8601 duration "P1Y2M3D"
```

## Performance improvements (non-breaking)

Zod 4 is significantly faster for large schemas. No API changes needed — parsing is faster automatically. Key improvements:

- Object parsing is ~2–5x faster
- Error construction is lazy (only built when accessed)
- TypeScript inference is faster due to leaner internal types

## Package size (non-breaking)

Zod 4 is smaller. No imports change — still `import { z } from "zod"`.

## Automated migration

A codemod script can handle the mechanical changes:

```bash
# Using npx with the official Zod codemod (if available)
npx @zod/codemod v4

# Manual grep for common patterns:
# Find all .email() string chains
grep -rn '\.string()\.email()' src/

# Find all .format() calls on errors
grep -rn '\.format()' src/ | grep -v 'console\|log\|date\|number'
```

## Common runtime errors after migration

**`z.email is not a function`** — You have `z.string().email()` still in your code. Run the grep above.

**`TypeError: schema.extend is not a function on plain object`** — You called `.extend()` on the result of `.extend()` with a ZodObject. Change to `.merge()`.

**`flat.fieldErrors.xxx is undefined`** — You're accessing `formatted.xxx._errors` (Zod 3 format) instead of `flat.fieldErrors.xxx` (Zod 4 flatten).

**`ZodError: Cannot read property 'issues' of undefined`** — Async refinement called with `.parse()` instead of `.parseAsync()`. Add `await schema.safeParseAsync(data)`.

## Incremental migration

If you have a large codebase, you can migrate incrementally:

1. Update `zod` to `^4.0.0`
2. Fix TypeScript errors first (`.format()`, `.ZodType` → `.ZodTypeAny`)
3. Run tests — any runtime errors surface the `.email()` / `.extend()` issues
4. Fix grep results for `z.string().email()` etc.
5. Verify no `.extend(zodObjectVariable)` patterns remain
