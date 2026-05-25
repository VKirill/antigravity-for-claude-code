# RHF Basics — useForm, register, formState, watch

## useForm — full options

```ts
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
})
type Schema = z.infer<typeof schema>

const form = useForm<Schema>({
  resolver: zodResolver(schema),       // Zod handles all validation
  defaultValues: { email: '', name: '' }, // Required for isDirty + reset
  mode: 'onBlur',                      // When to validate: onSubmit|onBlur|onChange|onTouched|all
  reValidateMode: 'onChange',          // After first submit: when to re-validate
  shouldUnregister: false,             // Keep values when field unmounts (default)
  criteriaMode: 'firstError',          // 'firstError' | 'all' — how many errors per field
})
```

## register — native inputs

`register` returns `{ name, ref, onChange, onBlur }` — spread onto the input:

```tsx
function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', name: '' },
  })

  return (
    <form onSubmit={handleSubmit((data) => console.log(data))}>
      <input {...register('email')} type="email" />
      {errors.email && <span>{errors.email.message}</span>}

      <input {...register('name')} />
      {errors.name && <span>{errors.name.message}</span>}

      <button type="submit">Submit</button>
    </form>
  )
}
```

When using zodResolver, do NOT add inline constraints to `register` (`required: true`, `minLength`, etc.) — the resolver owns validation. Inline constraints add redundant logic and can conflict.

## register — without zodResolver (native validation)

Only use inline constraints when NOT using a schema resolver:

```ts
register('email', {
  required: 'Email is required',
  pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
})
register('age', {
  min: { value: 18, message: 'Must be 18+' },
  max: { value: 120, message: 'Invalid age' },
})
register('username', {
  validate: async (value) => {
    const taken = await checkUsernameApi(value)
    return taken ? 'Username already taken' : true
  },
})
```

## handleSubmit

```ts
const onSubmit = handleSubmit(
  async (data: Schema) => {
    // RHF sets isSubmitting: true while this promise is pending
    await saveToApi(data)
  },
  (errors) => {
    // Optional: called when validation fails
    console.log('Validation errors:', errors)
  },
)
```

The callback MUST be async if calling any async API — RHF tracks `isSubmitting` only for async handlers.

## formState — proxy-based subscriptions

`formState` uses a JavaScript Proxy. **Only the fields you destructure cause re-renders.** Destructure only what you need:

```tsx
// Good — only subscribes to errors and isSubmitting
const { errors, isSubmitting } = formState

// Bad — subscribes to all formState fields
const formState = form.formState // then reading formState.x
```

### Key formState fields

```ts
formState.errors          // Nested error object: errors.email?.message
formState.isSubmitting    // true while handleSubmit's async callback is pending
formState.isSubmitSuccessful // true after a successful submit (no error thrown)
formState.isDirty         // true if any field != its defaultValue
formState.dirtyFields     // { fieldName: true } — which fields changed
formState.isValid         // true when no validation errors (requires first validation pass)
formState.isValidating    // true during async validation
formState.touchedFields   // { fieldName: true } — fields the user interacted with
formState.submitCount     // number of times submitted (including failed)
```

### isValid gotcha

`isValid` starts `false` in `onSubmit` mode (RHF hasn't validated yet). Options:
- Use `mode: 'onChange'` or `mode: 'onBlur'` — triggers validation on interaction
- Call `trigger()` on mount if you need immediate validity
- Use `!isValid && submitCount === 0` to avoid showing the invalid state before first submit

## watch and useWatch

### watch

```tsx
// In the same component — re-renders on every change to 'role'
const role = watch('role')

// Watch multiple
const [firstName, lastName] = watch(['firstName', 'lastName'])

// Subscribe to all fields (avoid in large forms)
const allValues = watch()

// Watch with a callback (does NOT cause re-render)
useEffect(() => {
  const subscription = watch((values, { name, type }) => {
    console.log(name, values)
  })
  return () => subscription.unsubscribe()
}, [watch])
```

### useWatch — child component optimization

```tsx
import { useWatch } from 'react-hook-form'

// In a child component — avoids re-rendering the parent form
function RoleDisplay({ control }: { control: Control<Schema> }) {
  const role = useWatch({ control, name: 'role' })
  return <span>Current role: {role}</span>
}
```

`useWatch` is preferred over `watch` in child components because it doesn't cause the parent to re-render.

## setValue and getValues

```ts
// Set a value programmatically
setValue('name', 'Alice')

// Set with options
setValue('email', 'alice@example.com', {
  shouldValidate: true,  // Run validation after setting
  shouldDirty: true,     // Mark field as dirty
  shouldTouch: true,     // Mark field as touched
})

// Read without subscribing
const email = getValues('email')
const all = getValues()
const [name, email] = getValues(['name', 'email'])
```

`getValues` does not cause re-renders — use it in event handlers, not in render logic (use `watch` for that).

## reset

```ts
// Reset to original defaultValues
reset()

// Reset to new values (also updates defaultValues for isDirty tracking)
reset({ email: 'new@example.com', name: 'New Name' })

// Reset with options
reset(undefined, {
  keepErrors: false,      // Default: false
  keepDirty: false,       // Default: false
  keepValues: false,      // Default: false
  keepDefaultValues: false, // Default: false
  keepIsSubmitted: false,
  keepTouched: false,
  keepIsValid: false,
  keepSubmitCount: false,
})
```

Call `reset(responseData)` after successful API submission to sync `defaultValues` with saved state, clearing `isDirty`.

## trigger — manual validation

```ts
// Validate specific field
await trigger('email')

// Validate multiple fields
await trigger(['email', 'name'])

// Validate all fields
await trigger()

// Returns true if all triggered fields pass
const isStepValid = await trigger(['email', 'name'])
if (!isStepValid) return // Don't proceed to next step
```

Used in multi-step forms to validate per-step fields before advancing.

## Error object shape

```ts
// errors is nested to match your schema shape
errors.email?.message       // top-level field
errors.address?.city?.message // nested object
errors.items?.[0]?.name?.message // array field

// Each error object:
{
  type: 'required' | 'pattern' | 'custom' | 'server' | string
  message: string
  ref: HTMLElement // the DOM node
}
```

## Async validation with validate function

```ts
const schema = z.object({
  username: z.string().min(3).refine(
    async (val) => {
      const res = await fetch(`/api/check-username?u=${val}`)
      const { available } = await res.json()
      return available
    },
    { message: 'Username already taken' }
  ),
})
```

Zod's async refinements work with zodResolver — RHF will await them and set `isValidating: true` during the check. For debouncing, use `mode: 'onBlur'` or implement debounce inside the refinement.
