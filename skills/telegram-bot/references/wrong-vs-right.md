# Wrong vs Right patterns — telegram-bot

Side-by-side contrasts of common LLM/junior-developer footguns vs the production-safe pattern. Required for `risk: high-stakes` per skill-evaluation v3.

Each block: **❌ Wrong** → **✅ Right** → **Why it matters**.

---

## 1. Webhook handler — trusting the update body vs treating it as untrusted input

**❌ Wrong — trust the JSON body, grant access from `successful_payment.invoice_payload`:**
```ts
app.post('/webhook', async (req, res) => {
  // No secret_token check — anyone can POST a forged update
  const update = req.body;
  if (update.message?.successful_payment) {
    const payload = JSON.parse(update.message.successful_payment.invoice_payload);
    await db.grantAccess(payload.userId, payload.plan);   // ❌ never verifies caller
  }
  res.json({ ok: true });
});
```

**✅ Right — validate `X-Telegram-Bot-Api-Secret-Token` first, then process:**
```ts
import { timingSafeEqual } from 'node:crypto';

app.post('/webhook', async (req, res) => {
  const header = req.headers['x-telegram-bot-api-secret-token'] as string | undefined;
  if (!header) return res.status(401).end();
  const expected = Buffer.from(process.env.WEBHOOK_SECRET!);
  const provided = Buffer.from(header);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return res.status(401).end();
  }
  // Now safe to process — request came from Telegram
  return handler(req, res);
});
```

**Why it matters:** without `secret_token` verification the webhook URL is a public endpoint. Anyone who guesses or scrapes it can POST fake `successful_payment` updates and trigger free grants. The header is the ONLY mechanism Telegram offers for caller authentication on webhooks — there is no HMAC over the body.

---

## 2. Mini App `initData` — trust client vs re-validate server-side

**❌ Wrong — trust `initDataUnsafe` from the client:**
```ts
// Mini App frontend posts user info to your API
app.post('/api/buy', async (req, res) => {
  const { userId, plan } = req.body;            // ❌ client-supplied, attacker can fake
  await db.grantAccess(userId, plan);
  res.json({ ok: true });
});
```

**✅ Right — receive raw `initData`, validate HMAC server-side, derive userId from validated payload:**
```ts
// Frontend sends Telegram.WebApp.initData (the raw query string)
app.post('/api/buy', async (req, res) => {
  const { initData, plan } = req.body;
  if (!validateInitData(initData, process.env.BOT_TOKEN!)) {
    return res.status(401).json({ error: 'invalid initData' });
  }
  const params = new URLSearchParams(initData);
  const user = JSON.parse(params.get('user')!);  // ✅ trusted after validation
  await db.grantAccess(user.id, plan);
  res.json({ ok: true });
});
```

**Why it matters:** `Telegram.WebApp.initDataUnsafe` is a parsed convenience object — it carries the SAME values as `initData` but the client can edit it in DevTools. Only the raw `initData` string carries the HMAC signature. Without server-side HMAC verification, an attacker opens DevTools, edits `initDataUnsafe.user.id` to another user's ID, and grants access on someone else's account.

---

## 3. Payments — grant access in `pre_checkout_query` vs `successful_payment`

**❌ Wrong — grant in `pre_checkout_query`:**
```ts
bot.on('pre_checkout_query', async (ctx) => {
  const payload = JSON.parse(ctx.preCheckoutQuery.invoice_payload);
  await db.grantPremium(ctx.from!.id, payload.plan);   // ❌ user hasn't paid yet
  await ctx.answerPreCheckoutQuery(true);
});
```

**✅ Right — validate in `pre_checkout_query`, grant in `successful_payment` with idempotency:**
```ts
bot.on('pre_checkout_query', async (ctx) => {
  // ONLY validate — inventory, price match, anti-fraud
  const payload = JSON.parse(ctx.preCheckoutQuery.invoice_payload);
  const valid = await db.canPurchase(ctx.from!.id, payload.plan);
  await ctx.answerPreCheckoutQuery(valid, valid ? undefined : 'Plan unavailable');
});

bot.on('message:successful_payment', async (ctx) => {
  const p = ctx.message.successful_payment!;
  const chargeId = p.telegram_payment_charge_id;

  // Idempotent grant — dedup row inside transaction
  await prisma.$transaction(async (tx) => {
    const exists = await tx.processedPayment.findUnique({ where: { chargeId } });
    if (exists) return;
    await tx.processedPayment.create({ data: { chargeId, userId: ctx.from!.id } });
    const payload = JSON.parse(p.invoice_payload);
    await tx.subscription.create({ data: { userId: ctx.from!.id, plan: payload.plan } });
  });
});
```

**Why it matters:** `pre_checkout_query` is sent BEFORE money moves. If the user closes Telegram, network drops, or your bot rejects, no payment occurs — but you already granted access. The `successful_payment` event is the only authoritative signal that money moved. Plus: Telegram can re-deliver `successful_payment` if your handler fails — without idempotency on `telegram_payment_charge_id`, the user gets double grant.

---

## 4. Session storage — single global memory vs Redis with sequentialize per user

**❌ Wrong — MemorySessionStorage with `@grammyjs/runner`, no sequentialize:**
```ts
import { Bot, session } from 'grammy';
import { run } from '@grammyjs/runner';

const bot = new Bot(token);
bot.use(session({ initial: () => ({ count: 0 }) }));   // ❌ RAM, lost on restart

bot.command('count', (ctx) => {
  ctx.session.count++;
  return ctx.reply(`Count: ${ctx.session.count}`);
});

run(bot);   // ❌ 500 concurrent → race on session, count drops mutations
```

**✅ Right — sequentialize BEFORE session, Redis storage, same key for both:**
```ts
import { Bot, Context, session } from 'grammy';
import { run, sequentialize } from '@grammyjs/runner';
import { RedisAdapter } from '@grammyjs/storage-redis';
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);
const getSessionKey = (ctx: Context) => ctx.chat?.id.toString();

const bot = new Bot<MyContext>(token);

bot.use(sequentialize(getSessionKey));                 // ✅ FIRST, matches session key
bot.use(session({
  getSessionKey,
  initial: () => ({ count: 0 }),
  storage: new RedisAdapter({ instance: redis }),      // ✅ shared, persisted
}));

bot.command('count', (ctx) => {
  ctx.session.count++;
  return ctx.reply(`Count: ${ctx.session.count}`);
});

run(bot, { runner: { process: { concurrency: 200 } } });
```

**Why it matters:** `@grammyjs/runner` processes 500 updates concurrently. Without `sequentialize`, two messages from the same user run handlers in parallel — both read `count = 5`, both write `count = 6`. With MemorySessionStorage you also lose state on every redeploy and can't scale beyond one process. `sequentialize` MUST be installed BEFORE session middleware and MUST use the same key — otherwise it serializes the wrong axis. See [recommended-defaults.md](recommended-defaults.md).

---

## 5. Long polling vs webhook — when to use which

**❌ Wrong — long polling in production with multiple instances:**
```ts
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'bot',
    script: 'dist/bot.js',
    instances: 4,             // ❌ 4 processes calling getUpdates → 409 Conflict
    exec_mode: 'cluster',
  }],
};

// bot.ts
bot.start();   // ❌ each instance fights for updates
```

**✅ Right — webhook + multi-instance OR long polling + single instance:**
```ts
// Option A: webhook + scaled
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'bot',
    script: 'dist/bot.js',
    instances: 'max',         // ✅ N workers share HTTP load
    exec_mode: 'cluster',
  }],
};

// bot.ts
import Fastify from 'fastify';
import { webhookCallback } from 'grammy';
const app = Fastify();
app.post(`/webhook`, webhookCallback(bot, 'fastify'));
await app.listen({ port: 3000, host: '0.0.0.0' });

// One-time at deploy:
await bot.api.setWebhook(URL, { secret_token: process.env.WEBHOOK_SECRET });

// Option B: long polling, single instance + Redis leader lock
// ecosystem.config.js
module.exports = { apps: [{ name: 'bot', script: 'dist/bot.js', instances: 1, exec_mode: 'fork' }] };
```

**Why it matters:** Only ONE process per bot token can call `getUpdates` — the second one gets `409 Conflict: terminated by other getUpdates request`. Webhook delivery is multi-instance friendly: Telegram POSTs each update to your load balancer, which can route to any worker. Long polling cannot scale horizontally without leader election. Pick one model and stick with it; never both at once (Telegram disables long polling once `setWebhook` is active anyway).

---

## How to use these

Cite from `troubleshooting.md` and concept references at the point of explanation. Don't replicate the wrong-side code in other files — link here. New high-stakes patterns: add a pair following the three-block structure (❌ / ✅ / Why it matters), each side ≤ 15 lines.
