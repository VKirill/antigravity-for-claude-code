# Node.js 24 — Security Patterns

> Node.js 24.14.1 | Updated: 2026-05-15

---

## Security Headers — Helmet.js

```ts
import helmet from 'helmet';

// Express / Express-compatible
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // disable for APIs that serve to browsers
  hsts: {
    maxAge: 31536000,           // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));

// Fastify equivalent
import fastifyHelmet from '@fastify/helmet';
await fastify.register(fastifyHelmet);

// Manual headers for Hono (or any framework)
app.use('*', async (c, next) => {
  await next();
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('X-Frame-Options', 'DENY');
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
});
```

---

## CORS — Strict Configuration

```ts
import cors from 'cors';

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) ?? [];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400, // preflight cache 24h
}));
```

---

## Rate Limiting

```ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL });

// General API rate limit
app.use('/api/', rateLimit({
  windowMs: 15 * 60_000, // 15 min window
  max: 100,
  standardHeaders: 'draft-7', // RateLimit-* headers
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.sendCommand(args),
  }),
  keyGenerator: (req) => req.ip ?? 'unknown',
  handler: (_req, res) => {
    res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
  },
}));

// Auth endpoints — stricter
app.use('/api/auth/', rateLimit({
  windowMs: 60_000,
  max: 5,
  store: new RedisStore({ sendCommand: (...args) => redis.sendCommand(args) }),
}));
```

---

## Secrets Management

Never hardcode secrets. Node 24 patterns:

```ts
// src/shared/config/env.ts — Zod-validated env schema
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32), // enforce minimum entropy
  API_KEY: z.string().min(20),
  PORT: z.coerce.number().int().min(1024).max(65535).default(3000),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function validateEnv(): Env {
  if (cached) return cached;
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const fields = result.error.flatten().fieldErrors;
    throw new Error(`Env validation failed: ${JSON.stringify(fields)}`);
  }
  cached = result.data;
  return cached;
}
```

**Never log secrets:**

```ts
// BAD — leaks JWT_SECRET into logs
logger.info('Config loaded', { env: process.env });

// GOOD — only log safe fields
logger.info('Config loaded', { NODE_ENV: env.NODE_ENV, PORT: env.PORT });
```

**Vault / AWS Secrets Manager:**

```ts
// Load secrets at startup from AWS Secrets Manager
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

async function loadSecrets(): Promise<void> {
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
  const response = await client.send(new GetSecretValueCommand({
    SecretId: process.env.SECRET_ARN,
  }));
  const secrets = JSON.parse(response.SecretString!);
  // Inject into process.env before validateEnv()
  Object.assign(process.env, secrets);
}
```

---

## Input Validation — Boundary Pattern

Validate at the HTTP boundary; trust types internally:

```ts
// Route layer — validate, then call service with typed data
import { z } from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  name: z.string().min(1).max(100).trim(),
  role: z.enum(['user', 'admin']).default('user'),
});

app.post('/api/users', async (req, res, next) => {
  const result = CreateUserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(422).json({
      error: { code: 'VALIDATION_ERROR', fields: result.error.flatten().fieldErrors },
    });
    return;
  }
  // result.data is fully typed — no more validation needed downstream
  const user = await userService.create(result.data);
  res.status(201).json({ data: user });
});
```

---

## SQL Injection Prevention

Parameterized queries only — never string concatenation:

```ts
// BAD — SQL injection vector
const users = await db.query(`SELECT * FROM users WHERE email = '${email}'`);

// GOOD — Prisma ORM (parameterized internally)
const user = await prisma.user.findUnique({ where: { email } });

// GOOD — raw SQL with parameters (node-postgres)
const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

// GOOD — tagged template literal (postgres.js)
import postgres from 'postgres';
const sql = postgres(DATABASE_URL);
const users = await sql`SELECT * FROM users WHERE email = ${email}`;
```

---

## Authentication Patterns

```ts
// JWT — verify signature AND expiry
import jwt from 'jsonwebtoken';

export function verifyToken(token: string): TokenPayload {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!, {
      algorithms: ['HS256'],
      issuer: 'myapp',
      audience: 'api',
    }) as TokenPayload;
    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Token expired', 'TOKEN_EXPIRED', 401);
    }
    throw new AppError('Invalid token', 'INVALID_TOKEN', 401);
  }
}

// Password hashing — argon2 preferred over bcrypt in Node 24
import argon2 from 'argon2';

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,  // 64 MB
    timeCost: 3,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

// Timing-safe comparison for tokens/HMACs
import { timingSafeEqual } from 'node:crypto';

export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false; // length timing leak is acceptable
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
```

---

## Node.js Permission Model (Node 22+, stable in 24)

Node 24 includes a stable `--permission` flag for least-privilege execution:

```bash
# Grant only specific filesystem and network access
node --permission \
  --allow-fs-read=/app/dist \
  --allow-fs-write=/app/logs,/tmp \
  --allow-net=0.0.0.0:3000,db.internal:5432 \
  dist/app/index.js
```

```ts
// Check permissions programmatically
import { permission } from 'node:process';

if (!permission.has('fs.read', '/app/secrets')) {
  throw new Error('Missing filesystem read permission for secrets');
}
```

---

## Dependency Security

```bash
# Audit for known vulnerabilities
npm audit --audit-level=high

# Fix automatically (patches only)
npm audit fix

# Check for outdated packages
npm outdated

# License compliance
npx license-checker --onlyAllow "MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC"
```

Add to CI:

```yaml
# .github/workflows/security.yml
- name: Security audit
  run: npm audit --audit-level=high

- name: Dependency review
  uses: actions/dependency-review-action@v4
```
