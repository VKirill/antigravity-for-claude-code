# Fastify 4 → 5 Migration Guide

> Source: https://github.com/fastify/fastify/blob/main/docs/Guides/Migration-Guide-V5.md (verified via Context7 2026-05-15)

## Node.js requirement

- v4: Node 14+
- v5: **Node 20+** (recommended Node 22 / 24 LTS)

Update CI and `engines.node` in package.json:

```json
{ "engines": { "node": ">=20.0.0" } }
```

## Full JSON Schema required

The most common breakage:

```ts
// ❌ v4 shorthand
schema: { querystring: { name: { type: 'string' } } }

// ✅ v5
schema: {
  querystring: {
    type: 'object',
    properties: { name: { type: 'string' } },
    required: ['name'],
  },
}
```

Apply to: `body`, `params`, `querystring`, `headers`. `response[code]` allows shorthand only for primitives.

## Type providers split

In v5, the `FastifyTypeProvider` interface separates `validator` and `serializer`:

```ts
// v4
export interface MyProvider extends FastifyTypeProvider {
  output: /* schema → TS type */;
}

// v5
export interface MyProvider extends FastifyTypeProvider {
  validator: /* schema → TS type for request */;
  serializer: /* schema → TS type for response */;
}
```

Official providers (`@fastify/type-provider-typebox`, `@fastify/type-provider-json-schema-to-ts`) are already updated. Custom providers must be migrated.

## `request.routerPath` removed

```ts
// v4
req.routerPath;

// v5
req.routeOptions.url;
```

## `reply.getResponseTime()` precision

Now returns a precise float (microsecond resolution) instead of an integer.

## Default `bodyLimit` reduced

Old default was 1 MB+; v5 default is tighter. Set explicitly if you need larger:

```ts
Fastify({ bodyLimit: 5 * 1024 * 1024 });  // 5 MB
```

## `useSemicolonDelimiter` removed

Querystring `;` no longer treated as `&`. If you relied on it, register a custom `querystringParser`.

## Hook errors no longer auto-cancel responses

```ts
// v4: throwing in onSend after reply.send() was a no-op
// v5: still allowed, but the response IS sent unless you check explicitly
app.addHook('onSend', async (req, reply, payload) => {
  // If you need to abort, you must do so BEFORE reply.send()
});
```

## Decorators must be primitives or use factories for reference types

To preserve V8 hidden class:

```ts
app.decorateRequest('user', null);              // ✅ primitive sentinel
app.decorateRequest('user', { /* obj */ });     // ❌ shared mutable reference
app.decorateRequest('user', { getter: () => null });  // ✅ getter factory
```

This was already best practice; v5 enforces it more strictly.

## Plugin `name` is now strict for dependencies

```ts
fp(async (app) => { /* ... */ }, { name: 'auth', dependencies: ['db'] });
```

If a `dependencies` entry doesn't match a registered plugin name, `ready()` throws.

## Removed APIs

- `request.context` — use `request.routeOptions`
- `reply.context` — same
- `fastify.print(routes|plugins)` → `fastify.printRoutes()` / `fastify.printPlugins()`
- Some legacy logger options

## Pino bumped to v9

Most signatures unchanged. If you used `pino.destination()` with custom options, recheck the new options shape.

## Migration checklist

- [ ] Bump `engines.node` to `>=20`
- [ ] Replace all schema shorthand with full JSON Schema
- [ ] Migrate custom type providers to validator/serializer split
- [ ] Search/replace `routerPath` → `routeOptions.url`
- [ ] Audit `bodyLimit` usage on file-upload endpoints
- [ ] Replace `request.context` with `request.routeOptions`
- [ ] Update `@fastify/*` plugins to v5-compatible versions
- [ ] Re-run integration tests; watch for hooks that silently dropped errors in v4
- [ ] Verify `useSemicolonDelimiter` removal didn't break query parsing

## Common gotcha — Ajv strict mode

Fastify 5 ships Ajv with stricter defaults. If validation errors fire on previously-OK schemas:

```ts
Fastify({
  ajv: {
    customOptions: { strictSchema: false, strictTypes: false },
  },
});
```

But prefer fixing the schemas — the strict mode catches real bugs.
