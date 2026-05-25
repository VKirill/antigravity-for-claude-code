# Zod + React Hook Form

## Setup

```bash
npm install react-hook-form zod @hookform/resolvers
```

## Basic form

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const LoginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginInput = z.infer<typeof LoginSchema>;

export function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: LoginInput) {
    // data is typed and validated — safe to use
    await authService.login(data);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("email")} type="email" />
      {errors.email && <p>{errors.email.message}</p>}

      <input {...register("password")} type="password" />
      {errors.password && <p>{errors.password.message}</p>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}
```

## Nested object fields

```tsx
const AddressSchema = z.object({
  billing: z.object({
    street: z.string().min(1, "Street is required"),
    city: z.string().min(1, "City is required"),
    zip: z.string().regex(/^\d{5}$/, "Enter a 5-digit ZIP code"),
  }),
});

type Address = z.infer<typeof AddressSchema>;

// In the form:
<input {...register("billing.street")} />
{errors.billing?.street && <p>{errors.billing.street.message}</p>}

<input {...register("billing.city")} />
{errors.billing?.city && <p>{errors.billing.city.message}</p>}
```

## Dynamic array fields (useFieldArray)

```tsx
import { useForm, useFieldArray } from "react-hook-form";

const OrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.coerce.number().int().min(1),
  })).min(1, "Add at least one item"),
});

type Order = z.infer<typeof OrderSchema>;

function OrderForm() {
  const { register, control, handleSubmit, formState: { errors } } = useForm<Order>({
    resolver: zodResolver(OrderSchema),
    defaultValues: { items: [{ productId: "", quantity: 1 }] },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  return (
    <form onSubmit={handleSubmit(console.log)}>
      {fields.map((field, index) => (
        <div key={field.id}>
          <input {...register(`items.${index}.productId`)} placeholder="Product ID" />
          {errors.items?.[index]?.productId && (
            <p>{errors.items[index].productId.message}</p>
          )}

          <input {...register(`items.${index}.quantity`)} type="number" />
          {errors.items?.[index]?.quantity && (
            <p>{errors.items[index].quantity.message}</p>
          )}

          <button type="button" onClick={() => remove(index)}>Remove</button>
        </div>
      ))}

      <button type="button" onClick={() => append({ productId: "", quantity: 1 })}>
        Add item
      </button>

      {errors.items?.root && <p>{errors.items.root.message}</p>}
      {errors.items?.message && <p>{errors.items.message}</p>}

      <button type="submit">Submit</button>
    </form>
  );
}
```

## Controller for custom/third-party inputs

Use `Controller` when the input component doesn't expose a native ref (e.g., date pickers, select libraries, shadcn/ui Select):

```tsx
import { Controller } from "react-hook-form";

const ProfileSchema = z.object({
  role: z.enum(["admin", "user", "guest"]),
  birthDate: z.date({ required_error: "Birth date is required" }),
});

function ProfileForm() {
  const { control, handleSubmit, formState: { errors } } = useForm<z.infer<typeof ProfileSchema>>({
    resolver: zodResolver(ProfileSchema),
  });

  return (
    <form onSubmit={handleSubmit(console.log)}>
      <Controller
        name="role"
        control={control}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="guest">Guest</SelectItem>
            </SelectContent>
          </Select>
        )}
      />
      {errors.role && <p>{errors.role.message}</p>}
    </form>
  );
}
```

## Cross-field validation (password confirmation)

```tsx
const RegisterSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  }
);

type Register = z.infer<typeof RegisterSchema>;

// Access the cross-field error:
{errors.confirmPassword && <p>{errors.confirmPassword.message}</p>}

// Root-level errors from .refine() without path:
{errors.root && <p>{errors.root.message}</p>}
```

## FormProvider for shared context (multi-section forms)

```tsx
import { FormProvider, useForm, useFormContext } from "react-hook-form";

const FullFormSchema = z.object({
  personal: z.object({ name: z.string(), email: z.email() }),
  address: z.object({ street: z.string(), city: z.string() }),
});

type FullForm = z.infer<typeof FullFormSchema>;

function PersonalSection() {
  const { register, formState: { errors } } = useFormContext<FullForm>();
  return (
    <>
      <input {...register("personal.name")} />
      {errors.personal?.name && <p>{errors.personal.name.message}</p>}
    </>
  );
}

function FullForm() {
  const methods = useForm<FullForm>({ resolver: zodResolver(FullFormSchema) });
  
  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(console.log)}>
        <PersonalSection />
        {/* AddressSection, etc. */}
        <button type="submit">Submit</button>
      </form>
    </FormProvider>
  );
}
```

## Server-side validation errors (React 19 / Next.js Server Actions)

When server returns validation errors, merge into form errors with `setError`:

```tsx
const { setError, handleSubmit } = useForm<LoginInput>({
  resolver: zodResolver(LoginSchema),
});

async function onSubmit(data: LoginInput) {
  const result = await serverAction(data);
  
  if (result?.errors) {
    // result.errors is fieldErrors from ZodError.flatten().fieldErrors
    for (const [field, messages] of Object.entries(result.errors)) {
      setError(field as keyof LoginInput, {
        type: "server",
        message: Array.isArray(messages) ? messages[0] : messages,
      });
    }
  }
}
```

## Async validation in zodResolver

`zodResolver` automatically detects async schemas and calls `.safeParseAsync()`:

```tsx
const UniqueEmailSchema = z.object({
  email: z.email().refineAsync(async (email) => {
    const exists = await checkEmailExists(email);
    return !exists;
  }, "Email already registered"),
});

// useForm with zodResolver handles async automatically:
const { ... } = useForm({ resolver: zodResolver(UniqueEmailSchema) });
```

**Note:** Async validation on a field runs on each validation trigger (onChange, onBlur, onSubmit). Debounce if calling an API:

```ts
const debouncedCheck = useMemo(
  () => debounce(async (email: string) => {
    return !(await checkEmailExists(email));
  }, 300),
  []
);

const UniqueEmailSchema = z.object({
  email: z.email().refineAsync(debouncedCheck, "Email already registered"),
});
```

## Coerce for numeric inputs

HTML inputs always return strings. Use `z.coerce.number()` to avoid manual conversion:

```tsx
const PriceSchema = z.object({
  price: z.coerce.number().positive("Price must be positive"),
  quantity: z.coerce.number().int().min(1),
});

// register the field as-is — coerce handles the string → number conversion
<input {...register("price")} type="number" />
```

## Common gotchas

1. **Missing `type="submit"` on button** — RHF won't intercept clicks without it.
2. **`defaultValues` not matching Zod schema shape** — causes uncontrolled→controlled warnings. Always provide defaults for all required fields.
3. **`z.coerce` with Controller** — `Controller`'s `field.value` is typed from the schema output type. If using `z.coerce.number()`, `field.value` is `number` but the input needs a string. Convert explicitly: `value={String(field.value ?? "")}`.
4. **Cross-field errors with `path: []`** — errors without `path` appear at `errors.root`, not at a field. Access with `errors.root?.message`.
5. **Async refinements and `mode: "onChange"`** — async validation on every keystroke is expensive. Prefer `mode: "onBlur"` or `mode: "onSubmit"` for async.
