# Zod Resolver Integration

## Installation

```bash
npm install @hookform/resolvers zod
```

## Basic setup

```ts
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email('Must be a valid email'),
  age: z.number().min(18, 'Must be 18+').max(120),
  role: z.enum(['admin', 'viewer', 'editor']),
})

// Infer TypeScript type from schema — single source of truth
type Schema = z.infer<typeof schema>

const form = useForm<Schema>({
  resolver: zodResolver(schema),
  defaultValues: {
    email: '',
    age: 18,
    role: 'viewer',
  },
})
```

With `zodResolver`, **do not add inline constraints** to `register` (`required`, `minLength`, etc.). The resolver owns validation. Inline constraints run separately and can produce duplicate or conflicting errors.

## Zod 4 vs Zod 3 — key differences for RHF

Zod 4 changes the `@hookform/resolvers` import:

```ts
// Zod 4
import { zodResolver } from '@hookform/resolvers/zod'  // same

// Error object shape changed in Zod 4
// z.ZodError is now ZodError (no namespace)
// .issues array shape is same but some codes renamed
```

Use `@hookform/resolvers` v3.10+ with Zod 4.

## Coercion for number inputs

HTML inputs always return strings. Use `z.coerce.number()` to auto-convert:

```ts
const schema = z.object({
  price: z.coerce.number().min(0),
  quantity: z.coerce.number().int().positive(),
})
```

Or use `register('quantity', { valueAsNumber: true })` — but not both for the same field.

## Optional fields

```ts
z.object({
  bio: z.string().optional(),           // undefined or string
  website: z.string().url().optional(), // undefined or valid URL
  nickname: z.string().or(z.literal('')), // empty string allowed
})
```

For inputs that can be cleared (text input that becomes empty string):

```ts
z.string().min(1).optional().or(z.literal(''))
// accepts: undefined, '', or non-empty string
```

## .refine — custom sync validation

```ts
const schema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'], // Error appears on confirmPassword field
  }
)
```

The `path` in `refine` controls which field gets the error in `formState.errors`.

## .refine — async validation

Async refinements work seamlessly with zodResolver. RHF sets `isValidating: true` while they run:

```ts
const schema = z.object({
  username: z.string().min(3).refine(
    async (val) => {
      const res = await fetch(`/api/check-username?username=${encodeURIComponent(val)}`)
      if (!res.ok) return false
      const { available } = await res.json()
      return available
    },
    { message: 'Username is already taken' }
  ),
})
```

For performance, use `mode: 'onBlur'` so async checks run on blur, not every keystroke.

## .superRefine — multiple errors in one refine

```ts
const schema = z.object({
  password: z.string(),
}).superRefine((data, ctx) => {
  if (data.password.length < 8) {
    ctx.addIssue({
      code: z.ZodIssueCode.too_small,
      minimum: 8,
      type: 'string',
      inclusive: true,
      message: 'Password must be at least 8 characters',
      path: ['password'],
    })
  }
  if (!/[A-Z]/.test(data.password)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Password must contain an uppercase letter',
      path: ['password'],
    })
  }
})
```

With `criteriaMode: 'all'` in `useForm`, all issues appear. With `criteriaMode: 'firstError'` (default), only the first.

## Discriminated unions

```ts
const schema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('email'), email: z.string().email() }),
  z.object({ type: z.literal('phone'), phone: z.string().regex(/^\+\d{10,14}$/) }),
])

// useForm with discriminated union — Controller watches 'type'
const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
  defaultValues: { type: 'email', email: '' },
})
```

Watch the discriminant field and conditionally render fields:

```tsx
const type = form.watch('type')

{type === 'email' && <input {...form.register('email')} />}
{type === 'phone' && <input {...form.register('phone')} />}
```

## Partial schemas for multi-step validation

Extract per-step schema to validate only the visible fields:

```ts
const fullSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.enum(['admin', 'viewer']),
  plan: z.enum(['free', 'pro']),
})

// Step 1 — only validate these fields
const step1Schema = fullSchema.pick({ email: true, name: true })

// Step 2 — only validate these fields
const step2Schema = fullSchema.pick({ role: true, plan: true })

// Full form uses fullSchema resolver
const form = useForm<z.infer<typeof fullSchema>>({
  resolver: zodResolver(fullSchema),
  ...
})

// Step validation uses trigger() with field names — not a second resolver
await form.trigger(['email', 'name'])  // validates only step 1 fields
```

Alternatively, use separate `useForm` instances per step and merge values at the end (see multi-step-forms.md).

## z.preprocess for input transformation

```ts
// Convert empty string to null/undefined for optional nullable fields
const schema = z.object({
  middleName: z.preprocess(
    (val) => val === '' ? undefined : val,
    z.string().optional()
  ),
  // Or for nullable
  notes: z.preprocess(
    (val) => val === '' ? null : val,
    z.string().nullable().optional()
  ),
})
```

## zodResolver error mode

Pass `{ mode: 'async' }` as second arg to `zodResolver` if your schema has top-level async refinements and you need them to run on every validation (vs. only on submit):

```ts
resolver: zodResolver(schema, undefined, { mode: 'async' })
```

Default is `'sync'` which runs sync validation first; async only runs if sync passes.

## Common schema patterns

```ts
// Phone number
z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number')

// URL (optional)
z.string().url('Invalid URL').optional().or(z.literal(''))

// Date string → Date object
z.string().pipe(z.coerce.date())

// File input
z.instanceof(File, { message: 'Please select a file' })

// File with type + size constraints
z.instanceof(File)
  .refine((f) => f.size < 5_000_000, 'Max 5MB')
  .refine(
    (f) => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type),
    'JPG, PNG, or WebP only'
  )
```
