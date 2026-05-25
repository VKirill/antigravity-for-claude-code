# Troubleshooting — telegram-bot

Symptom-indexed. Required for `risk: high-stakes`. Each entry: **Symptoms → Diagnose → Common causes → Fix (paste-runnable)**.

---

## Webhook never arrives (`pending_update_count` stays at 0 OR keeps growing)

**Symptoms**
- `setWebhook` returned `{ok: true}` but no POSTs reach your server
- Or: `getWebhookInfo()` shows `pending_update_count` growing — Telegram retrying
- Logs from Angie/Nginx show no incoming POSTs to webhook path

**Diagnose**
```bash
# 1. Confirm Telegram knows about the webhook
curl "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo" | jq

# 2. Confirm endpoint is publicly reachable, valid TLS
curl -X POST -i "https://your-domain.com/webhook" -d 'test=1'

# 3. Confirm port is one of 443/80/88/8443
echo "$WEBHOOK_URL" | grep -oE ':[0-9]+' || echo "default port (ok if 443)"

# 4. Confirm TLS chain is valid
echo | openssl s_client -connect your-domain.com:443 -servername your-domain.com 2>&1 | grep -E "Verify return code|subject="
```

**Common causes**
- ❌ Webhook port not in {443, 80, 88, 8443} — Telegram silently rejects others
- ❌ TLS chain incomplete (intermediate cert missing) — `openssl s_client` shows `verify error:num=21`
- ❌ Self-signed cert without uploading `certificate` to `setWebhook`
- ❌ Firewall blocking Telegram source IPs (`149.154.160.0/20`, `91.108.4.0/22`)
- ❌ Bot not actually registered (wrong token / bot deleted by BotFather)
- ❌ Webhook URL still pointing to staging from a previous deploy

**Fix**
```ts
// Re-register with proper config
await bot.api.setWebhook(WEBHOOK_URL, {
  secret_token: process.env.WEBHOOK_SECRET!,
  drop_pending_updates: false,                    // keep queued updates
  allowed_updates: ["message", "callback_query", "pre_checkout_query"],
  max_connections: 40,
});
const info = await bot.api.getWebhookInfo();
console.log(info);   // verify url, last_error_message
```
Renew TLS: `certbot renew --force-renewal`. Verify chain order in Angie (fullchain.pem includes intermediate).

---

## `secret_token` mismatch (every webhook returns 401)

**Symptoms**
- Webhook handler returns 401 on every Telegram POST
- `X-Telegram-Bot-Api-Secret-Token` header is present but doesn't match env
- Worked in dev, broken in prod after deploy

**Diagnose**
```bash
# 1. What does Telegram think the secret is?
# (Telegram does NOT expose it back via API — you must remember what you set)

# 2. What is the runtime env var?
pm2 env <process_id> | grep WEBHOOK_SECRET

# 3. Compare header byte-for-byte with env
```

**Common causes**
- ❌ `.env.production` not loaded — falls back to `.env` (dev secret) at runtime
- ❌ Different secret passed to `setWebhook` than handler validates against
- ❌ Whitespace / trailing newline in env file: `WEBHOOK_SECRET=abc\n` (note the `\n`)
- ❌ Rotated secret on Telegram side via new `setWebhook`, forgot to redeploy

**Fix**
```ts
// Validate at boot — fail fast on missing/invalid secret
import { z } from 'zod';
const env = z.object({
  BOT_TOKEN: z.string().regex(/^\d+:[A-Za-z0-9_-]{35,}$/),
  WEBHOOK_SECRET: z.string().regex(/^[A-Za-z0-9_-]{1,256}$/),
}).parse(process.env);

// On every request — timing-safe compare
import { timingSafeEqual } from 'node:crypto';
function verifyTelegramSecret(headerVal: string | undefined): boolean {
  if (!headerVal) return false;
  const expected = Buffer.from(env.WEBHOOK_SECRET);
  const provided = Buffer.from(headerVal);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
```
Re-issue the webhook with the prod secret in a single `setWebhook` call AFTER deploying the new env.

---

## `409 Conflict: terminated by other getUpdates request`

**Symptoms**
- Long-polling bot exits with `GrammyError: terminated by other getUpdates request`
- Multiple processes (or accidentally restarted PM2) tried `getUpdates` simultaneously

**Common causes**
- ❌ Two PM2 processes for the same bot (`pm2 list` shows duplicate)
- ❌ Local dev still polling against prod token
- ❌ Webhook AND long polling configured simultaneously
- ❌ Old container not fully stopped before new one starts (Docker race)

**Fix**
```bash
# 1. Stop the duplicate
pm2 list
pm2 stop <duplicate_id> && pm2 delete <duplicate_id>

# 2. Or: ensure only webhook OR long polling, not both
curl "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo" | jq '.result.url'
# If url is set AND you intend long polling:
curl "https://api.telegram.org/bot$BOT_TOKEN/deleteWebhook?drop_pending_updates=true"

# 3. For multi-instance long polling, use leader election (Redis lock)
```
For production scale, switch to webhook mode — long polling does NOT support multi-instance.

---

## Mini App `initData` HMAC validation fails

**Symptoms**
- Server validation rejects every `initData` from Mini App
- Frontend `tg.initDataUnsafe` looks correct (user, query_id present)
- Worked in dev, broken in prod (or after token rotation)

**Diagnose**
```ts
// Log the data-check string + computed hash + provided hash side-by-side
console.log('dataCheckString:', dataCheckString);
console.log('computed:', expectedHash);
console.log('provided:', hash);
console.log('botToken length:', botToken.length);
```

**Common causes**
- ❌ Bot token rotated in BotFather — old token still in env
- ❌ Wrong secret-key derivation: using bot_token as HMAC key directly instead of `HMAC_SHA256("WebAppData", bot_token)` first
- ❌ Forgot to URL-decode values before sorting (the data-check string uses decoded values)
- ❌ `auth_date` exceeded 24-hour TTL — old session token in localStorage
- ❌ Mixed sandbox bot token vs production token

**Fix**
```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export function validateInitData(initData: string, botToken: string, maxAgeSec = 86400): boolean {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;
  params.delete('hash');

  // Check freshness
  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return false;

  // Build data-check string (URL-decoded values, sorted by key, joined by \n)
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  // SECRET KEY = HMAC_SHA256(key="WebAppData", message=bot_token)
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  // Constant-time compare
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
```

---

## "Forbidden: bot was blocked by the user" on every message

**Symptoms**
- `GrammyError: Forbidden: bot was blocked by the user` thrown from `sendMessage` to specific user
- Logged repeatedly for the same `chat_id` — broadcast loop keeps retrying

**Common causes**
- ❌ User blocked the bot — Telegram returns 403 for ALL future messages to that chat
- ❌ Treating 403 as a transient error (retrying via `autoRetry`)

**Fix — do NOT retry. Mark user inactive in DB.**
```ts
import { GrammyError } from 'grammy';

async function sendSafe(chatId: number, text: string): Promise<boolean> {
  try {
    await bot.api.sendMessage(chatId, text);
    return true;
  } catch (e) {
    if (e instanceof GrammyError && e.error_code === 403) {
      // User blocked bot OR chat deleted — never retry
      await db.user.update({
        where: { telegram_id: chatId },
        data: { is_active: false, blocked_at: new Date() },
      });
      return false;
    }
    throw e;  // unknown error — let it bubble
  }
}
```
Filter broadcast list with `WHERE is_active = true`. Also handle 400 "chat not found" same way.

---

## `successful_payment` arrives but order not granted (idempotency miss)

**Symptoms**
- User paid in Stars (or fiat), received "Payment successful!" reply
- But access not granted in your DB OR granted twice (user got 2 emails / double credit)
- Logs show `successful_payment` handler ran 2x for same `telegram_payment_charge_id`

**Common causes**
- ❌ No dedup table — Telegram delivers `successful_payment` once, but webhook handler crashed mid-grant and Telegram retried
- ❌ Grant happens BEFORE persisting dedup row → second concurrent webhook didn't see dedup
- ❌ Dedup keyed on `invoice_payload.orderId` (mutable) instead of `telegram_payment_charge_id` (immutable, Telegram-issued)

**Fix — wrap grant in transaction with dedup row inside:**
```ts
bot.on('message:successful_payment', async (ctx) => {
  const p = ctx.message.successful_payment!;
  const chargeId = p.telegram_payment_charge_id;

  await prisma.$transaction(async (tx) => {
    // Try-insert dedup row first
    const existing = await tx.processedPayment.findUnique({ where: { chargeId } });
    if (existing) return;  // already processed — silently exit

    await tx.processedPayment.create({
      data: { chargeId, userId: ctx.from!.id, amount: p.total_amount, currency: p.currency },
    });

    // Side effects INSIDE the transaction — if they fail, dedup row rolls back
    const payload = JSON.parse(p.invoice_payload);
    await tx.subscription.create({ data: { userId: ctx.from!.id, plan: payload.plan } });
  });

  await ctx.reply(`Payment received: ${p.total_amount} ${p.currency}`);
});
```
Migration: `CREATE TABLE processed_payment (charge_id TEXT PRIMARY KEY, ...);` — `charge_id` UNIQUE via PK.

---

## Stars XTR refund silently no-ops

**Symptoms**
- `refundStarPayment(user_id, telegram_payment_charge_id)` returns `true` but user's Stars not returned
- Telegram dashboard shows transaction as "Refunded" but balance unchanged

**Common causes**
- ❌ **30-day refund window expired** — Telegram silently accepts the call but does nothing past the deadline
- ❌ Already refunded — `refundStarPayment` is idempotent; second call returns true without effect
- ❌ Wrong `telegram_payment_charge_id` (passed `provider_payment_charge_id` from fiat instead)
- ❌ User deleted their Telegram account → refund target gone

**Fix — check transaction date before calling refund:**
```ts
// Persist transaction date when handling successful_payment
// Then before refund:
const payment = await db.processedPayment.findUnique({ where: { chargeId } });
const ageDays = (Date.now() - payment.createdAt.getTime()) / (24 * 3600 * 1000);
if (ageDays > 30) {
  throw new Error('Refund window expired (30 days)');
}
await bot.api.refundStarPayment(userId, chargeId);
```
For business operations beyond 30 days: issue compensation in-app (e.g., grant extra Stars manually).

---

## Business connection auth flow broken

**Symptoms**
- `business_connection` update arrives with `is_enabled: false` OR `can_reply: false`
- Bot can't send messages on behalf of business account
- `business_message` updates arrive but `bot.api.sendMessage(business_connection_id, ...)` returns "no rights"

**Common causes**
- ❌ User disabled the connection in Telegram → Settings → Business → Chatbots
- ❌ Bot doesn't have `business_connection` and `business_message` in `allowed_updates` → updates never delivered
- ❌ Trying to use regular `chat_id` instead of `business_connection_id` for replies
- ❌ Bot lacks specific business bot rights (`can_reply`, `can_read_messages` etc.) — granted per-connection by user

**Fix**
```ts
// Subscribe to business updates explicitly
await bot.api.setWebhook(url, {
  allowed_updates: [
    "message", "callback_query",
    "business_connection", "business_message",
    "edited_business_message", "deleted_business_messages",
  ],
});

// Handle connection state changes
bot.on('business_connection', async (ctx) => {
  const conn = ctx.businessConnection;
  if (!conn.is_enabled) {
    await db.businessConn.delete({ where: { id: conn.id } });
  } else {
    await db.businessConn.upsert({
      where: { id: conn.id },
      create: { id: conn.id, userId: conn.user.id, canReply: conn.can_reply },
      update: { canReply: conn.can_reply, isEnabled: conn.is_enabled },
    });
  }
});

// Reply via business connection — pass business_connection_id
bot.on('business_message', async (ctx) => {
  const businessId = ctx.message?.business_connection_id;
  await ctx.api.sendMessage(ctx.chat!.id, 'reply', { business_connection_id: businessId });
});
```

---

## Inline keyboard buttons fire wrong handler (callback_data collision)

**Symptoms**
- User taps "Confirm" button — instead of confirm handler, "Cancel" fires (or vice versa)
- Logs show callback_data matches another route's regex

**Common causes**
- ❌ Two handlers register overlapping regexes (`/^buy/` and `/^buy_premium/` — first wins)
- ❌ Callback_data > 64 bytes (Telegram silently truncates) — your handler regex matches truncated form
- ❌ Reused `callback_data` across different keyboards without scoping

**Fix — namespace callback_data + early-exit handlers:**
```ts
const CB = {
  ORDER_CONFIRM: (orderId: string) => `order:confirm:${orderId}`,
  ORDER_CANCEL:  (orderId: string) => `order:cancel:${orderId}`,
};

bot.callbackQuery(/^order:confirm:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const orderId = ctx.match[1];
  // ...
});

bot.callbackQuery(/^order:cancel:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const orderId = ctx.match[1];
  // ...
});
```
Keep `callback_data` ≤ 64 bytes. For larger payloads, store in Redis keyed by short token: `cb:abc123 → {orderId, action}`.

---

## File upload "413 Payload Too Large" / "Request Entity Too Large"

**Symptoms**
- `sendDocument` / `sendVideo` returns `400 Request Entity Too Large` for files > 50 MB
- Or business-account upload fails for files > 2 GB

**Common causes**
- ❌ Bot upload limit is **50 MB** (Telegram-enforced)
- ❌ Business connection upload limit is **2 GB**
- ❌ Trying to forward a > 50 MB file received from another user — same limit applies

**Fix**
```ts
// Option 1: link instead of upload
await ctx.replyWithDocument(new InputFile({ url: 'https://your-s3.com/large.mp4' }));
// Telegram fetches from URL — may also fail if Telegram can't stream

// Option 2: self-hosted Bot API server — local-mode bypasses 50 MB limit
// See: https://github.com/tdlib/telegram-bot-api
//   --local flag — files are local, no 50 MB cap

// Option 3: for media > 50 MB, send link as text instead
await ctx.reply(`📎 Large file: https://your-cdn.com/file.mp4 (${sizeMb} MB)`);
```

---

## "Too Many Requests: retry after N"

**Symptoms**
- `GrammyError: Too Many Requests: retry after N` from API calls
- Bursts of messages drop after first 30
- Single chat receives messages slowly even when bot has many to send

**Common causes**
- ❌ Hit `30 msg/sec global` limit (broadcast) or `1 msg/sec per chat` limit
- ❌ No throttling on outgoing API calls
- ❌ Retry loop on 429 without backoff → makes it worse

**Fix**
```ts
import { apiThrottler } from '@grammyjs/transformer-throttler';
import { autoRetry } from '@grammyjs/auto-retry';

// Throttle proactively — never exceed limits
bot.api.config.use(apiThrottler({
  global: { maxConcurrent: 30, minTime: 1000 / 30 },       // 30 msg/sec globally
  group: { maxConcurrent: 20, minTime: 60 * 1000 / 20 },   // 20 msg/min per group
  out: { maxConcurrent: 1, minTime: 1000 },                // 1 msg/sec per chat
}));

// Auto-retry on 429 with Retry-After respected
bot.api.config.use(autoRetry({
  maxRetryAttempts: 3,
  maxDelaySeconds: 30,
}));
```
For broadcasts: batch 25 users, await 1s, repeat — see [recommended-defaults.md](recommended-defaults.md) limits.

---

## Webhook handler timeout (Telegram drops the update)

**Symptoms**
- `getWebhookInfo()` shows growing `pending_update_count` despite 200 responses
- Logs show your handler took > 60 s
- Users get duplicate messages (Telegram retried)

**Common causes**
- ❌ Synchronous LLM call / external API blocking the handler
- ❌ DB query without timeout, blocking on slow query
- ❌ Trying to do all the work inline instead of offloading

**Fix — offload to BullMQ, return 200 immediately:**
```ts
import { Queue } from 'bullmq';
const jobs = new Queue('bot-updates', { connection: { host: 'redis', port: 6379 } });

bot.on('message:text', async (ctx) => {
  // Fast: enqueue, ack immediately
  await jobs.add('handle-message', {
    chatId: ctx.chat!.id,
    userId: ctx.from!.id,
    text: ctx.message.text,
  }, {
    jobId: `msg-${ctx.update.update_id}`,           // idempotency
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 604800 },
  });
});
```
Worker processes the heavy work async. See `bullmq` skill.

---

## Mini App opens but `Telegram.WebApp` is undefined

**Symptoms**
- `window.Telegram.WebApp` is `undefined` in your Mini App page
- Frontend crashes immediately on load
- Works when opened via Telegram, broken when opened in regular browser

**Common causes**
- ❌ User opened the URL directly in a browser (not via Telegram client)
- ❌ Forgot to include `telegram-web-app.js` script
- ❌ Script loaded async with `defer` → app code runs first

**Fix — defensive check + script loaded BEFORE app:**
```html
<head>
  <!-- Load Telegram SDK first, NOT deferred -->
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
</head>
<body>
  <script>
    if (!window.Telegram || !window.Telegram.WebApp || !window.Telegram.WebApp.initData) {
      document.body.innerHTML = '<p>Open this page from inside Telegram.</p>';
    } else {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      // app boot
    }
  </script>
</body>
```
For Vite/Next.js: include the script in `index.html` / `<head>` directly, NOT via `next/script` with `strategy="lazyOnload"`.

---

## Session race condition under high concurrency (sequentialize miss)

**Symptoms**
- Two updates from same user race on `ctx.session` — second overwrites first's changes
- `ctx.session.count` increments by 1 instead of 2 after two quick messages
- Only happens under `@grammyjs/runner` concurrent processing

**Common causes**
- ❌ `sequentialize` installed AFTER `session` middleware
- ❌ Different keys for `sequentialize` and `session` (e.g., `chat.id` vs `from.id`)
- ❌ Forgot `sequentialize` entirely — runner processes 500 concurrent without serialization
- ❌ Using webhook (which has its own concurrency) without atomic Redis session updates

**Fix — sequentialize FIRST, matching session key:**
```ts
import { Bot, Context, session } from 'grammy';
import { run, sequentialize } from '@grammyjs/runner';
import { RedisAdapter } from '@grammyjs/storage-redis';

const getSessionKey = (ctx: Context) => ctx.chat?.id.toString();

const bot = new Bot<MyContext>(token);

// Step 1: sequentialize FIRST
bot.use(sequentialize(getSessionKey));

// Step 2: session — same key
bot.use(session({
  getSessionKey,
  initial: () => ({ count: 0 }),
  storage: new RedisAdapter({ instance: redis }),
}));

// Step 3: handlers
bot.command('count', (ctx) => {
  ctx.session.count++;
  return ctx.reply(`Count: ${ctx.session.count}`);
});

run(bot, { runner: { process: { concurrency: 200 } } });
```
For webhook mode at multi-instance: rely on atomic Redis ops (GET → modify → CAS via `WATCH/MULTI`), not in-memory locks.

---

## Stars subscription not renewing

**Symptoms**
- User subscribed via `sendInvoice` with `subscription_period: 2592000`
- 30 days elapsed, no recurring `successful_payment` arrived
- Telegram dashboard shows subscription as inactive

**Common causes**
- ❌ User cancelled in Telegram → Settings → Stars → Subscriptions
- ❌ User's Stars balance insufficient at renewal time
- ❌ `subscription_period` other than 2592000 (Telegram only supports 30-day cycles)
- ❌ Bot didn't register handler for the renewal `successful_payment` — fires same event as initial

**Fix**
```ts
// Same handler handles initial + renewal — distinguish via subscription_expiration_date
bot.on('message:successful_payment', async (ctx) => {
  const p = ctx.message.successful_payment!;
  const isRenewal = !!p.subscription_expiration_date;

  // Idempotent grant — same charge_id pattern
  await prisma.$transaction(async (tx) => {
    const exists = await tx.processedPayment.findUnique({
      where: { chargeId: p.telegram_payment_charge_id },
    });
    if (exists) return;
    await tx.processedPayment.create({ data: { chargeId: p.telegram_payment_charge_id } });
    await tx.subscription.upsert({
      where: { userId: ctx.from!.id },
      update: { expiresAt: new Date((p.subscription_expiration_date ?? 0) * 1000) },
      create: { userId: ctx.from!.id, expiresAt: new Date((p.subscription_expiration_date ?? 0) * 1000) },
    });
  });
});
```

---

## More symptoms?

If your symptom isn't listed, capture: the failing `GrammyError` (`error_code` + `description`), `getWebhookInfo()` output, env vars (redacted), and the update payload (sanitized). Most production issues fall into one of: TLS / port misconfig, secret_token mismatch, idempotency miss on payments, or `sequentialize`/`session` ordering. Re-check those four first.
