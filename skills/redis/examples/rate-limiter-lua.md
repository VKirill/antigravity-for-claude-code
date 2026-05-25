# Example — Token-bucket Rate Limiter via Lua

A per-user rate limit: 100 requests per minute, refilling at 100/60 = ~1.67 tokens/second. Implemented as an atomic Lua script.

## Script

```lua
-- KEYS[1] = bucket key (e.g., "rate:user:42")
-- ARGV[1] = capacity (max tokens)
-- ARGV[2] = refill rate (tokens per second)
-- ARGV[3] = now (unix seconds, float)
-- ARGV[4] = cost (tokens this request costs)

local key      = KEYS[1]
local capacity = tonumber(ARGV[1])
local rate     = tonumber(ARGV[2])
local now      = tonumber(ARGV[3])
local cost     = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'updated')
local tokens = tonumber(bucket[1]) or capacity
local updated = tonumber(bucket[2]) or now

-- Refill based on elapsed time
local elapsed = math.max(0, now - updated)
tokens = math.min(capacity, tokens + elapsed * rate)

local allowed = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
end

redis.call('HMSET', key, 'tokens', tokens, 'updated', now)
redis.call('EXPIRE', key, math.ceil(capacity / rate) * 2)   -- TTL: 2× bucket fill time

-- Return: allowed (0/1), remaining tokens, retry-after seconds
local retryAfter = 0
if allowed == 0 then
  retryAfter = (cost - tokens) / rate
end

return { allowed, math.floor(tokens), tostring(retryAfter) }
```

Atomic because Lua scripts execute single-threaded on the server.

## Node side (ioredis)

```ts
import type Redis from 'ioredis';
import { readFileSync } from 'node:fs';

const SCRIPT = readFileSync(new URL('./rate-limit.lua', import.meta.url), 'utf8');

let scriptSha: string | null = null;

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class RateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly capacity: number,
    private readonly refillPerSecond: number,
  ) {}

  async take(key: string, cost = 1): Promise<RateLimitResult> {
    if (!scriptSha) {
      scriptSha = await this.redis.script('LOAD', SCRIPT) as string;
    }

    const now = Date.now() / 1000;
    let result: [number, number, string];
    try {
      result = await this.redis.evalsha(
        scriptSha, 1, key,
        String(this.capacity), String(this.refillPerSecond), String(now), String(cost),
      ) as [number, number, string];
    } catch (err) {
      // NOSCRIPT — re-load and retry
      if ((err as Error).message.includes('NOSCRIPT')) {
        scriptSha = await this.redis.script('LOAD', SCRIPT) as string;
        result = await this.redis.evalsha(
          scriptSha, 1, key,
          String(this.capacity), String(this.refillPerSecond), String(now), String(cost),
        ) as [number, number, string];
      } else {
        throw err;
      }
    }

    const [allowed, remaining, retry] = result;
    return {
      allowed: allowed === 1,
      remaining,
      retryAfterSeconds: Number(retry),
    };
  }
}
```

## Fastify integration

```ts
import fp from 'fastify-plugin';
import { RateLimiter } from './rate-limiter';

export default fp(async (app) => {
  const limiter = new RateLimiter(app.redis, 100, 100 / 60);

  app.addHook('preHandler', async (req, reply) => {
    if (!req.url.startsWith('/api')) return;
    const userId = req.user?.sub ?? req.ip;
    const r = await limiter.take(`rate:${userId}`);
    reply.header('x-ratelimit-remaining', String(r.remaining));
    if (!r.allowed) {
      reply.header('retry-after', Math.ceil(r.retryAfterSeconds));
      return reply.code(429).send({ error: 'rate_limited' });
    }
  });
});
```

## Why token bucket vs sliding window

- **Token bucket** — allows bursts up to capacity, then steady drain. Best for typical API throttling.
- **Sliding window** — strict per-period count. Smoother but rejects bursts.
- **Fixed window** — simple `INCR + EXPIRE`. Allows 2× burst at window edges.

Token bucket via Lua is the production default — atomic, fast (single round-trip), fair, supports varying costs per request.

## Variations

### Per-action cost

```ts
await limiter.take(`rate:${userId}`, 5);   // expensive endpoint
await limiter.take(`rate:${userId}`, 1);   // cheap endpoint
```

### Tiered limits

Run the script with different capacity per user tier:

```ts
const limits = { free: [60, 1], pro: [600, 10], enterprise: [6000, 100] };
const [cap, rate] = limits[user.tier];
const limiter = new RateLimiter(redis, cap, rate);
```

### Global limit per endpoint

```ts
await limiter.take(`rate:endpoint:/api/expensive`, 1);
```

## Performance

- 1 round-trip per request (`EVALSHA`)
- ~50–100 µs server-side
- Stable memory: 1 hash per key (~150 bytes); TTL'd to auto-clean

## Common mistakes

- ❌ Using `INCR + EXPIRE` separately → race; first increment after expire sets no TTL
- ❌ Implementing in app code → not atomic → race between read and write
- ❌ Not loading via `SCRIPT LOAD` + `EVALSHA` → wire overhead per call
- ❌ Not handling `NOSCRIPT` (server restart wipes script cache) → first request after restart fails
- ❌ Using floating-point timestamps with integer math — match types
