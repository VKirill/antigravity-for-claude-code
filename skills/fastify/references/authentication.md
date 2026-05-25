# Fastify — Authentication

## `@fastify/jwt` — JWT auth

```ts
import fastifyJwt from '@fastify/jwt';
import fp from 'fastify-plugin';

export default fp(async (app) => {
  await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET!,
    sign: { expiresIn: '15m', algorithm: 'HS256' },
    verify: { allowedIss: 'my-app' },
  });

  app.decorate('authenticate', async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  });
});
```

Usage:

```ts
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyJWT {
    payload: { sub: string; role: 'user' | 'admin' };
    user:    { sub: string; role: 'user' | 'admin' };  // request.user
  }
}

app.get('/me', { preHandler: app.authenticate }, async (req) => {
  return { userId: req.user.sub };
});
```

### Sign a token

```ts
const token = app.jwt.sign({ sub: user.id, role: user.role });
// or per-request, refreshes claims:
const token = await reply.jwtSign({ sub: user.id });
```

### RS256 (asymmetric)

```ts
await app.register(fastifyJwt, {
  secret: {
    private: fs.readFileSync('private.pem'),
    public:  fs.readFileSync('public.pem'),
  },
  sign: { algorithm: 'RS256' },
});
```

## `@fastify/cookie` — cookies & signed cookies

```ts
await app.register(import('@fastify/cookie'), {
  secret: process.env.COOKIE_SECRET!,  // for signed cookies
  hook: 'onRequest',
  parseOptions: {},
});

app.get('/set', (req, reply) => {
  reply
    .setCookie('sid', 'abc', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', signed: true })
    .send();
});

app.get('/read', (req) => {
  const unsigned = req.unsignCookie(req.cookies.sid ?? '');
  return { valid: unsigned.valid, value: unsigned.value };
});
```

## Session cookies (Redis-backed)

```ts
await app.register(import('@fastify/session'), {
  secret: process.env.SESSION_SECRET!,
  cookie: { secure: true, httpOnly: true, sameSite: 'lax', maxAge: 86_400_000 },
  store: new RedisStore({ client: redis }),
});
```

## `@fastify/auth` — compose strategies

```ts
import fastifyAuth from '@fastify/auth';

await app.register(fastifyAuth);

app.decorate('verifyApiKey', async (req, reply) => { /* check req.headers['x-api-key'] */ });
app.decorate('verifyJwt',    async (req, reply) => { await req.jwtVerify(); });

app.get('/data', {
  preHandler: app.auth([app.verifyApiKey, app.verifyJwt], { relation: 'or' }),
}, handler);
```

## API-key auth (simple)

```ts
const VALID_KEYS = new Set([process.env.API_KEY!]);

app.addHook('onRequest', async (req, reply) => {
  if (req.url.startsWith('/public')) return;
  const key = req.headers['x-api-key'];
  if (typeof key !== 'string' || !VALID_KEYS.has(key)) {
    return reply.code(401).send({ error: 'unauthorized' });
  }
});
```

Use `crypto.timingSafeEqual` for constant-time comparison if comparing single secrets.

## RBAC via preHandler

```ts
function requireRole(role: 'admin' | 'user') {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.user?.role !== role) {
      return reply.code(403).send({ error: 'forbidden' });
    }
  };
}

app.get('/admin', { preHandler: [app.authenticate, requireRole('admin')] }, handler);
```

## Refresh tokens

Store hashed refresh tokens in Redis (`SET refresh:<jti> <userId> EX 2592000`). On `/refresh`:
1. Read JWT from request (long-lived refresh, separate secret).
2. Look up `refresh:<jti>` in Redis. If absent → 401.
3. Issue new access token via `app.jwt.sign(...)`.
4. Rotate: delete old jti, store new.

## Common pitfalls

- ❌ `onRequest` for auth → body not parsed yet → some flows need body
- ✅ `preHandler` for auth → body parsed + validated
- ❌ Storing user object on `request` as dynamic property → use `decorateRequest('user', null)` + declaration merging
- ❌ Symmetric secret shorter than 256 bits — use 32+ bytes random
- ❌ Forgetting to validate `iss` / `aud` / `exp` — let `@fastify/jwt` enforce it via `verify` options
