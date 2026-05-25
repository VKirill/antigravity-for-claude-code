# Fastify — Validation & Schemas

Fastify uses Ajv internally for input validation and `fast-json-stringify` for response serialization. Both are driven by **JSON Schema** (the wire format), but you can author schemas with TypeBox, json-schema-to-ts, or Zod (via adapter) for TypeScript inference.

## Fastify 5 breaking change — full JSON Schema only

Fastify 5 requires complete JSON Schema for every `schema.body/params/query/headers`:

```ts
// ❌ v4 shorthand — REJECTED by Fastify 5
schema: {
  querystring: { name: { type: 'string' } }
}

// ✅ v5 — full JSON Schema
schema: {
  querystring: {
    type: 'object',
    required: ['name'],
    properties: { name: { type: 'string' } },
  }
}
```

## Response schemas (drive serialization)

```ts
app.get('/users/:id', {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
      },
    },
  },
}, async () => ({ id: '1', email: 'x@y.z', secret: 'leaked' }));
// 'secret' is STRIPPED — only schema fields serialize
```

Response schemas are 2× faster than `JSON.stringify` AND act as an output allowlist.

## Type Providers (TypeScript inference)

### TypeBox

```ts
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Type from 'typebox';

const app = Fastify().withTypeProvider<TypeBoxTypeProvider>();

app.post('/users', {
  schema: {
    body: Type.Object({
      email: Type.String({ format: 'email' }),
      age: Type.Number({ minimum: 0 }),
    }),
    response: {
      201: Type.Object({ id: Type.String() }),
    },
  },
}, async (req, reply) => {
  req.body.email;  // string — typed
  req.body.age;    // number — typed
  return reply.code(201).send({ id: 'u_1' });  // typed
});
```

### json-schema-to-ts

```ts
import { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts';
const app = Fastify().withTypeProvider<JsonSchemaToTsProvider>();

app.post('/users', {
  schema: {
    body: {
      type: 'object',
      required: ['email'],
      properties: { email: { type: 'string' } },
    } as const,  // <— `as const` is REQUIRED for inference
  },
}, async (req) => req.body.email);
```

### Zod (via adapter)

```ts
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

const app = Fastify().withTypeProvider<ZodTypeProvider>();
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.post('/users', {
  schema: {
    body: z.object({ email: z.string().email(), age: z.number().int() }),
    response: { 201: z.object({ id: z.string() }) },
  },
}, async (req, reply) => {
  req.body.email;  // typed by Zod
  return reply.code(201).send({ id: 'u_1' });
});
```

## Fastify 5 — Type Providers split

In v5, type providers separate **validator schema type** from **serializer schema type**:

```ts
import type { FastifyTypeProvider } from 'fastify';
import type { FromSchema, JSONSchema } from 'json-schema-to-ts';

export interface CustomProvider extends FastifyTypeProvider {
  validator: this['schema'] extends JSONSchema ? FromSchema<this['schema']> : unknown;
  serializer: this['schema'] extends JSONSchema ? FromSchema<this['schema']> : unknown;
}
```

Official providers (`@fastify/type-provider-typebox`, `@fastify/type-provider-json-schema-to-ts`) are already updated. Custom providers must define **both** properties.

## Shared schemas via $ref

```ts
app.addSchema({
  $id: 'user',
  type: 'object',
  properties: { id: { type: 'string' }, email: { type: 'string' } },
});

app.get('/me', {
  schema: { response: { 200: { $ref: 'user#' } } },
}, handler);
```

## Ajv customization

```ts
const app = Fastify({
  ajv: {
    customOptions: { coerceTypes: 'array', useDefaults: true, removeAdditional: 'all' },
    plugins: [require('ajv-formats')],
  },
});
```

`removeAdditional: 'all'` strips unknown properties — safer for public APIs.

## Validation errors

Fastify auto-responds 400 with `{ statusCode, code: 'FST_ERR_VALIDATION', message, validation: [...] }`. Customize via `setErrorHandler`:

```ts
app.setErrorHandler((err, req, reply) => {
  if (err.validation) {
    return reply.code(400).send({
      error: 'validation_failed',
      details: err.validation,
    });
  }
  // ...
});
```

## Picking a schema authoring tool

| Tool | When |
|---|---|
| **TypeBox** | Schema-first project, want JSON Schema output for OpenAPI |
| **json-schema-to-ts** | Already have JSON Schema files, want types from them |
| **Zod** (via adapter) | Already using Zod elsewhere (frontend, env validation) — single source |
| **Plain JSON Schema** | No TS inference needed, max ecosystem compat |
