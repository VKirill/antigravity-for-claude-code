# Scaling & Deployment Patterns

> Source: https://grammy.dev/advanced/scaling · https://grammy.dev/hosting/overview
> Node.js 24.x + grammY 1.x (May 2026)

---

## Processing Models

### Sequential (Default)

```
Update 1 → [middleware] → done
Update 2 → [middleware] → done   ← waits for Update 1
Update 3 → [middleware] → done   ← waits for Update 2
```

Safe but slow under load. One slow handler blocks all others.

### Concurrent (grammY Runner)

```
Update 1 → [middleware]
Update 2 → [middleware]   ← runs in parallel with Update 1
Update 3 → [middleware]   ← runs in parallel with 1 and 2
```

Up to 500 concurrent updates by default. Requires `sequentialize` if using sessions.

### Webhook Native Concurrency

Telegram's webhook delivery is inherently concurrent — separate HTTP requests per update. Your server processes them as fast as the HTTP server allows.

---

## grammY Runner (Long Polling Concurrency)

```typescript
import { Bot } from "grammy";
import { run, sequentialize } from "@grammyjs/runner";

const bot = new Bot<MyContext>(process.env.BOT_TOKEN!);

// Step 1: Add sequentialize BEFORE session middleware
// Key must match session key — prevents race conditions
bot.use(sequentialize((ctx) => {
  const chat = ctx.chat?.id.toString();
  const user = ctx.from?.id.toString();
  // Return array to lock on multiple keys
  return [chat, user].filter(Boolean) as string[];
}));

// Step 2: Install session after sequentialize
bot.use(session({
  initial: () => ({ count: 0 }),
  storage: new RedisAdapter({ instance: redis }),
}));

bot.command("start", handler);

// Step 3: Use run() instead of bot.start()
const runner = run(bot, {
  runner: {
    fetch: { allowed_updates: ["message", "callback_query"] },
    process: { concurrency: 200 },  // max concurrent updates
  },
});

process.once("SIGINT", () => runner.isRunning() && runner.stop());
process.once("SIGTERM", () => runner.isRunning() && runner.stop());
```

---

## Rate Limiting

### Auto-Retry (Backoff on 429)

```typescript
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { autoRetry } from "@grammyjs/auto-retry";

// Throttle outgoing API calls (prevents sending too fast)
bot.api.config.use(apiThrottler());

// Auto-retry on 429 Too Many Requests with exponential backoff
bot.api.config.use(autoRetry());
```

### Per-User Rate Limiting

```typescript
import { limit } from "@grammyjs/ratelimiter";

bot.use(limit({
  timeFrame: 2000,      // 2 seconds
  limit: 3,             // max 3 requests per timeFrame
  storageClient: redis, // use Redis for multi-instance

  onLimitExceeded: async (ctx) => {
    await ctx.reply("Too many requests. Please slow down.");
  },

  keyGenerator: (ctx) => ctx.from?.id.toString(),  // key per user
}));
```

---

## Telegram API Rate Limits

Telegram imposes rate limits at the API level:

| Limit | Value |
|-------|-------|
| Messages to same chat | 1 msg/second |
| Broadcast to different chats | 30 msgs/second |
| Bulk notifications (same group) | 20 msgs/minute |
| `sendMessage` global | ~30 calls/second |

For broadcast loops, add delays:

```typescript
async function broadcast(userIds: number[], text: string) {
  const BATCH_SIZE = 25;
  const DELAY_MS = 1000;

  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(id => bot.api.sendMessage(id, text)));
    if (i + BATCH_SIZE < userIds.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }
}
```

---

## Multi-Instance Deployment

When running multiple bot instances (load balancer, Kubernetes):

### Session Storage

Use Redis or another shared store — never RAM storage:

```typescript
import { RedisAdapter } from "@grammyjs/storage-redis";
import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);

bot.use(session({
  initial: () => ({}),
  storage: new RedisAdapter({ instance: redis }),
}));
```

### Webhook Routing

With webhooks + multiple instances, Telegram delivers each update to one instance (round-robin or random depending on infrastructure). Session state must be in shared storage — not per-instance memory.

### Long Polling + Multi-Instance

Only one instance should poll at a time. Use a distributed lock or leader election:

```typescript
// Simple leader election with Redis
const isLeader = await redis.set("bot:leader", instanceId, "EX", 30, "NX");
if (isLeader) {
  run(bot);  // only leader polls
  setInterval(() => redis.set("bot:leader", instanceId, "EX", 30, "XX"), 10000);
}
```

---

## PM2 Deployment (VPS)

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: "telegram-bot",
    script: "dist/bot.js",
    instances: 1,          // only 1 instance for long polling
    exec_mode: "fork",
    watch: false,
    env: {
      NODE_ENV: "production",
      BOT_TOKEN: process.env.BOT_TOKEN,
    },
    error_file: "logs/err.log",
    out_file: "logs/out.log",
    max_restarts: 10,
    restart_delay: 3000,
  }],
};
```

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

For webhooks with PM2, use `instances: "max"` and `exec_mode: "cluster"` — each PM2 worker handles independent HTTP requests.

---

## Docker Deployment

```dockerfile
# Dockerfile
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

CMD ["node", "dist/bot.js"]
```

```yaml
# docker-compose.yml
services:
  bot:
    build: .
    restart: unless-stopped
    environment:
      BOT_TOKEN: ${BOT_TOKEN}
      REDIS_URL: redis://redis:6379
    depends_on:
      - redis

  redis:
    image: redis:8-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

---

## Serverless Deployment

### Cloudflare Workers

Best for: global edge deployment, near-zero idle cost, <1ms cold start.

```bash
npm create cloudflare@latest my-bot -- --template grammy/cloudflare-workers
wrangler secret put BOT_TOKEN
wrangler deploy
# Then set webhook: await bot.api.setWebhook("https://my-bot.workers.dev/webhook")
```

Constraints: no persistent filesystem, no background jobs, 10ms CPU time limit (Hobby), use KV/D1 for storage.

### Vercel

Best for: Next.js integration, easy deploy from GitHub.

Constraints: 10s function timeout on Hobby, use Edge Runtime for lower latency.

### AWS Lambda

Best for: enterprise scale, fine-grained cost control.

```bash
# Use Serverless Framework or AWS SAM
serverless deploy
```

---

## Observability

```typescript
// Structured logging middleware
bot.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  console.log(JSON.stringify({
    update_id: ctx.update.update_id,
    type: Object.keys(ctx.update).filter(k => k !== "update_id")[0],
    user_id: ctx.from?.id,
    chat_id: ctx.chat?.id,
    duration_ms: Date.now() - start,
  }));
});

// Error tracking (e.g., Sentry)
import * as Sentry from "@sentry/node";

bot.catch((err) => {
  Sentry.captureException(err.error, {
    extra: { update: err.ctx.update },
  });
  // Optionally notify user
  err.ctx.reply("An error occurred. Please try again.").catch(() => {});
});
```

