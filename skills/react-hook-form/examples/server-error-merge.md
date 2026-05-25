# Merging API Validation Errors into formState

## Scenario

A registration form submits to `/api/register`. The API returns HTTP 422 with field-level errors when the email is already taken or the username is reserved. These must appear under the relevant fields without losing other formState (isValid, isDirty, etc.).

## API contract (example)

```ts
// Success: 200 { userId: string }
// Validation error: 422
{
  "status": "error",
  "errors": [
    { "field": "email", "message": "Email already registered" },
    { "field": "username", "message": "Username is reserved" }
  ]
}
// Server error: 500 { "status": "error", "message": "Internal server error" }
```

## Schema

```ts
const schema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers, underscores only'),
  email: z.string().email(),
  password: z.string().min(8),
})
type Schema = z.infer<typeof schema>
```

## Form component

```tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

export function RegistrationForm() {
  const form = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', email: '', password: '' },
    mode: 'onBlur',
  })

  const { register, handleSubmit, setError, clearErrors, formState: { errors, isSubmitting } } = form

  const onSubmit = handleSubmit(async (data) => {
    // Clear previous server errors before each attempt
    clearErrors('root')

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      // Success path — redirect or show success
      window.location.href = '/dashboard'
      return
    }

    const body = await res.json()

    if (res.status === 422 && Array.isArray(body.errors)) {
      // Inject each field error into formState
      let focused = false
      for (const err of body.errors) {
        setError(err.field as keyof Schema, {
          type: 'server',
          message: err.message,
        }, {
          // Focus the first errored field automatically
          shouldFocus: !focused,
        })
        focused = true
      }
    } else {
      // Non-field / unexpected error
      setError('root', {
        type: 'server',
        message: body.message ?? 'Registration failed. Please try again.',
      })
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {/* Root (non-field) error */}
      {errors.root && (
        <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {errors.root.message}
        </div>
      )}

      {/* Username */}
      <div>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          {...register('username', {
            onChange: () => clearErrors('username'),  // Clear server error when user corrects
          })}
          aria-invalid={!!errors.username}
          aria-describedby={errors.username ? 'username-error' : undefined}
        />
        {errors.username && (
          <p id="username-error" className="text-sm text-red-600">
            {errors.username.message}
          </p>
        )}
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          {...register('email', {
            onChange: () => clearErrors('email'),
          })}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-red-600">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          {...register('password')}
          aria-invalid={!!errors.password}
        />
        {errors.password && (
          <p className="text-sm text-red-600">{errors.password.message}</p>
        )}
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating account…' : 'Create Account'}
      </button>
    </form>
  )
}
```

## With TanStack Query useMutation

```tsx
import { useMutation } from '@tanstack/react-query'

async function registerUser(data: Schema) {
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    // Throw with the response body so onError can inspect it
    throw Object.assign(new Error('Registration failed'), { response: res, body: await res.json() })
  }
  return res.json()
}

function RegistrationFormWithQuery() {
  const form = useForm<Schema>({ resolver: zodResolver(schema), defaultValues: { ... } })

  const mutation = useMutation({
    mutationFn: registerUser,
    onError: (err: Error & { body?: { errors?: { field: string; message: string }[] } }) => {
      const fieldErrors = err.body?.errors
      if (fieldErrors?.length) {
        for (const fe of fieldErrors) {
          form.setError(fe.field as keyof Schema, { type: 'server', message: fe.message })
        }
      } else {
        form.setError('root', { type: 'server', message: err.message })
      }
    },
    onSuccess: () => {
      form.reset()
      // redirect
    },
  })

  const onSubmit = form.handleSubmit((data) => mutation.mutate(data))

  return (
    <form onSubmit={onSubmit}>
      {/* fields ... */}
      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Registering…' : 'Register'}
      </button>
    </form>
  )
}
```

## Key behaviors

| Behavior | Mechanism |
|---|---|
| Server error visible after submit | `setError('fieldName', { type: 'server', message })` |
| Error clears when user edits field | `clearErrors('fieldName')` in register's `onChange` |
| First errored field gets focus | `shouldFocus: true` in setError options |
| Form-level error (non-field) | `setError('root', ...)` → `errors.root.message` |
| Error survives re-render | setError persists until clearErrors or reset |
| Error cleared before re-submit | `clearErrors('root')` at start of onSubmit |

## Accessibility notes

- `aria-invalid={!!errors.email}` — screen readers announce the field as invalid
- `aria-describedby="email-error"` — links the error paragraph to the field
- `noValidate` on form — disables browser native validation which would conflict with RHF
- `role="alert"` on root error — announces immediately to screen readers
