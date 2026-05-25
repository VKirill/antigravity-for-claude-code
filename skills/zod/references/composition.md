# Zod 4 — Object Composition, Unions, Branded Types, Recursive Schemas

## Object schema basics

```ts
const UserSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  email: z.email(),
  role: z.enum(["admin", "user", "guest"]),
  createdAt: z.date(),
});

type User = z.infer<typeof UserSchema>;

// Access inner shape
UserSchema.shape.email   // ZodEmail
UserSchema.keyof()       // ZodEnum<["id","name","email","role","createdAt"]>
```

## .extend() — Zod 4 change

**Zod 4:** `.extend()` accepts a **plain shape object** only. Passing another ZodObject is a runtime error.

```ts
// Zod 4 — CORRECT
const AdminSchema = UserSchema.extend({
  permissions: z.array(z.string()),
  superAdmin: z.boolean().default(false),
});

// Zod 3 allowed this — Zod 4 does NOT:
// const AdminSchema = UserSchema.extend(AnotherZodObject);  // ERROR in Zod 4
```

## .merge() — combine two ZodObjects

```ts
const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  country: z.string(),
});

const UserWithAddressSchema = UserSchema.merge(AddressSchema);
// Equivalent to extend with all fields from AddressSchema
// Right-side schema wins on key conflicts
```

## .pick() and .omit()

```ts
// Include only specified fields
const PublicUserSchema = UserSchema.pick({ id: true, name: true });
type PublicUser = z.infer<typeof PublicUserSchema>; // { id: number; name: string }

// Exclude specified fields
const CreateUserSchema = UserSchema.omit({ id: true, createdAt: true });
type CreateUser = z.infer<typeof CreateUserSchema>;

// Combine for update schema (all optional, no id/createdAt)
const UpdateUserSchema = UserSchema.omit({ id: true, createdAt: true }).partial();
```

## .partial() and .required()

```ts
// All fields → optional
const PartialUser = UserSchema.partial();
// { id?: number; name?: string; ... }

// Specific fields only
const PartialName = UserSchema.partial({ name: true, email: true });

// Force all optional fields to be required
const FullUser = PartialUser.required();

// Specific fields required
const RequiredName = PartialUser.required({ name: true });
```

## Unknown key strategies

```ts
z.object({ name: z.string() }).strip()        // default — strips unknown keys
z.object({ name: z.string() }).passthrough()  // keeps unknown keys, type: { name: string } & { [k: string]: unknown }
z.object({ name: z.string() }).strict()       // throws ZodError on unknown keys
```

Use `.strict()` at API boundaries to catch accidental extra fields during development.

## Union

`z.union([...])` tries each schema in order, returns first match:

```ts
const StringOrNumber = z.union([z.string(), z.number()]);
type StringOrNumber = z.infer<typeof StringOrNumber>; // string | number

// Shorthand for nullable
const NullableString = z.union([z.string(), z.null()]);
// Equivalent to: z.string().nullable()
```

**Performance note:** `z.union` is O(n) — it tries schemas in order. For large unions of objects, always use `z.discriminatedUnion`.

## Discriminated Union

`z.discriminatedUnion("discriminatorKey", [...])` — O(1) dispatch using a literal field:

```ts
const ResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("success"),
    data: z.string(),
  }),
  z.object({
    status: z.literal("error"),
    code: z.number(),
    message: z.string(),
  }),
  z.object({
    status: z.literal("pending"),
    jobId: z.string(),
  }),
]);

type Result = z.infer<typeof ResultSchema>;

// TypeScript narrows correctly on switch
function handle(r: Result) {
  switch (r.status) {
    case "success": return r.data;       // data is accessible
    case "error":   return r.message;    // message is accessible
    case "pending": return r.jobId;      // jobId is accessible
  }
}
```

**Discriminated union requirements:**
- Every schema in the array must have the discriminator key as a `z.literal()`
- Discriminator key must be a string (cannot be numeric or boolean)
- All discriminator values must be unique

## Intersection

Combines two schemas — both must pass:

```ts
const TimestampedSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});

const TimestampedUser = z.intersection(UserSchema, TimestampedSchema);
// User & { createdAt: Date; updatedAt: Date }
```

**Note:** Prefer `.merge()` for two ZodObjects — it merges shapes. `.intersection` is for non-object schema combinations or mixed types.

## Branded Types

Branded types add a phantom type tag to prevent mixing domain primitives:

```ts
const UserIdSchema = z.number().int().positive().brand<"UserId">();
const PostIdSchema = z.number().int().positive().brand<"PostId">();

type UserId = z.infer<typeof UserIdSchema>;   // number & { readonly _brand: "UserId" }
type PostId = z.infer<typeof PostIdSchema>;   // number & { readonly _brand: "PostId" }

// TypeScript will error if you pass a UserId where PostId is expected:
function getPost(id: PostId) { ... }
const userId = UserIdSchema.parse(123);  // type: UserId
getPost(userId);  // TS error: UserId is not assignable to PostId
```

**Create branded values:**
```ts
// Option 1: parse through the schema
const id = UserIdSchema.parse(123);

// Option 2: cast in trusted contexts (no runtime validation)
function createUserId(n: number): UserId {
  return n as UserId;
}
```

**Common branded types:**
```ts
const EmailSchema = z.email().brand<"Email">();
const SlugSchema = z.string().regex(/^[a-z0-9-]+$/).brand<"Slug">();
const PositiveInt = z.number().int().positive().brand<"PositiveInt">();
```

## Recursive Schemas with z.lazy()

For self-referential types (tree nodes, nested categories, JSON-like structures):

```ts
// Must declare the TS type first to break the inference loop
type Category = {
  id: number;
  name: string;
  children: Category[];
};

// Annotate with z.ZodType<T> to help TypeScript
const CategorySchema: z.ZodType<Category> = z.object({
  id: z.number(),
  name: z.string(),
  children: z.lazy(() => z.array(CategorySchema)),
});
```

**JSON-like schema:**
```ts
type Json =
  | string | number | boolean | null
  | Json[]
  | { [key: string]: Json };

const JsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonSchema),
    z.record(z.string(), JsonSchema),
  ])
);
```

**Gotcha:** `z.lazy()` disables type inference — always annotate with `z.ZodType<T>`. Without the annotation TypeScript infers `ZodLazy<ZodLazy<...>>` and may not narrow correctly.

## zod-to-json-schema

Convert Zod schemas to JSON Schema for OpenAPI specs and Claude tool definitions:

```ts
import { zodToJsonSchema } from "zod-to-json-schema";

const schema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
  status: z.enum(["active", "inactive"]),
});

// JSON Schema draft-7 (default)
const jsonSchema = zodToJsonSchema(schema);

// OpenAPI 3.0 format
const openApiSchema = zodToJsonSchema(schema, {
  target: "openApi3",
  $refStrategy: "none",    // inline definitions, no $ref
});

// Named definition
const named = zodToJsonSchema(schema, {
  name: "UserInput",
  target: "openApi3",
});
```

**Limitations:** Brands, transforms, and async refinements are stripped in the output. Custom refinements (`.refine()`) are not representable in JSON Schema — they are silently ignored.

**Discriminated unions → `oneOf`:**
```ts
const DiscSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("a"), value: z.string() }),
  z.object({ type: z.literal("b"), count: z.number() }),
]);

zodToJsonSchema(DiscSchema);
// produces: { oneOf: [{ properties: { type: { const: "a" }, value: { type: "string" } } }, ...] }
```

## Schema composition patterns

### Create / Update schemas from a single base

```ts
const BaseUserSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  role: z.enum(["admin", "user"]),
});

// Create: all required
export const CreateUserSchema = BaseUserSchema;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// Update: all optional
export const UpdateUserSchema = BaseUserSchema.partial();
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

// Response: includes server-set fields
export const UserResponseSchema = BaseUserSchema.extend({
  id: z.number(),
  createdAt: z.date(),
});
export type UserResponse = z.infer<typeof UserResponseSchema>;
```

### Reusable field schemas

```ts
// Define shared fields once
const IdField = z.number().int().positive();
const TimestampField = z.date();
const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Compose
const ListUsersQuerySchema = PaginationSchema.extend({
  search: z.string().optional(),
  role: z.enum(["admin", "user"]).optional(),
});
```
