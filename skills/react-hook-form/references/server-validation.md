# Server Validation Merge

## Problem

After a form submission, the API returns field-level errors (e.g., HTTP 422 Unprocessable Entity). RHF's `formState.errors` needs to reflect these alongside client-side Zod errors.

## setError — inject a single field error

```ts
const { setError, handleSubmit, formState: { errors } } = useForm<Schema>({ ... })

const onSubmit = handleSubmit(async (data) => {
  const res = await fetch('/api/register', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    const body = await res.json()

    // API returns: { errors: [{ field: 'email', message: 'Email already registered' }] }
    for (const err of body.errors) {
      setError(err.field as keyof Schema, {
        type: 'server',
        message: err.message,
      })
    }
    return  // Stop — don't proceed to success state
  }

  // Handle success
})
```

## setError — root (non-field) errors

For errors that don't belong to a specific field (e.g., rate limiting, unknown server error):

```ts
setError('root', {
  type: 'server',
  message: 'Something went wrong. Please try again.',
})

// Display in JSX
{errors.root && <div role="alert">{errors.root.message}</div>}
```

`root` is a special RHF key for form-level errors. It appears in `formState.errors.root`.

## setError — nested fields

```ts
// For schema: { address: { city: z.string() } }
setError('address.city', {
  type: 'server',
  message: 'City not found in postal database',
})

// Display
{errors.address?.city && <span>{errors.address.city.message}</span>}
```

## setError with focus

```ts
setError('email', {
  type: 'server',
  message: 'Email already taken',
}, { shouldFocus: true })  // Focuses the field automatically
```

The field must be registered with a ref (via `register` or `Controller`'s `field.ref`) for focus to work.

## clearErrors

```ts
// Clear a specific field's error
clearErrors('email')

// Clear multiple fields
clearErrors(['email', 'username'])

// Clear all errors (including server-injected ones)
clearErrors()
```

Call `clearErrors('email')` on the email field's `onChange` to clear the server error when the user starts correcting it:

```tsx
<input
  {...register('email', {
    onChange: () => clearErrors('email'),
  })}
/>
```

Or use a `useEffect` that watches the field:

```tsx
const email = watch('email')
useEffect(() => clearErrors('email'), [email])
```

## Integration with TanStack Query useMutation

```tsx
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'

type ApiError = {
  errors: { field: string; message: string }[]
}

function RegistrationForm() {
  const form = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', name: '' },
  })

  const mutation = useMutation({
    mutationFn: (data: Schema) =>
      fetch('/api/register', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      }).then(async (res) => {
        if (!res.ok) throw await res.json()
        return res.json()
      }),
    onError: (error: ApiError) => {
      // Merge API errors into formState
      for (const err of error.errors ?? []) {
        form.setError(err.field as keyof Schema, {
          type: 'server',
          message: err.message,
        })
      }
      // Also set root for generic message
      if (!error.errors?.length) {
        form.setError('root', {
          type: 'server',
          message: 'Submission failed. Please try again.',
        })
      }
    },
    onSuccess: (data) => {
      form.reset()
      // redirect or show success UI
    },
  })

  const onSubmit = form.handleSubmit((data) => mutation.mutate(data))

  return (
    <form onSubmit={onSubmit}>
      <input {...form.register('email')} />
      {form.formState.errors.email && (
        <span>{form.formState.errors.email.message}</span>
      )}

      {/* Root error */}
      {form.formState.errors.root && (
        <div role="alert">{form.formState.errors.root.message}</div>
      )}

      <button
        type="submit"
        disabled={mutation.isPending || form.formState.isSubmitting}
      >
        {mutation.isPending ? 'Registering...' : 'Register'}
      </button>
    </form>
  )
}
```

## Error persistence behavior

Server errors injected via `setError` persist in `formState.errors` until:
1. The user corrects the field and re-validates (re-validates on the configured `mode`)
2. `clearErrors` is called explicitly
3. `reset()` is called

They do NOT clear automatically on next submit — the Zod resolver only sets errors for fields that fail the schema. If the API returns a server error for a field that passes client-side validation, `setError` keeps that error visible until explicitly cleared.

## Optimistic: clear before submit

For forms that may be resubmitted, clear root errors before each attempt:

```ts
const onSubmit = handleSubmit(async (data) => {
  clearErrors('root')
  try {
    await saveApi(data)
  } catch (err) {
    setError('root', { type: 'server', message: getErrorMessage(err) })
  }
})
```

## Multiple root error categories

Use namespaced root keys for distinct error categories:

```ts
// RHF allows any string as the root sub-key
setError('root.serverError', { type: 'server', message: 'API error' })
setError('root.networkError', { type: 'server', message: 'Network unavailable' })

// Access
errors.root?.serverError?.message
errors.root?.networkError?.message
```
