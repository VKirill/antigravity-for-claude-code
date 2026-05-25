# shadcn/ui — Form Integration

## Architecture

shadcn's `<Form>` component is a thin wrapper around React Hook Form that:
1. Provides a `FormFieldContext` to auto-wire `id`, `aria-describedby`, and `aria-invalid` between `FormLabel`, `FormControl`, and `FormMessage`
2. Uses `Controller` internally so controlled components (Select, Checkbox, Switch) work without `register()`
3. Integrates `FormDescription` for help text that's automatically linked via `aria-describedby`

## Required packages

```bash
npx shadcn add form input label textarea select checkbox switch
npm install @hookform/resolvers zod
```

## The standard form stack

```tsx
"use client"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const formSchema = z.object({
  username: z.string().min(2, "Username must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
})

type FormValues = z.infer<typeof formSchema>

export function ProfileForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { username: "", email: "" },
  })

  async function onSubmit(values: FormValues) {
    // values is fully typed and validated
    console.log(values)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="johndoe" {...field} />
              </FormControl>
              <FormDescription>This is your public display name.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="john@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving..." : "Save changes"}
        </Button>
      </form>
    </Form>
  )
}
```

## Component roles

| Component | Role | Notes |
|---|---|---|
| `<Form>` | Provides RHF context | Wraps the `<form>` element |
| `<FormField>` | Connects one field to RHF `control` | Uses `Controller` internally |
| `<FormItem>` | Layout container | Adds `flex flex-col space-y-2` |
| `<FormLabel>` | Label with automatic `htmlFor` | Inherits `id` from FormFieldContext |
| `<FormControl>` | Injects `id`, `aria-describedby`, `aria-invalid` | MUST wrap the input — omitting breaks ARIA |
| `<FormDescription>` | Help text | Auto-linked via `aria-describedby` |
| `<FormMessage>` | Validation error display | Shows `field.error.message` from Zod |

## Controlled components (Select, Checkbox, Switch, Radio)

Controlled components cannot use `register()` — they need the `field` object from `FormField.render`:

### Select

```tsx
<FormField
  control={form.control}
  name="role"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Role</FormLabel>
      <Select onValueChange={field.onChange} defaultValue={field.value}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Select a role" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="user">User</SelectItem>
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Checkbox

```tsx
<FormField
  control={form.control}
  name="acceptTerms"
  render={({ field }) => (
    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
      <FormControl>
        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
      </FormControl>
      <div className="space-y-1 leading-none">
        <FormLabel>Accept terms and conditions</FormLabel>
        <FormMessage />
      </div>
    </FormItem>
  )}
/>
```

### Switch

```tsx
<FormField
  control={form.control}
  name="notifications"
  render={({ field }) => (
    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
      <div className="space-y-0.5">
        <FormLabel>Email notifications</FormLabel>
        <FormDescription>Receive emails about activity.</FormDescription>
      </div>
      <FormControl>
        <Switch checked={field.value} onCheckedChange={field.onChange} />
      </FormControl>
    </FormItem>
  )}
/>
```

## Server Actions (Next.js App Router)

```tsx
"use client"
import { useActionState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createUser } from "@/app/actions" // server action

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
})

export function CreateUserForm() {
  const form = useForm({ resolver: zodResolver(schema) })

  async function onSubmit(values: z.infer<typeof schema>) {
    const result = await createUser(values)
    if (!result.success) {
      form.setError("email", { message: result.error })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* fields */}
      </form>
    </Form>
  )
}
```

## Dynamic fields with useFieldArray

```tsx
const { fields, append, remove } = useFieldArray({
  control: form.control,
  name: "items",
})

// In JSX:
{fields.map((field, index) => (
  <FormField
    key={field.id}
    control={form.control}
    name={`items.${index}.value`}
    render={({ field }) => (
      <FormItem>
        <FormControl>
          <Input {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
))}
<Button type="button" onClick={() => append({ value: "" })}>Add item</Button>
```

## Zod schema patterns for forms

```ts
// Optional field
z.string().optional()

// Nullable with empty string coercion
z.string().transform(v => v || null).nullable()

// Number from input (inputs return strings)
z.coerce.number().min(0).max(100)

// Enum with error message
z.enum(["admin", "user", "guest"], { message: "Select a valid role" })

// Conditional field (dependent on another)
z.discriminatedUnion("type", [
  z.object({ type: z.literal("email"), email: z.string().email() }),
  z.object({ type: z.literal("phone"), phone: z.string().min(10) }),
])

// Date from string input
z.string().pipe(z.coerce.date())

// Custom refinement (cross-field validation)
z.object({
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})
```

## Common mistakes

**Omitting `<FormControl>`**: `FormMessage` and `FormLabel` won't find the field id — labels won't click-focus the input, errors won't be announced by screen readers.

**Using `register()` with controlled components**: `<Select>`, `<Checkbox>`, `<Switch>` need `field.onChange` / `field.value` via the `render` prop. `register()` only works for inputs that fire native DOM events.

**Not spreading `field` onto Input**: `{...field}` sets `value`, `onChange`, `onBlur`, `name`, `ref`. Omitting any of these breaks RHF tracking.

**Using `defaultValues: undefined`**: Always provide `defaultValues` with empty strings / false / null for all fields. RHF treats missing defaults as uncontrolled → controlled transitions that cause React warnings.
