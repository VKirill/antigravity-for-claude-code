# react-hook-form — Wrong vs Right

Pattern pairs.

## 1. `register` for custom inputs vs `Controller`

```tsx
// ❌ Wrong — register on a controlled UI component
<Select {...register('country')} />
// Select needs `value` + `onChange` — register provides `name`, `ref`, `onChange`, `onBlur`
// but no `value` prop. Form data won't sync.

// ✅ Right — Controller bridges uncontrolled RHF with controlled UI
<Controller
  name="country"
  control={control}
  render={({ field }) => <Select {...field} />}
/>
```

Rule: `register` for native `<input>`/`<textarea>`; `Controller` for everything else.

## 2. Index vs `field.id` in `useFieldArray`

```tsx
// ❌ Wrong — index as key breaks reorder/remove
{fields.map((field, index) => (
  <Row key={index} index={index} />
))}

// ✅ Right — field.id is RHF-stable across reorders
{fields.map((field, index) => (
  <Row key={field.id} index={index} />
))}
```

## 3. Duplicate validation — `register` constraints + Zod resolver

```tsx
// ❌ Wrong — Zod runs first, register constraint never matches
<input {...register('email', { required: 'Required' })} />
// Schema: z.string().email() with its own messages

// ✅ Right — Zod owns validation when resolver is set
<input {...register('email')} />
// All rules and messages live in the schema
```

## 4. Missing `defaultValues`

```ts
// ❌ Wrong — isDirty broken, controlled/uncontrolled warnings
useForm<FormData>({ resolver: zodResolver(schema) })

// ✅ Right — complete defaults for every field
useForm<FormData>({
  resolver: zodResolver(schema),
  defaultValues: { email: '', name: '', age: 0 },
})
```

For async-fetched defaults: render skeleton until loaded, then `form.reset(data)`.

## 5. `watch()` everywhere vs scoped `useWatch`

```tsx
// ❌ Wrong — root re-renders on every keystroke of any field
function BigForm() {
  const { watch } = useForm()
  const allValues = watch()
  return <ChildA values={allValues} />
}

// ✅ Right — child subscribes only to the field it cares about
function FieldDisplay({ control }) {
  const email = useWatch({ control, name: 'email' })
  return <span>{email}</span>
}
```

## 6. Sync `onSubmit` with async work

```tsx
// ❌ Wrong — isSubmitting flickers, errors not caught
<form onSubmit={handleSubmit((data) => {
  fetch('/api', { method: 'POST', body: JSON.stringify(data) })   // unhandled promise
})}>

// ✅ Right — async callback gives RHF the lifecycle
<form onSubmit={handleSubmit(async (data) => {
  try {
    await fetch('/api', { method: 'POST', body: JSON.stringify(data) })
  } catch (err) {
    setError('root', { message: 'Network error' })
  }
})}>
```

## 7. Server errors — manual state vs `setError`

```tsx
// ❌ Wrong — separate state, not integrated with formState
const [serverError, setServerError] = useState<string | null>(null)
const onSubmit = async (data) => {
  const res = await api(data)
  if (!res.ok) setServerError('Email taken')
}

// ✅ Right — setError merges into formState, plays with FormMessage
const onSubmit = async (data) => {
  const res = await api(data)
  if (res.status === 422) {
    setError('email', { type: 'server', message: 'Email taken' })
  } else if (!res.ok) {
    setError('root', { message: 'Server error' })
  }
}
```

## 8. Prop drilling vs `FormProvider`

```tsx
// ❌ Wrong — drilling control/register through every layer
<Form>
  <Section control={control} register={register} formState={formState}>
    <Field control={control} register={register} />
  </Section>
</Form>

// ✅ Right — FormProvider + useFormContext
<FormProvider {...form}>
  <Section>
    <Field />
  </Section>
</FormProvider>

function Field() {
  const { register } = useFormContext<FormData>()
  return <input {...register('email')} />
}
```

## See also

- [basics-register.md](basics-register.md), [controller-and-context.md](controller-and-context.md), [field-array.md](field-array.md), [server-validation.md](server-validation.md), [troubleshooting.md](troubleshooting.md)
