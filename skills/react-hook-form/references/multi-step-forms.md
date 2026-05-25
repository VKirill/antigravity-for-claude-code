# Multi-Step Forms

## Strategy: single useForm + FormProvider

The recommended approach: one `useForm` at the root, all steps share the same form context via `FormProvider`. No state duplication, single submission.

```tsx
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { z } from 'zod'

const schema = z.object({
  // Step 1
  email: z.string().email(),
  name: z.string().min(2),
  // Step 2
  role: z.enum(['admin', 'editor', 'viewer']),
  department: z.string().min(1),
  // Step 3
  plan: z.enum(['free', 'pro', 'enterprise']),
  billingEmail: z.string().email(),
})
type Schema = z.infer<typeof schema>

// Step field map — which fields belong to each step
const STEP_FIELDS: Record<number, (keyof Schema)[]> = {
  1: ['email', 'name'],
  2: ['role', 'department'],
  3: ['plan', 'billingEmail'],
}

export function MultiStepForm() {
  const [step, setStep] = useState(1)
  const TOTAL_STEPS = 3

  const methods = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '', name: '',
      role: 'viewer', department: '',
      plan: 'free', billingEmail: '',
    },
    // shouldUnregister: false (default) — fields keep values when step unmounts
  })

  async function nextStep() {
    const valid = await methods.trigger(STEP_FIELDS[step])
    if (!valid) return
    setStep((s) => s + 1)
  }

  function prevStep() {
    setStep((s) => s - 1)
  }

  async function onSubmit(data: Schema) {
    await saveToApi(data)
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        {/* Progress indicator */}
        <StepIndicator current={step} total={TOTAL_STEPS} />

        {/* Render current step — DO NOT unmount previous steps if values must persist */}
        {step === 1 && <Step1 />}
        {step === 2 && <Step2 />}
        {step === 3 && <Step3 />}

        {/* Navigation */}
        <div>
          {step > 1 && (
            <button type="button" onClick={prevStep}>Back</button>
          )}
          {step < TOTAL_STEPS ? (
            <button type="button" onClick={nextStep}>Next</button>
          ) : (
            <button
              type="submit"
              disabled={methods.formState.isSubmitting}
            >
              {methods.formState.isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          )}
        </div>
      </form>
    </FormProvider>
  )
}
```

## Step components — useFormContext

```tsx
function Step1() {
  const { register, formState: { errors } } = useFormContext<Schema>()

  return (
    <fieldset>
      <legend>Account Info</legend>
      <label>
        Email
        <input {...register('email')} type="email" />
        {errors.email && <span>{errors.email.message}</span>}
      </label>
      <label>
        Name
        <input {...register('name')} />
        {errors.name && <span>{errors.name.message}</span>}
      </label>
    </fieldset>
  )
}
```

## Conditional rendering vs hidden fields

Two strategies for step visibility:

### Strategy A — Conditional render (recommended for most cases)

```tsx
{step === 1 && <Step1 />}
{step === 2 && <Step2 />}
```

Fields unmount on step change. Values are preserved because `shouldUnregister: false` (default). Performance benefit: only the active step's fields exist in the DOM.

### Strategy B — CSS hide (keep DOM alive)

```tsx
<div style={{ display: step === 1 ? 'block' : 'none' }}>
  <Step1 />
</div>
<div style={{ display: step === 2 ? 'block' : 'none' }}>
  <Step2 />
</div>
```

Use when: animations between steps, or you need all fields accessible to screen readers simultaneously. Higher DOM cost.

## Per-step validation with trigger

`trigger` runs validation for specific field names. Use the step's field list:

```ts
const valid = await trigger(['email', 'name'])
if (!valid) return  // Stay on current step

setStep((s) => s + 1)
```

`trigger` returns `true` only if all named fields pass. Errors appear in `formState.errors` as usual.

## Persisting step state to URL or localStorage

For multi-step flows where the user might navigate away:

```ts
// Persist current values to localStorage on step advance
async function nextStep() {
  const valid = await methods.trigger(STEP_FIELDS[step])
  if (!valid) return

  // Save partial state
  const values = methods.getValues()
  localStorage.setItem('checkout-draft', JSON.stringify(values))
  setStep((s) => s + 1)
}

// Restore on mount
useEffect(() => {
  const saved = localStorage.getItem('checkout-draft')
  if (saved) {
    try {
      methods.reset(JSON.parse(saved))
    } catch {}
  }
}, [])
```

## Multi-step with separate useForm instances (alternative)

When each step has a completely independent schema and you want strict step isolation:

```tsx
// Step 1 form
const step1Form = useForm<Step1Schema>({
  resolver: zodResolver(step1Schema),
  defaultValues: step1Defaults,
})

// Step 2 form
const step2Form = useForm<Step2Schema>({
  resolver: zodResolver(step2Schema),
  defaultValues: step2Defaults,
})

// Final step: merge values and submit
async function submitAll() {
  const step1Data = step1Form.getValues()
  const step2Data = step2Form.getValues()
  await saveToApi({ ...step1Data, ...step2Data })
}
```

Tradeoff: simpler per-step schemas, but cross-step validation (e.g., billing email must differ from account email) requires manual logic.

## Review step — display all values

```tsx
function ReviewStep() {
  const { getValues } = useFormContext<Schema>()
  const values = getValues()  // Read without subscribing

  return (
    <dl>
      <dt>Email</dt><dd>{values.email}</dd>
      <dt>Role</dt><dd>{values.role}</dd>
      <dt>Plan</dt><dd>{values.plan}</dd>
    </dl>
  )
}
```

`getValues()` with no args reads the entire form synchronously without triggering a re-render.

## Form summary — isSubmitSuccessful + reset after submit

```tsx
function MultiStepForm() {
  const methods = useForm<Schema>({ ... })

  if (methods.formState.isSubmitSuccessful) {
    return (
      <div>
        <p>Form submitted successfully!</p>
        <button
          type="button"
          onClick={() => {
            methods.reset()
            setStep(1)
          }}
        >
          Submit another
        </button>
      </div>
    )
  }

  return <form>...</form>
}
```

## TypeScript: step-safe field paths

For large schemas, type the step field lists to catch typos:

```ts
const STEP_FIELDS = {
  1: ['email', 'name'],
  2: ['role', 'department'],
  3: ['plan', 'billingEmail'],
} as const satisfies Record<number, readonly (keyof Schema)[]>
```

`satisfies` checks that all values are valid `keyof Schema` without widening the type.
