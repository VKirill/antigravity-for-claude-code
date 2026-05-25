# Hono — Validators

## `@hono/zod-validator` (most common)

```ts
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const CreateUser = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

app.post('/users', zValidator('json', CreateUser), (c) => {
  const body = c.req.valid('json');  // typed { email: string; name: string }
  return c.json({ id: 'u_1', ...body }, 201);
});
```

## Validation targets

| Target | What | Access |
|---|---|---|
| `json` | JSON body | `c.req.valid('json')` |
| `form` | `multipart/form-data` or `application/x-www-form-urlencoded` | `c.req.valid('form')` |
| `query` | querystring | `c.req.valid('query')` |
| `param` | path params | `c.req.valid('param')` |
| `header` | request headers | `c.req.valid('header')` |
| `cookie` | cookies | `c.req.valid('cookie')` |

Multiple targets on one route:

```ts
app.get('/posts/:id',
  zValidator('param', z.object({ id: z.string() })),
  zValidator('query', z.object({ include: z.enum(['author', 'comments']).optional() })),
  (c) => {
    const { id } = c.req.valid('param');
    const { include } = c.req.valid('query');
    return c.json({ id, include: include ?? null });
  });
```

## Custom error handling

```ts
app.post('/users', zValidator('json', CreateUser, (result, c) => {
  if (!result.success) {
    return c.json({ error: 'validation_failed', issues: result.error.issues }, 400);
  }
}), handler);
```

## Coercion (querystrings are strings)

```ts
const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
app.get('/list', zValidator('query', ListQuery), (c) => {
  const { limit, offset } = c.req.valid('query');  // numbers!
  return c.json({ limit, offset });
});
```

## Alternative validators

- `@hono/valibot-validator` — Valibot (tree-shakable, ~10× smaller bundle than Zod for simple schemas)
- `@hono/arktype-validator` — ArkType (TS-syntax-like, fastest runtime)
- `@hono/typebox-validator` — TypeBox

API shape is identical: `<name>Validator('json', schema)`.

```ts
import { vValidator } from '@hono/valibot-validator';
import * as v from 'valibot';
app.post('/x', vValidator('json', v.object({ name: v.string() })), handler);
```

## Validator as a stand-alone parser

```ts
import { validator } from 'hono/validator';

app.post('/raw', validator('json', (value, c) => {
  if (typeof value !== 'object' || !value || !('id' in value)) {
    return c.json({ error: 'bad' }, 400);
  }
  return value as { id: string };
}), (c) => c.json(c.req.valid('json')));
```

Use this when you need custom logic without a schema library.

## OpenAPI generation (`@hono/zod-openapi`)

Wraps Zod schemas + routes to generate an OpenAPI 3.1 spec:

```ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

const app = new OpenAPIHono();

const route = createRoute({
  method: 'get',
  path: '/users/{id}',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ id: z.string(), email: z.string() }) } }, description: 'OK' },
    404: { description: 'Not found' },
  },
});

app.openapi(route, (c) => c.json({ id: c.req.valid('param').id, email: 'x@y.z' }));
app.doc('/openapi.json', { openapi: '3.1.0', info: { title: 'API', version: '1.0.0' } });
```

## Combining validators with type narrowing

```ts
const Body = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('email'), email: z.string().email() }),
  z.object({ kind: z.literal('phone'), phone: z.string() }),
]);
app.post('/contact', zValidator('json', Body), (c) => {
  const b = c.req.valid('json');
  if (b.kind === 'email') return c.json({ via: 'email', email: b.email });
  return c.json({ via: 'phone', phone: b.phone });
});
```

## Common gotchas

- Forgetting to register the validator above the handler — `c.req.valid()` returns `unknown`
- Using `z.string().email()` on a form-encoded field that's actually an array — use `z.array(z.string())` or fix the form
- Using `z.number()` on querystring (which is `string`) — use `z.coerce.number()`
