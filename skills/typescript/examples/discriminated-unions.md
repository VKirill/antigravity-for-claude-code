# Discriminated Unions

Modeling sum types in TypeScript: patterns, exhaustive checks, narrowing anti-patterns.

---

## What Is a Discriminated Union

A discriminated union (tagged union, sum type) is a union of object types sharing a common literal field — the **discriminant**:

```ts
type Result<T, E = Error> =
  | { kind: "success"; data: T }
  | { kind: "error";   error: E };
```

The discriminant (`kind`) must be a **literal type** (`"success"`, `"error"`) — not `string`. TypeScript narrows the union by checking the discriminant.

---

## Basic Pattern

```ts
type Shape =
  | { kind: "circle";    radius: number }
  | { kind: "rectangle"; width: number; height: number }
  | { kind: "triangle";  base: number;  height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;   // shape: { kind: "circle"; radius: number }
    case "rectangle":
      return shape.width * shape.height;     // shape: { kind: "rectangle"; ... }
    case "triangle":
      return (shape.base * shape.height) / 2;
    default:
      // If you add a new Shape variant, this becomes an error:
      const _exhaustive: never = shape;
      throw new Error(`Unknown shape: ${JSON.stringify(_exhaustive)}`);
  }
}
```

The `never` assignment in the `default` branch is the **exhaustive check** — if any variant is unhandled, TS will error here.

---

## Exhaustive Check Patterns

**Option 1: assertNever function (recommended)**
```ts
function assertNever(x: never, message?: string): never {
  throw new Error(message ?? `Unhandled variant: ${JSON.stringify(x)}`);
}

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle": return Math.PI * shape.radius ** 2;
    case "rectangle": return shape.width * shape.height;
    case "triangle": return (shape.base * shape.height) / 2;
    default: return assertNever(shape); // ts(2345) if a variant is missing
  }
}
```

**Option 2: `satisfies never` in-place**
```ts
default: {
  shape satisfies never; // compile-time only — no throw, unsafe for runtime
}
```

Use Option 1 in production code — it also protects at runtime. Option 2 is compile-time only.

---

## Result Type (Common Application)

A typed Result type replaces unchecked exceptions:

```ts
type Result<T, E = string> =
  | { ok: true;  value: T }
  | { ok: false; error: E };

function divide(a: number, b: number): Result<number> {
  if (b === 0) return { ok: false, error: "Division by zero" };
  return { ok: true, value: a / b };
}

const result = divide(10, 2);

if (result.ok) {
  console.log(result.value); // narrowed: { ok: true; value: number }
} else {
  console.error(result.error); // narrowed: { ok: false; error: string }
}
```

---

## Event / Action Pattern

Discriminated unions model events naturally:

```ts
type AppEvent =
  | { type: "USER_LOGIN";   payload: { userId: string; email: string } }
  | { type: "USER_LOGOUT";  payload: { userId: string } }
  | { type: "ORDER_PLACED"; payload: { orderId: string; amount: number } }
  | { type: "ORDER_FAILED"; payload: { orderId: string; reason: string } };

function handleEvent(event: AppEvent): void {
  switch (event.type) {
    case "USER_LOGIN":
      startSession(event.payload.userId);
      break;
    case "USER_LOGOUT":
      endSession(event.payload.userId);
      break;
    case "ORDER_PLACED":
      fulfillOrder(event.payload.orderId, event.payload.amount);
      break;
    case "ORDER_FAILED":
      alertSupport(event.payload.orderId, event.payload.reason);
      break;
    default:
      assertNever(event);
  }
}
```

---

## State Machine with Discriminated Unions

```ts
type LoadState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error";   error: Error };

// Transitions enforce valid state progression
function startLoading<T>(state: LoadState<T>): LoadState<T> {
  if (state.status !== "idle") {
    throw new Error("Can only start loading from idle state");
  }
  return { status: "loading" };
}
```

---

## Narrowing in Conditional Logic

Beyond `switch`:

```ts
// if-else narrowing
if (result.ok) {
  return result.value; // narrowed to success branch
}
return result.error; // narrowed to error branch

// Array narrowing with discriminant filter
type Animal = { kind: "dog"; bark: string } | { kind: "cat"; meow: string };
const animals: Animal[] = [...];

const dogs = animals.filter((a): a is Extract<Animal, { kind: "dog" }> => a.kind === "dog");
dogs.forEach(d => console.log(d.bark)); // safely narrowed
```

---

## Anti-patterns

**Anti-pattern: Union of untagged shapes**
```ts
// Bad: no discriminant — TS can't narrow safely
type BadShape =
  | { radius: number }     // no kind field
  | { width: number; height: number };

function badArea(shape: BadShape): number {
  if ("radius" in shape) { ... } // workaround — fragile if shapes share fields
}
```

Always include a literal discriminant field. `"radius" in shape` works but is fragile and verbose.

**Anti-pattern: Non-literal discriminant**
```ts
// Bad: discriminant is string, not a literal — no narrowing
type BadResult = { status: string; data?: unknown; error?: string };
```

Discriminants must be **literal types** (`"ok"`, `"error"`, not `string`).

**Anti-pattern: Forgetting exhaustive check**
```ts
function badArea(shape: Shape): number {
  switch (shape.kind) {
    case "circle": return Math.PI * shape.radius ** 2;
    case "rectangle": return shape.width * shape.height;
    // Missing triangle — no TS error, returns undefined at runtime
  }
  return 0; // silently wrong
}
```

Always add `default: assertNever(shape)` in switch statements over discriminated unions.

---

## Discriminated Unions vs Class Hierarchies

| Aspect | Discriminated union | Class hierarchy |
|---|---|---|
| Runtime overhead | None | Prototype chain |
| Serialization | Works with JSON.stringify/parse | Requires custom serializer |
| Pattern matching | `switch` + TS narrowing | `instanceof` |
| Adding variants | Change type + all switch sites → compile errors point the way | Subclass + override |
| Shared behavior | Extract to standalone functions | Methods on base class |

Prefer discriminated unions for: API responses, events, state machines, domain modeling, anything that crosses a serialization boundary. Prefer classes for: stateful objects with shared methods, framework integration (React components, ORM models).
