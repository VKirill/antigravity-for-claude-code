# react-hook-form — Reference Index

React Hook Form v8 + Zod resolver. Decision map: open only what you need.

## Decision map

| Situation | Open this file |
|---|---|
| Set up useForm, register a field, read errors, handle submit | [basics-register.md](basics-register.md) |
| Use shadcn/ui Select/Checkbox/DatePicker with RHF | [controller-and-context.md](controller-and-context.md) |
| Share form state across deeply nested components | [controller-and-context.md](controller-and-context.md) |
| Dynamic add/remove fields (todo lists, line items, tags) | [field-array.md](field-array.md) |
| Integrate Zod schema, async refinements, union types | [zod-resolver.md](zod-resolver.md) |
| Wizard / checkout flow with per-step validation | [multi-step-forms.md](multi-step-forms.md) |
| Merge 422 API errors into formState after submission | [server-validation.md](server-validation.md) |
| Skill routing tests (positive / negative / edge) | [eval-cases.md](eval-cases.md) |

## Quick-lookup cheat sheet

### Core return values from useForm

| Return | Purpose |
|---|---|
| `register(name, opts?)` | Binds native inputs |
| `control` | Required prop for Controller / useFieldArray |
| `handleSubmit(onValid, onInvalid?)` | Wraps submit handler, manages isSubmitting |
| `formState.errors` | Nested error object, proxy-subscribed |
| `formState.isSubmitting` | true while async submit handler is pending |
| `formState.isDirty` | true if any field differs from defaultValues |
| `formState.isValid` | true after first validation pass with no errors |
| `watch(name?)` | Returns live value, re-renders on change |
| `setValue(name, value, opts?)` | Programmatically set a field value |
| `getValues(name?)` | Read value without subscribing to changes |
| `trigger(name?)` | Programmatically run validation |
| `reset(values?)` | Reset to defaultValues or new values |
| `setError(name, error)` | Inject external error (e.g., server) |
| `clearErrors(name?)` | Remove injected or validation errors |

### @hookform/resolvers/zod

```ts
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({ email: z.string().email() })
type Schema = z.infer<typeof schema>

const form = useForm<Schema>({
  resolver: zodResolver(schema),
  defaultValues: { email: '' },
})
```

### Common error patterns

| Pattern | Cause | Fix |
|---|---|---|
| `isValid` starts false | Not yet validated | Use `mode: 'onChange'` or call `trigger()` |
| Controlled-to-uncontrolled warning | Missing `defaultValues` | Always provide `defaultValues` |
| Field value lost on nav | `shouldUnregister: true` | Set `shouldUnregister: false` (default) |
| Array key flicker | Using index as React key | Use `field.id` from useFieldArray |
| Double-submit | No `isSubmitting` guard | Disable button when `isSubmitting` |
