# Controller, FormProvider, and useFormContext

## When to use Controller

Use `Controller` when the input component:
- Does not forward refs (cannot spread `register` onto it)
- Has a controlled API (`value` + `onChange` props) rather than uncontrolled (native `ref`)
- Is a third-party component: shadcn/ui Select, Checkbox, Switch, DatePicker, Slider, etc.

Native HTML inputs (`<input>`, `<textarea>`, `<select>`) work with `register` directly — no Controller needed.

## Controller — basic pattern

```tsx
import { Controller, useForm } from 'react-hook-form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

function MyForm() {
  const { control, handleSubmit } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'viewer' },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Controller
        name="role"
        control={control}
        render={({ field, fieldState }) => (
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <SelectTrigger ref={field.ref}>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
          // fieldState.error gives the error for this specific field
          {fieldState.error && <p>{fieldState.error.message}</p>}
        )}
      />
    </form>
  )
}
```

### field object from Controller

```ts
field.name    // field name string (same as `name` prop)
field.value   // current value (RHF-managed)
field.onChange // function — call when value changes
field.onBlur  // function — call when control loses focus
field.ref     // pass to the focusable element for error focusing
```

Spread `field` onto the component when its props are compatible: `{...field}`. When the component API differs (e.g., `onValueChange` vs `onChange`), wire manually as shown above.

## Controller — Checkbox with boolean

```tsx
<Controller
  name="acceptTerms"
  control={control}
  render={({ field }) => (
    <Checkbox
      checked={field.value}
      onCheckedChange={field.onChange}
      ref={field.ref}
    />
  )}
/>
```

## Controller — multiple checkboxes (array value)

```tsx
const PERMISSIONS = ['read', 'write', 'delete'] as const

<Controller
  name="permissions"
  control={control}
  render={({ field }) => (
    <div>
      {PERMISSIONS.map((perm) => (
        <Checkbox
          key={perm}
          checked={field.value?.includes(perm)}
          onCheckedChange={(checked) => {
            const updated = checked
              ? [...(field.value ?? []), perm]
              : field.value?.filter((v) => v !== perm)
            field.onChange(updated)
          }}
        />
      ))}
    </div>
  )}
/>
```

## shadcn/ui Form component integration

shadcn/ui ships a `Form` component built on top of RHF's `FormProvider`. The pattern:

```tsx
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage
} from '@/components/ui/form'

function ProfileForm() {
  const form = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { username: '' },
  })

  return (
    // Form wraps FormProvider — passes the form methods through context
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                {/* field is spread onto the input */}
                <Input placeholder="john_doe" {...field} />
              </FormControl>
              <FormDescription>Your public username.</FormDescription>
              <FormMessage /> {/* Renders errors.username.message automatically */}
            </FormItem>
          )}
        />
        <Button type="submit">Save</Button>
      </form>
    </Form>
  )
}
```

`FormField` is a thin wrapper around `Controller`. `FormMessage` reads the error from the nearest `FormField` context — no manual `errors.fieldName.message` needed.

## FormProvider — manual usage

Use `FormProvider` directly when NOT using shadcn/ui `Form`, or when building your own component library:

```tsx
import { FormProvider, useForm } from 'react-hook-form'

function CheckoutForm() {
  const methods = useForm<CheckoutSchema>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { ... },
  })

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <ShippingSection />
        <PaymentSection />
        <button type="submit">Place Order</button>
      </form>
    </FormProvider>
  )
}
```

`FormProvider` accepts the entire `methods` object (spread with `{...methods}`).

## useFormContext — child components

```tsx
import { useFormContext } from 'react-hook-form'

// Type the context to get full field inference
function ShippingSection() {
  const { register, formState: { errors }, control } = useFormContext<CheckoutSchema>()

  return (
    <fieldset>
      <input {...register('shipping.street')} />
      {errors.shipping?.street && <span>{errors.shipping.street.message}</span>}

      <Controller
        name="shipping.country"
        control={control}
        render={({ field }) => <CountrySelect {...field} />}
      />
    </fieldset>
  )
}
```

Always type `useFormContext<TSchema>()` — without the type parameter, returned `register` and `errors` lose their field-level types.

## Nested object fields

RHF supports nested paths via dot notation:

```tsx
// Schema
const schema = z.object({
  address: z.object({
    street: z.string(),
    city: z.string(),
  }),
})

// Register
<input {...register('address.street')} />
<input {...register('address.city')} />

// Errors
errors.address?.street?.message
errors.address?.city?.message
```

## useController — hook alternative to Controller

`useController` is the hook equivalent of `Controller`:

```tsx
import { useController } from 'react-hook-form'

function CustomInput({ name, control }: { name: keyof Schema; control: Control<Schema> }) {
  const {
    field,
    fieldState: { error },
    formState: { isSubmitting },
  } = useController({ name, control })

  return (
    <div>
      <input {...field} disabled={isSubmitting} />
      {error && <span>{error.message}</span>}
    </div>
  )
}
```

Use `useController` when building reusable input components that need access to both `field` and `fieldState`.
