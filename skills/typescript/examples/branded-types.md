# Branded Types

End-to-end patterns for nominal typing in TypeScript's structural type system.

---

## Problem: Structural Typing Conflates Primitives

TypeScript treats all `string` values as interchangeable — `UserId`, `OrderId`, and `ProductId` are all just `string` at the type level:

```ts
function processOrder(userId: string, orderId: string) { ... }

const userId = "user_123";
const orderId = "order_456";

processOrder(orderId, userId); // compiles! Args swapped — runtime bug
```

Branded types prevent this without any runtime overhead.

---

## Pattern 1: Phantom Brand (Recommended)

```ts
// Definition: a string that carries a readonly phantom tag
type Brand<T, B extends string> = T & { readonly __brand: B };

type UserId  = Brand<string, "UserId">;
type OrderId = Brand<string, "OrderId">;

// Constructor: validate + cast at boundary
function makeUserId(raw: string): UserId {
  if (!raw.startsWith("user_")) throw new Error(`Invalid UserId: ${raw}`);
  return raw as UserId; // safe: we validated
}

function makeOrderId(raw: string): OrderId {
  if (!raw.startsWith("order_")) throw new Error(`Invalid OrderId: ${raw}`);
  return raw as OrderId;
}
```

Now the compiler catches swapped arguments:

```ts
function processOrder(userId: UserId, orderId: OrderId) { ... }

processOrder(makeOrderId("order_456"), makeUserId("user_123"));
// ↑ Error: Argument of type 'OrderId' is not assignable to parameter of type 'UserId'
```

---

## Pattern 2: `createBrand` Factory

For a uniform creation pattern across many branded types:

```ts
// Factory: returns a constructor function typed to Brand<Base, BrandTag>
function createBrand<Base, Tag extends string>() {
  return (value: Base) => value as Brand<Base, Tag>;
}

// Declare the type and constructor together
type UserId = Brand<string, "UserId">;
const UserId = createBrand<string, "UserId">();

type OrderId = Brand<string, "OrderId">;
const OrderId = createBrand<string, "OrderId">();

type Amount = Brand<number, "Amount">;
const Amount = createBrand<number, "Amount">();

// Usage
const userId  = UserId("user_123");   // type: UserId
const orderId = OrderId("order_456"); // type: OrderId
const price   = Amount(9.99);         // type: Amount
```

---

## Pattern 3: `satisfies` for Object Brands

When branding an object shape (not a primitive):

```ts
type ValidatedEmail = { readonly value: string } & { readonly __brand: "ValidatedEmail" };

function validateEmail(raw: string): ValidatedEmail {
  if (!/.+@.+\..+/.test(raw)) throw new Error("Invalid email");
  return { value: raw } satisfies { value: string } as ValidatedEmail;
}
```

---

## Where to Apply Branded Types

Apply at **domain primitive boundaries**:

| Type | Base | Why |
|---|---|---|
| `UserId` | `string` | Prevents mixing with other entity IDs |
| `OrderId` | `string` | |
| `Email` | `string` | Signals the value was validated |
| `Timestamp` | `number` | Prevents mixing with other numbers |
| `Cents` | `number` | Prevents mixing with floating-point dollars |
| `PositiveInt` | `number` | Constrains value range |
| `SafeHtml` | `string` | Signals the string was sanitized |

---

## Anti-patterns

**Anti-pattern: `as` without validation**
```ts
// Bad: bypasses the constructor, no validation
const id = "not_a_user" as UserId; // compiles, but violates the contract
```

Always go through the constructor function. The `as` cast inside the constructor is the only legitimate use.

**Anti-pattern: Branding standard library types**
```ts
// Unnecessary: Date is already a distinct type; it won't be confused with string
type BrandedDate = Date & { __brand: "MyDate" };
```

Brand primitives (`string`, `number`, `boolean`) where structural typing causes confusion. Classes and distinct object shapes are already nominally different.

**Anti-pattern: Deep nesting brands**
```ts
// Too much: adds noise without value
type ValidatedTrimmedNonEmptyUppercaseString = Brand<string, "validated"> & Brand<string, "trimmed"> & ...
```

One brand per meaningful domain invariant. Don't stack brands — create a single named type.

---

## Using Branded Types with Zod

```ts
import { z } from "zod";

// Zod schema that parses + brands
const UserIdSchema = z.string()
  .startsWith("user_")
  .transform(val => val as UserId);

// Use in an API endpoint
const body = UserIdSchema.parse(req.params.userId);
// body is now typed as UserId ✓
```

---

## Removing a Brand (Unwrapping)

When you need the underlying primitive for serialization/output:

```ts
function unwrap<T extends { __brand?: string }>(branded: T): Omit<T, "__brand"> {
  return branded;
}

// For primitives: just use the value directly — the brand is purely phantom
const userId: UserId = makeUserId("user_123");
const rawString: string = userId; // Error: cannot assign UserId to string
// Fix: explicit unbranding
const rawString: string = userId as string;
```

The phantom brand is erased at runtime — there's no actual `__brand` property on primitive types at runtime.
