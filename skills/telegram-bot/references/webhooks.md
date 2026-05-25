# Webhooks vs Long Polling Reference

> Source: https://grammy.dev · https://core.telegram.org/bots/api
> Node.js 24.x + grammY 1.x (May 2026)

---

## Comparison

| | Long Polling | Webhooks |
|---|---|---|
| **How it works** | Bot polls Telegram for updates | Telegram pushes updates to your HTTPS URL |
| **Best for** | Development, local testing, simple deployments | Production, high volume, serverless |
| **TLS required** | No | Yes (valid cert, port 443/80/88/8443) |
| **Scaling** | Single process (use runner for concurrency) | Naturally multi-instance |
| **Latency** | Slight polling delay | Near-instant (push) |
| **Infrastructure** | Just Node.js | Public HTTPS server or serverless function |
| **Idle cost** | Active connection kept open | No connection cost, pay-per-update |

---

## Long Polling

### Basic (Sequential)

```typescript
import { Bot } from "grammy";

const bot = new Bot(process.env.BOT_TOKEN!);

bot.command("start", (ctx) => ctx.reply("Hello!"));

// Starts long polling — blocks until bot.stop() called
bot.start({
  onStart: (info) => console.log(`Bot @${info.username} started`),
  allowed_updates: ["message", "callback_query"],
  drop_pending_updates: true,    // ignore accumulated updates on startup
});
```

### Graceful Shutdown

```typescript
process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());

bot.start();
```

### Concurrent Long Polling (grammY Runner)

```typescript
import { Bot } from "grammy";
import { run, sequentialize } from "@grammyjs/runner";

const bot = new Bot<MyContext>(process.env.BOT_TOKEN!);

// REQUIRED: prevent race conditions on session data
// Process updates from the same chat sequentially
bot.use(sequentialize((ctx) => ctx.chat?.id.toString()));

bot.use(session({ ... }));
bot.command("start", handler);

// Runs up to 500 concurrent updates
const runner = run(bot);

// Graceful shutdown
process.once("SIGINT", () => runner.isRunning() && runner.stop());
process.once("SIGTERM", () => runner.isRunning() && runner.stop());
```

`sequentialize` key should match session key — typically `chat.id`, `user.id`, or both combined.

---

## Webhooks

### Requirements

- HTTPS with a valid TLS certificate (self-signed supported with certificate upload)
- One of these ports: **443**, **80**, **88**, or **8443**
- Public URL reachable by Telegram servers
- Maximum connections: 1–100 (default 40)

### Express Integration

```typescript
import express from "express";
import { Bot, webhookCallback } from "grammy";

const bot = new Bot(process.env.BOT_TOKEN!);

bot.command("start", (ctx) => ctx.reply("Hello!"));

const app = express();
app.use(express.json());

// Mount webhook handler
app.use("/webhook", webhookCallback(bot, "express"));

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

### Fastify Integration

```typescript
import Fastify from "fastify";
import { Bot, webhookCallback } from "grammy";

const bot = new Bot(process.env.BOT_TOKEN!);
const fastify = Fastify();

fastify.post("/webhook", webhookCallback(bot, "fastify"));

fastify.listen({ port: 3000, host: "0.0.0.0" });
```

### Hono Integration (Edge/Cloudflare Workers)

```typescript
import { Hono } from "hono";
import { Bot, webhookCallback } from "grammy";

const bot = new Bot(process.env.BOT_TOKEN!);
bot.command("start", (ctx) => ctx.reply("Hello from edge!"));

const app = new Hono();
app.post("/webhook", webhookCallback(bot, "hono"));

export default app;
```

### Setting the Webhook URL

```typescript
// Programmatically (run once at deploy time)
await bot.api.setWebhook("https://your-domain.com/webhook", {
  secret_token: process.env.WEBHOOK_SECRET!,  // validates requests are from Telegram
  drop_pending_updates: true,
  allowed_updates: ["message", "callback_query", "inline_query"],
  max_connections: 40,
});

// Verify webhook is active
const info = await bot.api.getWebhookInfo();
console.log(info);
// { url, has_custom_certificate, pending_update_count, last_error_message, ... }
```

### Removing Webhook (Switch to Long Polling)

```typescript
await bot.api.deleteWebhook({ drop_pending_updates: true });
```

### Security: Validating Incoming Requests

Always verify the `X-Telegram-Bot-Api-Secret-Token` header:

```typescript
app.use("/webhook", (req, res, next) => {
  const token = req.headers["x-telegram-bot-api-secret-token"];
  if (token !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}, webhookCallback(bot, "express"));
```

### Local Development with Webhooks

Use a tunnel tool to expose localhost:

```bash
# ngrok
ngrok http 3000

# Then set webhook to your ngrok URL:
await bot.api.setWebhook("https://abc123.ngrok.io/webhook");
```

Or use Telegram's test server for development (separate bot tokens).

---

## Serverless Webhooks

### Vercel / Netlify Edge Functions

```typescript
// api/webhook.ts (Next.js App Router)
import { Bot, webhookCallback } from "grammy";

const bot = new Bot(process.env.BOT_TOKEN!);
bot.command("start", (ctx) => ctx.reply("Hello!"));

const handler = webhookCallback(bot, "std/http");

export async function POST(req: Request) {
  return handler(req);
}
```

### AWS Lambda

```typescript
import { Bot, webhookCallback } from "grammy";
import type { APIGatewayProxyHandler } from "aws-lambda";

const bot = new Bot(process.env.BOT_TOKEN!);
bot.command("start", (ctx) => ctx.reply("Hello!"));

export const handler: APIGatewayProxyHandler = webhookCallback(bot, "aws-lambda-async");
```

### Cloudflare Workers

```typescript
import { Bot, webhookCallback } from "grammy";

const bot = new Bot(process.env.BOT_TOKEN!);
bot.command("start", (ctx) => ctx.reply("Hello!"));

const handleUpdate = webhookCallback(bot, "cloudflare-mod");

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "POST") {
      return handleUpdate(req);
    }
    return new Response("Bot is running");
  },
};
```

---

## Webhook Concurrency Behaviour

Telegram guarantees: updates from the same chat are delivered sequentially. You can process updates from different chats concurrently without needing `sequentialize`.

However, in multi-instance deployments:
- Use sticky sessions (route by chat_id) OR
- Use distributed session storage (Redis) with atomic read-modify-write

---

## Allowed Updates Filter

Reduce Telegram's traffic by declaring which update types you handle:

```typescript
await bot.api.setWebhook(url, {
  allowed_updates: [
    "message",
    "edited_message",
    "callback_query",
    "inline_query",
    "chosen_inline_result",
    "pre_checkout_query",
    "shipping_query",
    "poll",
    "poll_answer",
    "my_chat_member",
    "chat_member",
    "chat_join_request",
    // Bot API 7.x+:
    "message_reaction",
    "message_reaction_count",
    "chat_boost",
    "removed_chat_boost",
    "business_connection",
    "business_message",
    "edited_business_message",
    "deleted_business_messages",
  ],
});

// Also apply in long polling:
bot.start({ allowed_updates: ["message", "callback_query"] });
```
