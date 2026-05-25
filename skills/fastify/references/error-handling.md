# Fastify — Error Handling

## `setErrorHandler` — single source of truth

```ts
app.setErrorHandler((err, req, reply) => {
  req.log.error({ err, reqId: req.id }, 'request failed');

  if (err.validation) {
    return reply.code(400).send({
      error: 'validation_failed',
      details: err.validation.map((v) => ({ path: v.instancePath, message: v.message })),
    });
  }

  if (err.statusCode && err.statusCode < 500) {
    return reply.code(err.statusCode).send({
      error: err.code ?? 'client_error',
      message: err.message,
    });
  }

  return reply.code(500).send({
    error: 'internal_error',
    requestId: req.id,
    // NEVER leak stack to client
  });
});
```

## Throwing typed errors

```ts
class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    options?: { cause?: unknown }
  ) {
    super(message, options);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'not_found');
  }
}

// In handler:
app.get('/users/:id', async (req) => {
  const user = await app.db.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw new NotFoundError('user');
  return user;
});
```

Fastify reads `err.statusCode` automatically and maps to the right HTTP code.

## `setNotFoundHandler`

```ts
app.setNotFoundHandler({
  preHandler: app.rateLimit({ max: 4, timeWindow: '1m' }),  // throttle 404 probes
}, (req, reply) => {
  reply.code(404).send({ error: 'not_found', path: req.url });
});
```

Per-prefix 404 handlers:

```ts
app.register(async (api) => {
  api.setNotFoundHandler((req, reply) => {
    reply.code(404).send({ error: 'api_not_found' });
  });
  api.get('/users', handler);
}, { prefix: '/api/v1' });
```

## Validation error shape

When schema validation fails, Fastify produces:

```json
{
  "statusCode": 400,
  "code": "FST_ERR_VALIDATION",
  "error": "Bad Request",
  "message": "body must have required property 'email'"
}
```

The original `err.validation` array contains every failed assertion:

```json
[
  { "instancePath": "/email", "schemaPath": "#/required", "keyword": "required", "params": { "missingProperty": "email" }, "message": "must have required property 'email'" }
]
```

## Error serialization & Pino

Pino auto-serializes errors via `pino-std-serializers`. Do NOT manually `JSON.stringify(err)` — it loses the stack:

```ts
req.log.error({ err }, 'failed');  // ✅
req.log.error({ message: err.message });  // ❌ loses stack and cause chain
```

## `error.cause` chain

Node's native `Error.cause` (ES2022):

```ts
try {
  await callExternal();
} catch (cause) {
  throw new AppError('payment lookup failed', 502, 'upstream_error', { cause });
}
```

Pino's error serializer follows the `cause` chain — you see the original error in logs without manual handling.

## `onError` hook vs `setErrorHandler`

- `onError(req, reply, err, done)` — runs for every error, used for metrics/audit. Cannot change the response.
- `setErrorHandler(err, req, reply)` — **owns** the response. Only one per scope.

```ts
app.addHook('onError', async (req, reply, err) => {
  metrics.errors.inc({ route: req.routeOptions.url, code: err.code });
});
```

## Don't throw in `onSend`

The error handler ALSO runs in `onSend`/`preSerialization` — but you'd be modifying an already-formed response. Avoid throwing there. Validate output via response schema instead.

## Fastify 5 — hooks errors don't auto-cancel response

In v5, if a hook throws after `reply.send()` has been called, the response is NOT automatically cancelled. Either:
- Throw BEFORE `reply.send()`, or
- Handle cleanup explicitly in `setErrorHandler`

## Common patterns

| Situation | Pattern |
|---|---|
| 400 — bad input | Schema validation auto-runs; let it fire |
| 401 — missing auth | `reply.code(401).send(...)` from `preHandler` |
| 403 — forbidden role | Same as 401 but `.code(403)` |
| 404 — entity not found | `throw new NotFoundError('user')` in handler |
| 409 — duplicate / conflict | `throw new AppError('email exists', 409, 'duplicate')` |
| 422 — semantic input | `throw new AppError('balance too low', 422, 'insufficient_funds')` |
| 429 — rate limit | `@fastify/rate-limit` handles automatically |
| 500 — bug | uncaught — error handler returns generic body |
| 502 — upstream | wrap external calls; `throw new AppError(..., 502, 'upstream_error', { cause })` |
| 503 — overload | `@fastify/under-pressure` returns 503 when event-loop delay or heap usage exceeds threshold |
