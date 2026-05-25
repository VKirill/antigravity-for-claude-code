# react-hook-form — Recommended Defaults

Canonical `useForm` knob values. Override only with a reason.

## `useForm` baseline

```ts
const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
  defaultValues: {
    // ALWAYS supply complete defaults — required for isDirty,
    // controlled/uncontrolled stability, and reset semantics
    name: '',
    email: '',
    bio: '',
  },
  mode: 'onBlur',                // validate after blur, not every keystroke
  reValidateMode: 'onChange',    // after first submit, re-validate as user types
  shouldUnregister: false,       // keep field values when component unmounts
  shouldUseNativeValidation: false,
  criteriaMode: 'firstError',    // stop at first failure per field
})
```

## `mode` choice

| mode | Validation runs | Use case |
|---|---|---|
| `onSubmit` (default) | only on submit | simple forms, low feedback need |
| `onBlur` ⭐ | after field loses focus | most production forms — balanced UX |
| `onChange` | every keystroke | live filters, password strength meters |
| `onTouched` | first blur, then onChange | mid-engagement forms |
| `all` | onChange + onBlur | rare; usually overkill |

**Default recommendation:** `mode: 'onBlur'`, `reValidateMode: 'onChange'`. Users get unintrusive validation; once they've tried to submit, errors clear as they type.

## `criteriaMode`

| Value | Behavior |
|---|---|
| `firstError` (default) | one error per field — minimal noise |
| `all` | all errors per field — useful for password rules ("min 8 chars, 1 number, 1 symbol") |

## `shouldUnregister`

- **Default (`false`)** — unmounted fields keep their values. Correct for multi-step forms and conditional fields you want to preserve.
- **`true`** — unmounted fields are wiped. Only use when you genuinely want unmounted state gone (e.g., a privacy-sensitive sub-form).

## `defaultValues` discipline

Always supply a complete object. Avoid `undefined` for any field — it causes controlled/uncontrolled React warnings on inputs.

```ts
// Wrong
defaultValues: { email: undefined }   // warning on first render

// Right
defaultValues: { email: '' }          // explicit empty string
```

For optional fields in Zod schema use `z.string().optional()` plus an empty-string default; transform in the schema if you need `undefined` downstream.

## `Controller` defaults

```tsx
<Controller
  name="country"
  control={control}
  defaultValue=""                  // explicit; matches form defaultValues
  rules={{}}                        // empty — let zodResolver own validation
  render={({ field, fieldState }) => (
    <Select {...field} aria-invalid={!!fieldState.error}>
      ...
    </Select>
  )}
/>
```

NEVER add `rules: { required: true }` when a `zodResolver` is in use — duplicate validation, conflicting messages.

## `useFieldArray` defaults

```ts
const { fields, append, remove } = useFieldArray({
  control,
  name: 'items',
  // keyName: 'id'  // RHF generates field.id automatically — leave default
})

// In JSX — ALWAYS field.id as React key, NEVER index
{fields.map((field, index) => (
  <Row key={field.id} index={index} />
))}
```

## Tuning ranges

| Knob | Default | Override when |
|---|---|---|
| `mode` | `onBlur` | live preview UIs → `onChange`; minimal forms → `onSubmit` |
| `reValidateMode` | `onChange` | rarely change |
| `shouldUnregister` | `false` | privacy-sensitive sub-forms → `true` |
| `criteriaMode` | `firstError` | password-strength UI → `all` |
| `delayError` | not set | spammy live validation → e.g. `300` ms |

## See also

- [basics-register.md](basics-register.md) — full `useForm` and `register` API
- [controller-and-context.md](controller-and-context.md) — Controller integration
- [zod-resolver.md](zod-resolver.md) — schema-based validation
- [troubleshooting.md](troubleshooting.md) — when defaults misbehave
