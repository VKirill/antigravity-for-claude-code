# Example — Session Store backed by Redis Hash + Field TTL

Session store using a single Redis hash per session with **per-field TTL** (Redis 7.4+ / 8).

## Design

- One hash per session: `session:<sid>`
- Fields: `user_id`, `csrf_token`, `last_activity`, `device`, `preferences`, ...
- Hash-level TTL: 30 days (cleanup if user never returns)
- Field-level TTL for short-lived values: `csrf_token` (1 hour), `mfa_challenge` (5 min)
- Sliding expiry: refresh hash TTL on every request

## Implementation

```ts
import type Redis from 'ioredis';
import crypto from 'node:crypto';

interface SessionData {
  userId: string;
  csrfToken: string;
  device?: string;
  preferences?: Record<string, string>;
}

const SESSION_TTL_SEC = 30 * 24 * 60 * 60;       // 30 days
const CSRF_TTL_SEC    = 60 * 60;                  // 1 hour
const MFA_TTL_SEC     = 5 * 60;                   // 5 min

export class SessionStore {
  constructor(private readonly redis: Redis) {}

  async create(userId: string, device?: string): Promise<{ sid: string; csrfToken: string }> {
    const sid       = crypto.randomBytes(32).toString('base64url');
    const csrfToken = crypto.randomBytes(32).toString('base64url');
    const key       = `session:${sid}`;

    await this.redis.multi()
      .hset(key, {
        user_id:       userId,
        csrf_token:    csrfToken,
        device:        device ?? '',
        created_at:    String(Math.floor(Date.now() / 1000)),
        last_activity: String(Math.floor(Date.now() / 1000)),
      })
      .expire(key, SESSION_TTL_SEC)
      // Field-level TTL on csrf_token — auto-rotate by expiry
      .call('HEXPIRE', key, CSRF_TTL_SEC, 'FIELDS', '1', 'csrf_token')
      .exec();

    return { sid, csrfToken };
  }

  async get(sid: string): Promise<SessionData | null> {
    const key = `session:${sid}`;
    const fields = await this.redis.hmget(key, 'user_id', 'csrf_token', 'device', 'preferences');
    const [userId, csrfToken, device, prefsJson] = fields;
    if (!userId) return null;
    return {
      userId,
      csrfToken: csrfToken ?? await this.rotateCsrf(sid),
      device: device || undefined,
      preferences: prefsJson ? JSON.parse(prefsJson) : undefined,
    };
  }

  /**
   * Touch on every request — slides the 30-day TTL forward.
   */
  async touch(sid: string): Promise<void> {
    const key = `session:${sid}`;
    await this.redis.multi()
      .hset(key, 'last_activity', String(Math.floor(Date.now() / 1000)))
      .expire(key, SESSION_TTL_SEC)
      .exec();
  }

  /**
   * Rotate CSRF — also restart its field-level TTL.
   */
  async rotateCsrf(sid: string): Promise<string> {
    const key = `session:${sid}`;
    const newToken = crypto.randomBytes(32).toString('base64url');
    await this.redis.multi()
      .hset(key, 'csrf_token', newToken)
      .call('HEXPIRE', key, CSRF_TTL_SEC, 'FIELDS', '1', 'csrf_token')
      .exec();
    return newToken;
  }

  /**
   * Start MFA challenge with 5-minute field TTL.
   */
  async startMfa(sid: string, challenge: string): Promise<void> {
    const key = `session:${sid}`;
    await this.redis.multi()
      .hset(key, 'mfa_challenge', challenge)
      .call('HEXPIRE', key, MFA_TTL_SEC, 'FIELDS', '1', 'mfa_challenge')
      .exec();
  }

  async verifyMfa(sid: string, candidate: string): Promise<boolean> {
    const stored = await this.redis.hget(`session:${sid}`, 'mfa_challenge');
    if (!stored) return false;
    const ok = crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(candidate));
    if (ok) await this.redis.hdel(`session:${sid}`, 'mfa_challenge');
    return ok;
  }

  async destroy(sid: string): Promise<void> {
    await this.redis.del(`session:${sid}`);
  }

  /**
   * Force log out all sessions for a user — index by user_id.
   */
  async destroyAllForUser(userId: string): Promise<void> {
    // Maintain a SET of session IDs per user via additional writes in `create`
    // (omitted here; pattern: SADD user:sessions:<userId> <sid> + SADD reverse)
    const sids = await this.redis.smembers(`user:sessions:${userId}`);
    if (sids.length === 0) return;
    const pipe = this.redis.multi();
    for (const sid of sids) pipe.del(`session:${sid}`);
    pipe.del(`user:sessions:${userId}`);
    await pipe.exec();
  }
}
```

## Why hash field TTL helps

Pre-Redis 7.4 you'd need:
- `session:<sid>` for user_id (30 days)
- `csrf:<sid>` for csrf_token (1 hour)
- `mfa:<sid>` for mfa_challenge (5 min)

Three keys, three round-trips, no atomic "destroy session" without `MULTI`. With field TTL:
- One key per session
- One round-trip to read all session state
- `DEL session:<sid>` wipes everything atomically

## Fastify wire-up

```ts
import fp from 'fastify-plugin';
import { SessionStore } from './session-store';

export default fp(async (app) => {
  const store = new SessionStore(app.redis);

  app.decorate('sessions', store);

  app.addHook('preHandler', async (req, reply) => {
    const sid = req.cookies.sid;
    if (!sid) return;
    const session = await store.get(sid);
    if (!session) return;
    req.user = { sub: session.userId };
    await store.touch(sid);
  });
});

declare module 'fastify' {
  interface FastifyInstance { sessions: SessionStore }
  interface FastifyRequest  { user?: { sub: string } }
}
```

## Login route

```ts
app.post('/login', { schema: { body: loginSchema } }, async (req, reply) => {
  // verify credentials...
  const { sid, csrfToken } = await app.sessions.create(user.id, req.headers['user-agent']);
  reply
    .setCookie('sid', sid, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 })
    .header('x-csrf-token', csrfToken)
    .send({ ok: true });
});
```

## CSRF check

```ts
function requireCsrf(req: FastifyRequest, reply: FastifyReply) {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  const headerToken = req.headers['x-csrf-token'];
  if (typeof headerToken !== 'string' || headerToken !== req.session?.csrfToken) {
    return reply.code(403).send({ error: 'csrf_failed' });
  }
}
```

## Anti-patterns

- ❌ Storing session data as a JSON blob string (loses field-level expiry; rewrites entire value)
- ❌ No TTL on session keys → unbounded growth
- ❌ Not rotating CSRF → token replay if leaked
- ❌ Skipping sliding TTL (`EXPIRE` on touch) → active users get logged out on the 30-day mark
- ❌ Storing sensitive PII in the hash — encrypt with `pgcrypto`-style symmetric encryption client-side first
- ❌ Forgetting that `HEXPIRE` requires Redis 7.4+ — fallback to per-key separate sessions on older Redis
