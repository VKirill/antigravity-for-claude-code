# Zod 4 — Error Handling

## .parse() vs .safeParse()

| Method | On success | On failure | When to use |
|---|---|---|---|
| `.parse(data)` | Returns typed data | Throws `ZodError` | Internal, trusted code; errors should crash |
| `.safeParse(data)` | `{ success: true, data }` | `{ success: false, error: ZodError }` | HTTP handlers, form validation — always preferred |
| `.parseAsync(data)` | Promise resolves with data | Promise rejects with `ZodError` | Any schema with async refinements |
| `.safeParseAsync(data)` | `Promise<{ success: true, data }>` | `Promise<{ success: false, error }>` | Async refinements in HTTP handlers |

## Handling safeParse results

```ts
const result = UserSchema.safeParse(rawBody);

if (!result.success) {
  // result.error is ZodError
  return res.status(400).json({
    error: "Validation failed",
    issues: result.error.issues,
  });
}

// result.data is typed as User
const user = result.data;
```

**Type narrowing:** After `if (!result.success)`, TypeScript knows `result.error` is `ZodError`. After passing the guard, `result.data` is typed.

## ZodError structure

```ts
result.error.issues
// ZodIssue[] — array of all validation failures

// Each ZodIssue has:
interface ZodIssue {
  code: ZodIssueCode;          // "invalid_type", "too_small", "custom", etc.
  message: string;             // human-readable message
  path: (string | number)[];   // field path: ["user", "address", "zipCode"]
  // additional fields per code...
}
```

**Common issue codes:**

| Code | When | Extra fields |
|---|---|---|
| `invalid_type` | Wrong JS type | `expected`, `received` |
| `too_small` | Below min | `minimum`, `inclusive`, `type` |
| `too_big` | Above max | `maximum`, `inclusive`, `type` |
| `invalid_string` | String constraint fails | `validation` |
| `invalid_enum_value` | Not in enum | `options`, `received` |
| `invalid_union` | No branch matched | `unionErrors` |
| `invalid_union_discriminator` | Bad discriminator value | `options` |
| `custom` | `.refine()` / `.superRefine()` | (whatever you add) |

## ZodError.flatten()

Converts the issues array into a structured object:

```ts
const result = UserSchema.safeParse(rawBody);
if (!result.success) {
  const flat = result.error.flatten();
  /*
  flat.formErrors: string[]        — root-level errors (no path)
  flat.fieldErrors: {              — per-field error arrays
    email?: string[];
    name?: string[];
    ...
  }
  */
}
```

**With generic type:**

```ts
const flat = result.error.flatten(
  (issue) => issue.message  // transform each ZodIssue — default is message string
);

// Custom transformer
const flat = result.error.flatten((issue) => ({
  message: issue.message,
  code: issue.code,
}));
```

## ZodError.format()

Deprecated in Zod 4. Use `.flatten()` instead. If you see code using `.format()`, replace with `.flatten()`.

```ts
// Zod 3 (deprecated):
result.error.format()
// { _errors: [...], email: { _errors: [...] } }

// Zod 4 preferred:
result.error.flatten()
// { formErrors: [...], fieldErrors: { email: [...] } }
```

## Accessing the first error per field

Common pattern for REST API error responses:

```ts
function formatErrors(error: z.ZodError): Record<string, string> {
  const flat = error.flatten();
  const fieldErrors: Record<string, string> = {};
  
  for (const [field, messages] of Object.entries(flat.fieldErrors)) {
    if (messages && messages.length > 0) {
      fieldErrors[field] = messages[0]; // first error per field
    }
  }
  
  // Include form-level errors under a special key
  if (flat.formErrors.length > 0) {
    fieldErrors._form = flat.formErrors[0];
  }
  
  return fieldErrors;
}
```

## Error path for nested schemas

```ts
const OrderSchema = z.object({
  user: z.object({
    email: z.email(),
  }),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
  })),
});

const result = OrderSchema.safeParse({
  user: { email: "not-an-email" },
  items: [{ productId: "abc", quantity: -1 }],
});

// issue paths:
// ["user", "email"]         — nested object
// ["items", 0, "quantity"]  — array index + field
```

## Custom error messages

**Per constraint:**
```ts
z.string().min(1, "Name is required")
z.number().max(100, { message: "Value must not exceed 100" })
z.email({ message: "Please enter a valid email address" })
```

**Per schema (errorMap):**
```ts
z.number({
  required_error: "Age is required",    // when field is missing entirely
  invalid_type_error: "Age must be a number",
})
```

**Global error map:**
```ts
z.setErrorMap((issue, ctx) => {
  if (issue.code === "invalid_type" && issue.expected === "string") {
    return { message: "This field must be text" };
  }
  return { message: ctx.defaultError };
});
```

## Catching ZodError in frameworks

### Express / Hono request handler pattern

```ts
async function createUser(req: Request, res: Response) {
  const result = CreateUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      status: "error",
      code: "VALIDATION_ERROR",
      details: result.error.flatten().fieldErrors,
    });
  }
  // result.data is typed and safe
  const user = await userService.create(result.data);
  res.json(user);
}
```

### Next.js Server Action pattern

```ts
async function createUserAction(formData: FormData) {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
  };

  const result = CreateUserSchema.safeParse(raw);
  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
    };
  }

  await userService.create(result.data);
  redirect("/users");
}
```

### Global error handler (Express)

```ts
import { ZodError } from "zod";

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(422).json({
      status: "error",
      code: "VALIDATION_ERROR",
      details: err.flatten().fieldErrors,
    });
  }
  next(err);
});
```

## instanceof ZodError

```ts
import { ZodError } from "zod";

try {
  const data = UserSchema.parse(input);
} catch (err) {
  if (err instanceof ZodError) {
    console.log(err.issues);    // structured issues array
    console.log(err.flatten()); // flat field errors
    console.log(err.message);   // JSON string of all issues
  }
  throw err;
}
```

## Checking for specific issue types

```ts
if (!result.success) {
  const missingFields = result.error.issues
    .filter(i => i.code === "invalid_type" && i.received === "undefined")
    .map(i => i.path.join("."));
  
  console.log("Missing required fields:", missingFields);
}
```

## Error in arrays and unions

**Array errors:** path includes the numeric index `["items", 2, "name"]`.

**Union errors:** `issue.code === "invalid_union"` — `issue.unionErrors` is an array of `ZodError` for each branch that failed. Use for debugging which branch got closest to matching.

**Discriminated union errors:** `issue.code === "invalid_union_discriminator"` — `issue.options` is the array of valid discriminator values.
