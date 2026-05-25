# react-hook-form — Troubleshooting

Symptom-indexed.

## `register` inside `Controller`

**Symptom:** Field doesn't update, or onChange fires twice, or value is always empty.

**Cause:** Mixing `register` (uncontrolled) with `Controller` (controlled) for the same field.

**Fix:** Pick one — `Controller` for any non-native input (Select, Checkbox, DatePicker, shadcn components); `register` for native `<input>`, `<textarea>`, native `<select>`.

```tsx
// ❌ Wrong
<Controller name="country" control={control} render={({ field }) => (
  <Select {...register('country')} {...field} />   // double-bound
)}/>

// ✅ Right
<Controller name="country" control={control} render={({ field }) => (
  <Select {...field} />                            // field handles value + onChange
)}/>
```

## `defaultValues` lost on first render

**Symptom:** Form fields render blank despite `defaultValues` in `useForm`.

**Causes:**
1. `defaultValues` is an async-fetched value passed before it resolved (e.g., `defaultValues: data?.user`)
2. Calling `reset()` with no args after data loads — resets back to original defaultValues which were also undefined
3. Field is `Controller` without `defaultValue` prop and the form's `defaultValues` doesn't have that key

**Fix:**
- For async defaults, gate the form render until data is loaded, OR call `reset(data)` once data arrives
- Always include EVERY field in `defaultValues` even if value is `''`

```tsx
const { data } = useQuery(...)

useEffect(() => {
  if (data) form.reset(data)
}, [data])
```

## Validation runs but errors don't show

**Symptom:** `formState.errors.fieldName` populates but `<FormMessage>` or `<p>{errors.fieldName?.message}</p>` shows nothing.

**Causes:**
1. Reading `errors` outside the rendered component scope (stale snapshot)
2. Custom error component receiving `error` prop but reading `error.message` when error is a string
3. shadcn `<FormField>` not wrapping the input — ARIA wiring broken

**Fix:** Destructure `formState` inside the component that renders the message:
```tsx
const { formState: { errors } } = form
return <p>{errors.email?.message}</p>
```

## `isSubmitting` stays `true` after submit

**Symptom:** Submit button stays disabled forever.

**Cause:** `handleSubmit(onSubmit)` callback is NOT async, but `onSubmit` makes an async call without `await`.

**Fix:**
```tsx
// Wrong — RHF doesn't know to wait
const onSubmit = (data) => {
  fetch('/api', { ... })   // unhandled promise
}

// Right — async callback
const onSubmit = async (data) => {
  await fetch('/api', { ... })
}
```

## `isValid` is `false` on mount

**Symptom:** Wanted to disable submit button based on `isValid` but it's `false` even with valid initial values.

**Cause:** `isValid` is `false` until the form has been validated at least once. In default `mode: 'onSubmit'`, validation never runs on mount.

**Fix:**
- Switch to `mode: 'onChange'` or `mode: 'onBlur'` for live `isValid`
- Or call `form.trigger()` once in `useEffect` on mount

```ts
useEffect(() => { form.trigger() }, [])
```

## `watch()` causes constant re-renders

**Symptom:** Form is slow; profiler shows the root component re-renders on every keystroke.

**Cause:** Calling `watch()` with no args subscribes to ALL field changes.

**Fix:** Subscribe selectively:
```ts
// Wrong
const values = watch()                  // subscribes to everything

// Right — only the fields you need
const email = watch('email')

// Better — in child components, use useWatch (subscription-based, doesn't re-render root)
const email = useWatch({ control, name: 'email' })
```

## `useFieldArray` rows re-render incorrectly

**Symptom:** After removing or reordering a row, inputs show wrong values or lose focus.

**Cause:** Using array `index` as React key instead of `field.id`.

**Fix:**
```tsx
{fields.map((field, index) => (
  <Row key={field.id} index={index} />   // field.id is RHF-stable
))}
```

## Server validation errors don't show

**Symptom:** API returns 422 with field errors; called `setError` but UI shows nothing.

**Causes:**
1. `setError` field name doesn't match form path (e.g., `setError('users.email', ...)` vs `'email'`)
2. Form `mode` is `onChange` and the user typed, triggering re-validation which cleared the server error
3. Error message is missing — `setError('email', { type: 'server' })` without `message`

**Fix:**
```ts
setError('email', { type: 'server', message: 'Email already in use' })

// To prevent clearing on next keystroke, use:
setError('email', { type: 'server', message: '...' }, { shouldFocus: true })
```

## Form submits with stale values

**Symptom:** `onSubmit(data)` receives values from before the user's last edit.

**Cause:** Reading values from `getValues()` outside the submit callback, or from a stale `watch()` snapshot.

**Fix:** Use the `data` argument from `handleSubmit(onSubmit)` — it's the canonical snapshot at submit time.

## See also

- [basics-register.md](basics-register.md), [controller-and-context.md](controller-and-context.md), [recommended-defaults.md](recommended-defaults.md), [wrong-vs-right.md](wrong-vs-right.md)
