---
name: zod
description: "Zod 4 TS-first runtime validation — schemas, parsing, transforms, refinements, async, discriminated unions. Use when: zod, z.object, z.string, z.number, z.array, z.union, z.discriminatedUnion, z.enum, z.literal, z.coerce, .parse, .safeParse, .refine, .transform, z.infer, zod-to-json-schema, Zod 4 migration, schema composition, branded types, recursive schemas, env validation, form validation. SKIP: yup/joi legacy (suggest Zod), tRPC-internal Zod usage (→trpc if active)."
stacks:
  - frontend-libraries
  - backend
  - validation
packages:
  - zod
  - zod-to-json-schema
  - "@hookform/resolvers"
tags:
  - zod
  - validation
  - schema
  - typescript
  - runtime
  - parsing
  - forms
source: new(zod-skill-v1)
risk: medium-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Zod: `4.x`
- TypeScript: `6.0.x`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need, then follow the link to the relevant reference file for full detail.

## Use this skill when

- Defining runtime-validated schemas for API request/response bodies, env vars, or form data
- Using `.parse()` or `.safeParse()` and handling `ZodError` with per-field issue paths
- Composing schemas with `.extend()`, `.merge()`, `.pick()`, `.omit()`, `.partial()`, `.required()`
- Writing refinements (`.refine()`, `.superRefine()`) or transforms (`.transform()`, `.pipe()`)
- Modeling state machines or tagged unions with `z.discriminatedUnion()`
- Extracting static TypeScript types with `z.infer<typeof schema>`
- Validating environment variables with `z.coerce` and providing typed `env` objects
- Building recursive or self-referential schemas with `z.lazy()`
- Generating JSON Schema / OpenAPI specs from Zod schemas via `zod-to-json-schema`
- Integrating Zod with React Hook Form via `@hookform/resolvers/zod`
- Migrating from Zod 3 to Zod 4 (breaking changes: `.email()` removed, `.extend` behavior, perf)
- Creating branded/opaque types for domain primitives (UserId, Email, etc.)

## Do not use this skill when

- Task is about yup or joi — suggest migrating to Zod; don't maintain those APIs
- Task is tRPC router input/output typing and tRPC is an active skill in the project (`→trpc`)
- Task is pure TypeScript type-system design (mapped types, conditional types, generics) with no runtime validation — use `typescript`
- Task is JSON Schema validation without TypeScript (AJV, pure JSON Schema) — Zod is TS-first
- Task is Pydantic (Python equivalent) — different runtime, different skill

## Purpose

Zod is the dominant TypeScript-first runtime validation library — the gap-bridger between TypeScript's compile-time type system and the untrusted data at runtime (HTTP requests, env vars, user input, localStorage). Unlike type assertions, Zod validates at runtime, narrows types automatically, and generates human-readable errors with per-field issue paths.

Zod 4 (the current major) ships significantly faster parsing performance, a redesigned `z.string()` API (`.email()` removed in favor of `z.email()`), updated `.extend()` semantics, and first-class `z.file()` support. This skill covers the full Zod surface: primitives, composition, transforms, async validation, error handling, `z.lazy` recursion, branded types, and integrations with React Hook Form and `zod-to-json-schema`. It owns the validation layer — the framework skill (fastify, hono, nextjs) owns how the schema is wired into the request lifecycle.

## Capabilities

### Schema Primitives

String, number, boolean, date, bigint, symbol, undefined, null, void, any, unknown, never. Zod 4 moves string format validators to top-level: `z.email()`, `z.url()`, `z.uuid()`, `z.cuid()`, `z.nanoid()` — not `z.string().email()`. Numeric guards: `.min()`, `.max()`, `.int()`, `.positive()`, `.finite()`. Array: `z.array(schema).min(1).nonempty()`. Tuple: `z.tuple([z.string(), z.number()])`. Record: `z.record(z.string(), z.number())`.

> Full reference: [references/schema-primitives.md](references/schema-primitives.md)

### Object Schemas & Composition

`z.object({ key: schema })` creates an ObjectSchema. Composition methods: `.extend({ newKey: schema })` adds fields (Zod 4: `.extend()` no longer accepts a ZodObject — pass a plain shape); `.merge(otherObject)` merges two ZodObjects; `.pick({ key: true })` and `.omit({ key: true })` narrow fields; `.partial()` makes all fields optional; `.required()` forces all fields non-optional; `.passthrough()` keeps unknown keys; `.strip()` (default) removes unknown keys; `.strict()` throws on unknown keys. Access inner shape with `.shape.fieldName`.

> Full reference: [references/composition.md](references/composition.md)

### Parsing & Error Handling

`.parse(data)` throws `ZodError` on failure. `.safeParse(data)` returns `{ success: true, data }` or `{ success: false, error: ZodError }` — preferred for request handlers. `.parseAsync()` / `.safeParseAsync()` for schemas with async refinements. `ZodError.issues` is an array of `ZodIssue` objects with `path`, `code`, `message`. Flatten to a field-keyed object with `error.flatten()`.

> Full reference: [references/error-handling.md](references/error-handling.md)

### Transforms & Refinements

`.transform(fn)` converts parsed value to a new type — changes the output type. `.refine(fn, message)` validates without changing type. `.superRefine(fn)` for multiple issues or conditional logic. `.pipe(schema)` chains schemas (useful after transform). Async refinements: `.refineAsync(async fn)` — requires `.parseAsync()`. Preprocess inputs with `z.preprocess(fn, schema)` (coerce before parsing).

> Full reference: [references/transforms-and-refinements.md](references/transforms-and-refinements.md)

### Union & Discriminated Union

`z.union([A, B, C])` tries each schema in order — use for small sets. `z.discriminatedUnion("type", [A, B])` uses a literal discriminator field for O(1) dispatch — always prefer this for tagged unions / state machines. `z.intersection(A, B)` combines two schemas (all fields required to pass both). Literal union shorthand: `z.enum(["a", "b"])` generates a TS `"a" | "b"` type.

> Full reference: [references/composition.md](references/composition.md)

### Coerce & Default Values

`z.coerce.string()`, `z.coerce.number()`, `z.coerce.boolean()`, `z.coerce.date()` — calls the constructor on the value before parsing. Essential for env vars (strings → numbers). `.default(value)` or `.default(() => value)` supplies a fallback when value is `undefined`. `.catch(value)` returns fallback instead of throwing on any error. `.optional()` → `T | undefined`; `.nullable()` → `T | null`; `.nullish()` → `T | undefined | null`.

> Full reference: [references/schema-primitives.md](references/schema-primitives.md)

### Recursive Schemas & Branded Types

`z.lazy(() => schema)` enables self-referential schemas (tree nodes, categories). Pair with a TS interface and `z.ZodType<T>` annotation to avoid inference loops. Branded types: `schema.brand<"BrandName">()` produces `z.infer` output that carries the brand tag — prevents mixing `UserId` and `PostId` at the type level. Unwrap with `z.infer<typeof schema>`.

> Full reference: [references/composition.md](references/composition.md)

### React Hook Form Integration

`@hookform/resolvers/zod` bridges Zod and React Hook Form. Pass `zodResolver(schema)` as the `resolver` option to `useForm`. Types flow automatically: `useForm<z.infer<typeof schema>>()`. Errors from `ZodError` surface in `formState.errors` keyed by field path. Works with nested objects and arrays.

> Full reference: [references/integration-rhf.md](references/integration-rhf.md)

### zod-to-json-schema

`zodToJsonSchema(schema)` converts a Zod schema to a JSON Schema draft-7/2019-09 object. Used for OpenAPI spec generation, Claude tool definitions, and JSON Schema validators. Pass options: `{ target: "openApi3", $refStrategy: "none" }`. Discriminated unions become `oneOf`. Brands and transforms are stripped.

> Full reference: [references/composition.md](references/composition.md)

### Zod 3 → 4 Migration

Key breaking changes: `z.string().email()` → `z.email()`; `z.string().url()` → `z.url()`; `.extend()` accepts only a plain shape object (not another ZodObject); `ZodError.format()` deprecated in favor of `.flatten()`; `z.ZodType` → `z.ZodTypeAny` for generic bounds.

> Full reference: [references/migration-3-to-4.md](references/migration-3-to-4.md)

## Behavioral Traits

- Uses `.safeParse()` at HTTP boundaries, `.parse()` only in trusted-internal contexts where a thrown error is acceptable
- Prefers `z.discriminatedUnion()` over `z.union()` for tagged unions — O(1) dispatch, better error messages
- Extracts the TypeScript type with `z.infer<typeof schema>` immediately after schema definition — never writes duplicate types
- Uses `z.coerce.number()` for env var parsing, not `Number(process.env.X)` which silently produces `NaN`
- Applies `.strict()` to object schemas at API boundaries to catch unexpected extra fields
- Chains `.default()` after `.optional()` when a fallback is wanted for missing fields
- Defines schemas once and reuses — never duplicates a schema for "create" vs "update" when `.partial()` suffices
- Uses `.superRefine()` for cross-field validation (password confirmation, date range checks)
- Writes branded types for domain primitives that should not be interchangeable (UserId, ProductId)
- Reaches for `z.lazy()` for recursive data — does not attempt inline self-reference

## Important Constraints

- NEVER use `z.string().email()` in Zod 4 — it was removed; use `z.email()` at the top level
- NEVER pass a `ZodObject` to `.extend()` in Zod 4 — pass a plain shape `{ key: z.type() }`
- NEVER use `z.any()` at validated boundaries — defeats the purpose of runtime validation
- NEVER ignore `.safeParse()` errors silently — always check `result.success` and surface `result.error`
- NEVER use `z.preprocess()` for transforms that change the semantic type — use `.transform()` instead
- ALWAYS annotate recursive schemas with `z.ZodType<T>` to prevent TypeScript inference loops
- ALWAYS use `.parseAsync()` / `.safeParseAsync()` when any refinement is async — sync `.parse()` will throw
- ALWAYS validate env vars at process startup, not inside request handlers

## Related Skills

**90%-filter applied** — mainstream 2026 choices only.

### Language
- ✓ `typescript` — TS 5.9 (Zod is TS-first; always paired)

### Web frameworks (own the request lifecycle around Zod)
- ✓ `fastify` — Fastify 5 (schema-based serialization, Zod as validator plugin)
- ✓ `hono` — Hono 4 (zValidator middleware)
- ✓ `nextjs` — Next.js 16 (Server Actions, API routes)

### Forms
- ✓ `react-hook-form` — RHF 8 (hookform/resolvers/zod is the canonical bridge)

### Runtime
- ✓ `nodejs` — Node 24 (primary runtime; env validation with z.coerce)

### Frontend
- ✓ `react` — React 19 (form + state validation)

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Index + decision map | [references/REFERENCE.md](references/REFERENCE.md) |
| Primitives: string, number, boolean, date, enum, literal, coerce, optional, nullable, default | [references/schema-primitives.md](references/schema-primitives.md) |
| Object composition: extend, merge, pick, omit, partial, unions, discriminated unions, branded, lazy | [references/composition.md](references/composition.md) |
| Transforms, refinements, superRefine, pipe, preprocess, async | [references/transforms-and-refinements.md](references/transforms-and-refinements.md) |
| ZodError, safeParse patterns, error.flatten, per-field errors, custom messages | [references/error-handling.md](references/error-handling.md) |
| React Hook Form + zodResolver, nested fields, array fields | [references/integration-rhf.md](references/integration-rhf.md) |
| Zod 3 → 4 breaking changes, migration codemod patterns | [references/migration-3-to-4.md](references/migration-3-to-4.md) |
| **Recommended defaults** — `strict`/`strip`/`passthrough`, error map, env validation, discriminatedUnion choice, coerce vs preprocess vs transform, brand | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Troubleshooting** — discriminatedUnion narrowing, transform breaks inference, async refine race, `.email()` not a function, `.extend()` throws, `z.infer` any, coerce NaN | [references/troubleshooting.md](references/troubleshooting.md) |
| **Wrong vs right** — parse vs safeParse at boundaries, Zod 3→4 syntax, union vs discriminatedUnion, raw env vs validated, preprocess vs transform, strip vs strict, `z.any()` | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases — routing tests | [references/eval-cases.md](references/eval-cases.md) |

### Templates

| Template | File |
|---|---|
| Typed env loader using z.coerce with startup validation | [templates/env-schema.ts.template](templates/env-schema.ts.template) |
| API route input validator (Node/Fastify/Hono pattern) | [templates/api-route-validator.ts.template](templates/api-route-validator.ts.template) |

### Examples

| Scenario | File |
|---|---|
| Discriminated union as state machine (order status flow) | [examples/discriminated-union-state-machine.md](examples/discriminated-union-state-machine.md) |
| Recursive tree schema with z.lazy and branded IDs | [examples/recursive-tree-schema.md](examples/recursive-tree-schema.md) |

**How to use**: navigate to the specific file for the topic you need. Don't read all files — look up only what's relevant to the current task.
