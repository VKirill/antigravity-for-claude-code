# Zod 4 — Transforms, Refinements, Pipe, Async

## .transform()

Converts the parsed value to a different type. Changes the output type of the schema.

```ts
// String → number
const NumberString = z.string().transform(Number);
type Out = z.infer<typeof NumberString>; // number

// String → trimmed string
const TrimmedString = z.string().transform(s => s.trim());

// Object → different shape
const RawUser = z.object({
  first_name: z.string(),
  last_name: z.string(),
});
const UserSchema = RawUser.transform(data => ({
  fullName: `${data.first_name} ${data.last_name}`,
}));
type User = z.infer<typeof UserSchema>; // { fullName: string }
```

**Transform vs. input type:** `z.infer<typeof schema>` gives the **output** type after transform. To get the input type:

```ts
z.input<typeof UserSchema>   // { first_name: string; last_name: string }
z.output<typeof UserSchema>  // { fullName: string }
```

## .refine()

Validates without changing the type. Returns the same type on success.

```ts
// Simple message string
const PositiveNumber = z.number().refine(n => n > 0, "Must be positive");

// Message object (with optional path for nested error)
const EvenNumber = z.number().refine(
  n => n % 2 === 0,
  { message: "Must be even" }
);

// Cross-field refinement on object
const PasswordSchema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine(
  data => data.password === data.confirmPassword,
  {
    message: "Passwords must match",
    path: ["confirmPassword"],  // which field shows the error
  }
);
```

**Refinement error placement:** The `path` option in the second argument points the error at a specific field. Without `path`, the error appears at the root level of the object.

## .superRefine()

More powerful than `.refine()` — can add multiple issues and access the full context:

```ts
const DateRangeSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
}).superRefine((data, ctx) => {
  if (data.endDate <= data.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "End date must be after start date",
      path: ["endDate"],
    });
  }
});

// Multiple issues
const RegistrationSchema = z.object({
  age: z.number(),
  country: z.string(),
}).superRefine((data, ctx) => {
  if (data.age < 18 && data.country === "US") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Must be 18+ in the US",
      path: ["age"],
    });
  }
  if (data.age < 16 && data.country === "EU") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Must be 16+ in the EU",
      path: ["age"],
    });
  }
});
```

**`ctx.addIssue()` codes:**

| Code | When to use |
|---|---|
| `z.ZodIssueCode.custom` | Custom validation logic (most common) |
| `z.ZodIssueCode.invalid_type` | Wrong JS type at runtime |
| `z.ZodIssueCode.too_small` / `too_big` | Numeric/string/array bounds |
| `z.ZodIssueCode.invalid_enum_value` | Enum mismatch |
| `z.ZodIssueCode.invalid_union` | None of the union branches matched |

## .pipe()

Chains two schemas — output of the first becomes input of the second. Most useful after `.transform()`:

```ts
// String → coerce to number → validate as positive integer
const PositiveIntString = z.string()
  .transform(Number)
  .pipe(z.number().int().positive());

// Parse ISO date string → validate the resulting Date
const FutureDateString = z.string()
  .transform(s => new Date(s))
  .pipe(z.date().min(new Date()));
```

**Difference from chaining `.transform().refine()`:** `.pipe()` applies a fully separate schema (with its own type), while `.refine()` stays on the same type. Use `.pipe()` when you need the second schema's type guards, constraints, or its own transform.

## Async refinements

When validation requires I/O (DB lookup, API call), use async refinements:

```ts
const UniqueEmailSchema = z.email().refineAsync(
  async (email) => {
    const exists = await db.user.findFirst({ where: { email } });
    return !exists;
  },
  { message: "Email already in use" }
);

// MUST use parseAsync — sync parse will throw
const result = await UniqueEmailSchema.safeParseAsync(input.email);
```

**Rule:** Any schema with an async refinement (anywhere in the chain, including nested objects) requires `.parseAsync()` / `.safeParseAsync()`. Calling `.parse()` on an async schema throws synchronously with an unhelpful error.

```ts
// Detecting if a schema is async
schema instanceof z.ZodEffects && schema._def.effect.type === "refinement"
// In practice: just always use safeParseAsync in request handlers that might have async refinements
```

## z.preprocess()

Transforms input **before** Zod's type checking. Use for coercion with conditional logic:

```ts
// Handle both string and number inputs for a number field
const FlexibleNumber = z.preprocess(
  (val) => {
    if (typeof val === "string") return Number(val);
    if (typeof val === "boolean") return val ? 1 : 0;
    return val;
  },
  z.number()
);

// Parse legacy API responses that may send booleans as "0"/"1"
const BooleanField = z.preprocess(
  (val) => {
    if (val === "0" || val === 0) return false;
    if (val === "1" || val === 1) return true;
    return val;
  },
  z.boolean()
);
```

**Preprocess vs. coerce vs. transform:**

| | When to use |
|---|---|
| `z.coerce.*` | Simple constructor-based coercion (String, Number, Boolean, Date) |
| `z.preprocess(fn, schema)` | Conditional coercion before type check |
| `.transform(fn)` | Change the output type after successful parse |

## Transform error propagation

Transforms that encounter invalid data should call `ctx.addIssue` to report errors, not throw:

```ts
const SafeJsonParse = z.string().transform((val, ctx) => {
  try {
    return JSON.parse(val);
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid JSON string",
    });
    return z.NEVER;  // sentinel — tells Zod to abort with the issued error
  }
});
```

`z.NEVER` is the correct sentinel return value inside transform error handlers — it has the type `never` and signals Zod to stop processing.

## Combining transforms and refinements

Order matters — transforms run first, then refinements on the transformed value:

```ts
const ProcessedName = z.string()
  .trim()                          // built-in string transform
  .toLowerCase()                   // built-in string transform
  .min(1, "Name required")         // constraint (still string type)
  .transform(s => ({ name: s }))   // output type changes to { name: string }
  .refine(                         // refines the { name: string } object
    d => !d.name.includes("admin"),
    "Reserved name"
  );
```

## Practical patterns

### Slug transform

```ts
const SlugSchema = z.string()
  .trim()
  .toLowerCase()
  .transform(s => s.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))
  .pipe(z.string().regex(/^[a-z0-9-]+$/, "Invalid slug").min(1));
```

### Phone normalization

```ts
const PhoneSchema = z.string()
  .transform(s => s.replace(/[\s\-().]/g, ""))
  .pipe(z.string().regex(/^\+?[0-9]{7,15}$/, "Invalid phone number"));
```

### Conditional required fields

```ts
const FormSchema = z.object({
  type: z.enum(["individual", "business"]),
  name: z.string(),
  companyName: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.type === "business" && !data.companyName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Company name is required for business accounts",
      path: ["companyName"],
    });
  }
});
```

### Date range validation

```ts
const EventSchema = z.object({
  title: z.string().min(1),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
}).refine(
  data => data.endAt > data.startAt,
  { message: "Event must end after it starts", path: ["endAt"] }
);
```
