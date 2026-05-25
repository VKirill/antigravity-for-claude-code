# Multi-Instance Scaling — grammY Runner + Redis

## Scenario

Scale a bot from a single process to multiple instances (PM2 cluster, Docker Compose, Kubernetes) without losing session state or breaking conversation flows.

---

## Architecture overview

```
                    ┌──────────────────────────────────┐
Telegram Servers ──►│  Angie / Nginx (HTTPS :443)      │
                    │  → reverse proxy to :3000         │
                    └──────────────┬───────────────────┘
                                   │ webhook
                    ┌──────────────┴───────────────────┐
                    │  Bot instances (PM2 cluster)      │
                    │  Instance 1  Instance 2  ...      │
                    └──────────────┬───────────────────┘
                                   │ sessions, rate limits
                    ┌──────────────┴───────────────────┐
                    │  Redis 8                          │
                    └──────────────────────────────────┘
```

For long polling: only ONE instance polls. Use leader election (shown below).
For webhooks: multiple instances process updates independently. Sessions MUST be in Redis.

---

## Step 1 — Redis-backed sessions with sequentialize

```typescript
// bot.ts — critical middleware ORDER
import { Bot, session } from "grammy";
import { run, sequentialize } from "@grammyjs/runner";
import { conversations } from "@grammyjs/conversations";
import { RedisAdapter } from "@grammyjs/storage-redis";
import { Redis } from "ioredis";
import type { MyContext } from "./types";

const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

const bot = new Bot<MyContext>(process.env.BOT_TOKEN!);

// 1. sequentialize FIRST — locks updates from same chat to prevent race conditions
//    MUST match the session key (chat.id here)
bot.use(
  sequentialize((ctx) => {
    const chat = ctx.chat?.id.toString();
    const user = ctx.from?.id.toString();
    // Return both to lock on either — essential when conversations span DMs and groups
    return [chat, user].filter(Boolean) as string[];
  })
);

// 2. session middleware AFTER sequentialize
bot.use(
  session({
    initial: () => ({ step: null }),
    storage: new RedisAdapter({
      instance: redis,
      ttl: 60 * 60 * 24 * 30,  // 30 days
    }),
    // Session key: chat_id:user_id — matches sequentialize key
    getSessionKey: (ctx) =>
      ctx.chat && ctx.from
        ? `${ctx.chat.id}:${ctx.from.id}`
        : undefined,
  })
);

// 3. conversations AFTER session
bot.use(conversations());
```

---

## Step 2a — Long polling with leader election

Only one instance should call `getUpdates`. Use Redis to elect a leader.

```typescript
// long-polling-leader.ts
import { run } from "@grammyjs/runner";
import { Redis } from "ioredis";

const LEADER_KEY = "bot:leader";
const LEASE_TTL_S = 30;
const RENEW_INTERVAL_MS = 10_000;

async function startWithLeaderElection(
  bot: typeof import("grammy").Bot.prototype,
  redis: Redis
) {
  const instanceId = `${process.env.POD_NAME ?? "local"}-${process.pid}`;

  // Try to claim leadership (NX = only if key doesn't exist)
  const acquired = await redis.set(LEADER_KEY, instanceId, "EX", LEASE_TTL_S, "NX");

  if (!acquired) {
    console.log(`[${instanceId}] Not leader — standby mode`);
    // Check periodically; if leader disappears, attempt to take over
    const interval = setInterval(async () => {
      const leader = await redis.get(LEADER_KEY);
      if (!leader) {
        clearInterval(interval);
        await startWithLeaderElection(bot, redis);
      }
    }, RENEW_INTERVAL_MS);
    return;
  }

  console.log(`[${instanceId}] Elected leader — starting long polling`);

  // Renew lease while running
  const renewInterval = setInterval(async () => {
    // XX = only update if key exists (prevent accidental take-over after expiry gap)
    await redis.set(LEADER_KEY, instanceId, "EX", LEASE_TTL_S, "XX");
  }, RENEW_INTERVAL_MS);

  const runner = run(bot, {
    runner: {
      fetch: { allowed_updates: ["message", "callback_query", "pre_checkout_query"] },
      process: { concurrency: 200 },
    },
  });

  const stop = async () => {
    clearInterval(renewInterval);
    if (runner.isRunning()) await runner.stop();
    await redis.del(LEADER_KEY);
  };

  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}
```

---

## Step 2b — Webhook with multiple instances

No leader election needed. Telegram delivers each update to one instance.
Sessions in Redis handle shared state atomically.

```typescript
// webhook-multi-instance.ts
import Fastify from "fastify";
import { webhookCallback } from "grammy";

const fastify = Fastify({ logger: true });

// Secret token validation
fastify.addHook("preHandler", async (req, reply) => {
  if (req.url !== "/webhook") return;
  const token = req.headers["x-telegram-bot-api-secret-token"];
  if (token !== process.env.WEBHOOK_SECRET) {
    reply.code(401).send({ error: "Unauthorized" });
  }
});

fastify.post("/webhook", webhookCallback(bot, "fastify"));
fastify.get("/health", async () => ({ status: "ok" }));

fastify.listen({ port: 3000, host: "0.0.0.0" });
```

---

## Step 3 — Rate limiting (per-user, shared across instances)

```typescript
import { limit } from "@grammyjs/ratelimiter";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { autoRetry } from "@grammyjs/auto-retry";

// Throttle outgoing API calls globally (prevents hitting Telegram's 30 msg/s limit)
bot.api.config.use(apiThrottler());

// Auto-retry on 429 rate limit responses
bot.api.config.use(autoRetry());

// Per-user rate limit: 3 requests per 2 seconds — uses Redis for multi-instance
bot.use(
  limit({
    timeFrame: 2000,
    limit: 3,
    storageClient: redis,
    keyGenerator: (ctx) => ctx.from?.id.toString() ?? "unknown",
    onLimitExceeded: async (ctx) => {
      await ctx.reply("Please slow down.");
    },
  })
);
```

---

## Step 4 — PM2 ecosystem config

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      // Long polling: single instance required
      name: "bot-polling",
      script: "dist/bot-polling.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      kill_timeout: 30000,  // 30 s for graceful shutdown
      wait_ready: true,     // wait for process.send("ready") before marking healthy
      env: {
        NODE_ENV: "production",
        BOT_TOKEN: process.env.BOT_TOKEN,
        REDIS_URL: process.env.REDIS_URL,
      },
    },
    {
      // Webhook: multiple instances (cluster mode)
      name: "bot-webhook",
      script: "dist/webhook-server.js",
      instances: "max",       // one per CPU core
      exec_mode: "cluster",
      watch: false,
      kill_timeout: 30000,
      wait_ready: true,
      env: {
        NODE_ENV: "production",
        BOT_TOKEN: process.env.BOT_TOKEN,
        REDIS_URL: process.env.REDIS_URL,
        WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
      },
    },
  ],
};
```

---

## Step 5 — Docker Compose (webhook + Redis)

```yaml
# docker-compose.yml
services:
  bot:
    build: .
    restart: unless-stopped
    deploy:
      replicas: 2               # horizontal scaling
    environment:
      NODE_ENV: production
      BOT_TOKEN: ${BOT_TOKEN}
      REDIS_URL: redis://redis:6379
      WEBHOOK_SECRET: ${WEBHOOK_SECRET}
    ports:
      - "3000:3000"
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  redis:
    image: redis:8-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

volumes:
  redis_data:
```

---

## Step 6 — Monitoring

```typescript
// middleware/observability.ts
bot.use(async (ctx, next) => {
  const start = Date.now();
  try {
    await next();
    logger.info({
      update_id: ctx.update.update_id,
      type: Object.keys(ctx.update).find((k) => k !== "update_id"),
      user_id: ctx.from?.id,
      chat_id: ctx.chat?.id,
      instance: process.pid,
      duration_ms: Date.now() - start,
    });
  } catch (err) {
    logger.error({ err, update: ctx.update }, "Handler error");
    throw err; // re-throw so bot.catch() handles it
  }
});

// Health check: expose runner status
fastify.get("/health", async () => ({
  status: runner?.isRunning() ? "running" : "stopped",
  pid: process.pid,
  uptime: process.uptime(),
  timestamp: Date.now(),
}));
```

---

## Scaling limits and thresholds

| Metric | Telegram limit | Mitigation |
|---|---|---|
| Messages per chat | 1 msg/s | `apiThrottler` + batch queuing |
| Messages across chats | 30 msg/s | `apiThrottler` |
| Webhook max connections | 100 per bot | Set `max_connections: 100` in `setWebhook` |
| Concurrent webhook updates | Limited by your HTTP server | Scale horizontally + Redis sessions |
| Long polling concurrent updates | 500 (grammY Runner default) | Tune `concurrency` based on handler latency |
