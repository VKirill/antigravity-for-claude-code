# End-to-End Stars (XTR) Payment Flow

## Scenario

A user types `/buy` to purchase 30-day premium access. The bot:
1. Sends a Stars invoice
2. Handles `pre_checkout_query` (auto-approve for Stars)
3. Handles `successful_payment` — grants access exactly once (idempotency)
4. Shows how to issue a refund

**No payment provider token required for Stars.**

---

## Step 1 — Bot sends a Stars invoice

```typescript
// commands/buy.ts
import { Bot } from "grammy";
import type { MyContext } from "../types";

export function registerBuyCommand(bot: Bot<MyContext>) {
  bot.command("buy", async (ctx) => {
    if (!ctx.from) return;

    await ctx.replyWithInvoice(
      "Premium Access",                                    // title (≤ 32 chars)
      "Unlock all premium features for 30 days",          // description (≤ 255 chars)
      JSON.stringify({                                     // payload — returned unchanged in successful_payment
        type: "premium_30d",
        userId: ctx.from.id,
        issuedAt: Date.now(),
      }),
      "XTR",                                              // currency = Stars
      [{ label: "Premium (30 days)", amount: 100 }],      // amount = Stars count, NOT cents
      {
        // No provider_token for Stars
        start_parameter: "buy_premium",                   // optional: enables deep link ?start=buy_premium
        photo_url: "https://your-domain.com/premium.jpg", // optional invoice image
        photo_width: 512,
        photo_height: 512,
        protect_content: false,
        // subscription_period: 2592000,                 // uncomment for auto-renewing subscription
      }
    );
  });
}
```

---

## Step 2 — Handle `pre_checkout_query` (within 10 seconds)

For Stars, Telegram handles payment automatically. You must still answer within 10 s.

```typescript
// handlers/pre-checkout.ts
import { Bot } from "grammy";
import type { MyContext } from "../types";

export function registerPreCheckoutHandler(bot: Bot<MyContext>) {
  bot.on("pre_checkout_query", async (ctx) => {
    const query = ctx.preCheckoutQuery;

    // For Stars (XTR): no inventory check needed — just approve
    if (query.currency === "XTR") {
      await ctx.answerPreCheckoutQuery(true);
      return;
    }

    // For Payments 2.0 (fiat): validate the order here
    // const payload = JSON.parse(query.invoice_payload);
    // const valid = await db.checkInventory(payload.orderId);
    // await ctx.answerPreCheckoutQuery(valid, valid ? undefined : "Item unavailable");
  });
}
```

---

## Step 3 — Handle `successful_payment` (idempotency required)

```typescript
// handlers/successful-payment.ts
import { Bot } from "grammy";
import type { MyContext } from "../types";
import { db } from "../db";
import { logger } from "../logger";

export function registerPaymentHandler(bot: Bot<MyContext>) {
  bot.on("message:successful_payment", async (ctx) => {
    if (!ctx.from || !ctx.message.successful_payment) return;

    const payment = ctx.message.successful_payment;

    // Extract your payload
    const payload = JSON.parse(payment.invoice_payload) as {
      type: string;
      userId: number;
      issuedAt: number;
    };

    // Idempotency key — prevents double-granting on retried updates
    const chargeId = payment.telegram_payment_charge_id;

    const alreadyProcessed = await db.paymentExists(chargeId);
    if (alreadyProcessed) {
      logger.warn({ chargeId }, "Duplicate payment update — skipping");
      await ctx.reply("Your premium is already active!");
      return;
    }

    // Record payment then grant access atomically
    await db.recordPayment({
      chargeId,                                    // PRIMARY KEY — prevents duplicates
      userId: ctx.from.id,
      starsAmount: payment.total_amount,
      currency: payment.currency,                  // "XTR"
      payload: payment.invoice_payload,
      processedAt: new Date(),
    });

    await db.grantPremium(ctx.from.id, 30);        // grant 30 days

    logger.info(
      { userId: ctx.from.id, chargeId, amount: payment.total_amount },
      "Stars payment processed"
    );

    await ctx.reply(
      `Payment successful! ${payment.total_amount} Stars received.\n\n` +
      `Your 30-day premium is now active. Use /status to check.`
    );
  });
}
```

---

## Step 4 — Refund a Stars payment

Stars can be refunded within 30 days via `refundStarPayment`.

```typescript
// admin/refund.ts — admin-only command
import { Bot } from "grammy";
import type { MyContext } from "../types";
import { db } from "../db";

export function registerRefundCommand(bot: Bot<MyContext>) {
  // Example: /refund <chargeId>
  bot.command("refund", async (ctx) => {
    const adminIds = process.env.ADMIN_USER_IDS!.split(",").map(Number);
    if (!ctx.from || !adminIds.includes(ctx.from.id)) {
      await ctx.reply("Unauthorized.");
      return;
    }

    const chargeId = ctx.match?.trim();
    if (!chargeId) {
      await ctx.reply("Usage: /refund <telegram_payment_charge_id>");
      return;
    }

    const payment = await db.getPaymentByChargeId(chargeId);
    if (!payment) {
      await ctx.reply("Payment not found.");
      return;
    }

    try {
      await ctx.api.refundStarPayment(payment.userId, chargeId);
      await db.markPaymentRefunded(chargeId);
      await db.revokePremium(payment.userId);
      await ctx.reply(`Refunded ${payment.starsAmount} Stars to user ${payment.userId}.`);
    } catch (err) {
      // Error if > 30 days or already refunded
      await ctx.reply(`Refund failed: ${(err as Error).message}`);
    }
  });
}
```

---

## Wiring it all together

```typescript
// bot.ts
import { Bot } from "grammy";
import type { MyContext } from "./types";
import { registerBuyCommand } from "./commands/buy";
import { registerPreCheckoutHandler } from "./handlers/pre-checkout";
import { registerPaymentHandler } from "./handlers/successful-payment";
import { registerRefundCommand } from "./admin/refund";

const bot = new Bot<MyContext>(process.env.BOT_TOKEN!);

registerBuyCommand(bot);
registerPreCheckoutHandler(bot);
registerPaymentHandler(bot);
registerRefundCommand(bot);

bot.start();
```

---

## Database schema (minimal)

```sql
-- Required for idempotency
CREATE TABLE payments (
  charge_id   TEXT PRIMARY KEY,              -- telegram_payment_charge_id
  user_id     BIGINT NOT NULL,
  stars_amount INT NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'XTR',
  payload     JSONB,
  refunded_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE premium_subscriptions (
  user_id     BIGINT PRIMARY KEY,
  expires_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Common mistakes

| Mistake | Fix |
|---|---|
| Granting access in `pre_checkout_query` | Grant ONLY in `successful_payment` |
| Not answering `pre_checkout_query` within 10 s | Always answer even if just `answerPreCheckoutQuery(true)` |
| No idempotency check | Use `telegram_payment_charge_id` as PRIMARY KEY |
| Using `amount` in cents for Stars | Stars amounts are whole units (100 = 100 Stars, not $1.00) |
| Calling `refundStarPayment` after 30 days | Check age before attempting; handle error gracefully |
