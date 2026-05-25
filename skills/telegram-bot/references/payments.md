# Telegram Payments Reference

> Source: https://core.telegram.org/bots/api#payments · https://core.telegram.org/bots/payments
> Bot API version: 10.0 (May 2026)

---

## Two Payment Systems

| System | Currency | Purpose | Commission |
|--------|----------|---------|------------|
| **Telegram Stars** | XTR (Stars) | Digital goods, subscriptions, in-bot purchases | Telegram takes ~30% |
| **Payments 2.0** | Real currencies (USD, EUR, etc.) | Physical goods & services | No Telegram commission; payment processor fees apply |

---

## Telegram Stars (XTR)

Stars is Telegram's native digital currency for bot monetization. Users purchase Stars through Telegram and spend them in bots. No external payment provider required.

### Stars Invoice Flow

```
1. Bot sends invoice with currency="XTR"
2. User taps "Pay N ⭐" in Telegram
3. Stars deducted from user balance
4. Bot receives successful_payment update
```

```typescript
// Send Stars invoice
await ctx.replyWithInvoice(
  "Premium Feature",                          // title
  "Unlock the premium tier for 30 days",      // description
  JSON.stringify({ feature: "premium_30d" }), // payload (returned in successful_payment)
  "XTR",                                      // currency — Stars
  [{ label: "Premium (30 days)", amount: 250 }], // prices in Stars (not cents!)
  {
    // No provider_token needed for Stars
    start_parameter: "premium",               // optional deep link
    photo_url: "https://example.com/img.png", // optional invoice image
    photo_size: 512,
    photo_width: 512,
    photo_height: 512,
    is_flexible: false,                       // Stars invoices are never flexible
  }
);
```

### Stars: Pre-checkout (no action needed)

For Stars invoices, Telegram handles pre-checkout automatically. However, if you register a `pre_checkout_query` handler, you must answer within 10 seconds:

```typescript
// For Stars, simply always approve
bot.on("pre_checkout_query", (ctx) =>
  ctx.answerPreCheckoutQuery(true)
);
```

### Stars: Successful Payment

```typescript
bot.on("message:successful_payment", async (ctx) => {
  const payment = ctx.message.successful_payment!;
  
  // payment.currency === "XTR"
  // payment.total_amount — number of Stars paid
  // payment.telegram_payment_charge_id — Telegram transaction ID
  // payment.invoice_payload — your JSON payload from sendInvoice
  
  const payload = JSON.parse(payment.invoice_payload);
  
  await db.grantAccess(ctx.from!.id, payload.feature);
  await ctx.reply(`Payment successful! ${payment.total_amount} ⭐ received.`);
});
```

### Stars: Refund

```typescript
// Refund a Stars payment (within 30 days)
await bot.api.refundStarPayment(
  userId,
  telegramPaymentChargeId  // from successful_payment.telegram_payment_charge_id
);
```

### Subscription Invoices (Stars)

```typescript
await ctx.replyWithInvoice(
  "Monthly Subscription",
  "Auto-renews every month",
  JSON.stringify({ plan: "monthly" }),
  "XTR",
  [{ label: "Monthly", amount: 100 }],
  {
    subscription_period: 2592000,  // 30 days in seconds
  }
);
```

---

## Telegram Payments 2.0 (Fiat)

For real-money transactions. Telegram doesn't collect payment info; you integrate a provider (Stripe, Payme, etc.).

### Provider Setup

1. Add a payment provider in BotFather: `/mybots → Payments`
2. Receive `provider_token` for your chosen provider
3. Test with Stripe test token: `stripe` test environment

### Fiat Invoice Flow

```
1. Bot sends invoice with provider_token
2. User fills payment form (credit card / Apple Pay / Google Pay)
3. Bot receives shipping_query (if flexible shipping)
4. Bot answers shipping_query with delivery options + prices
5. Bot receives pre_checkout_query — must answer within 10 seconds
6. Bot validates order, answers pre_checkout_query(ok=true) or rejects
7. Telegram charges user, bot receives successful_payment
```

### Fiat Invoice

```typescript
await ctx.replyWithInvoice(
  "Widget Pro",
  "A high-quality widget",
  JSON.stringify({ orderId: "order-123", item: "widget-pro" }),
  "USD",                    // real ISO currency code
  [
    { label: "Widget", amount: 999 },      // amount in smallest unit (cents)
    { label: "Shipping", amount: 200 },
  ],
  {
    provider_token: process.env.PAYMENT_PROVIDER_TOKEN!,
    need_name: true,
    need_phone_number: false,
    need_email: true,
    need_shipping_address: true,
    is_flexible: true,       // enables shipping query
    send_phone_number_to_provider: false,
    send_email_to_provider: true,
  }
);
```

### Shipping Query Handler

```typescript
bot.on("shipping_query", async (ctx) => {
  const address = ctx.shippingQuery.shipping_address;
  
  // Calculate shipping options based on address
  await ctx.answerShippingQuery(true, [
    {
      id: "standard",
      title: "Standard Shipping",
      prices: [{ label: "Standard", amount: 500 }],
    },
    {
      id: "express",
      title: "Express Shipping",
      prices: [{ label: "Express", amount: 1500 }],
    },
  ]);

  // Or reject with error
  // await ctx.answerShippingQuery(false, undefined, "Cannot ship to this address");
});
```

### Pre-Checkout Handler

```typescript
bot.on("pre_checkout_query", async (ctx) => {
  const query = ctx.preCheckoutQuery;
  
  // Validate order, check inventory, etc.
  const payload = JSON.parse(query.invoice_payload);
  const isValid = await db.validateOrder(payload.orderId);
  
  if (isValid) {
    await ctx.answerPreCheckoutQuery(true);
  } else {
    await ctx.answerPreCheckoutQuery(false, "Order no longer available");
  }
  // Must respond within 10 seconds or transaction is cancelled
});
```

### Successful Payment (Fiat)

```typescript
bot.on("message:successful_payment", async (ctx) => {
  const payment = ctx.message.successful_payment!;
  
  // payment.currency           — "USD" etc.
  // payment.total_amount       — total in smallest currency unit (cents)
  // payment.invoice_payload    — your payload from sendInvoice
  // payment.shipping_option_id — chosen shipping option ID
  // payment.order_info         — name, email, phone, shipping_address
  // payment.telegram_payment_charge_id  — Telegram's transaction ID
  // payment.provider_payment_charge_id  — payment provider's transaction ID
  
  const payload = JSON.parse(payment.invoice_payload);
  await db.fulfillOrder(payload.orderId, payment.shipping_option_id);
  await ctx.reply("Thank you for your purchase!");
});
```

---

## Inline Invoices

Send invoices via inline mode so users can share payment requests:

```typescript
bot.on("inline_query", async (ctx) => {
  await ctx.answerInlineQuery([
    {
      type: "article",
      id: "invoice-1",
      title: "Pay for Widget",
      input_message_content: {
        // NOT supported inline — use InputInvoiceMessageContent:
      },
      // Use InlineQueryResultArticle with invoice content directly:
    }
  ]);
});

// Or use createInvoiceLink to get a shareable URL:
const link = await bot.api.createInvoiceLink(
  "Widget Pro",
  "Description",
  JSON.stringify({ item: "widget" }),
  "USD",
  [{ label: "Widget", amount: 999 }],
  { provider_token: process.env.PAYMENT_PROVIDER_TOKEN! }
);
// Share this link anywhere — opens payment dialog
```

---

## Paid Media (Stars)

Sell media content (photos, videos) locked behind a Stars paywall:

```typescript
// Send paid media requiring Stars to view
await bot.api.sendPaidMedia(
  chatId,
  150,   // star_count — price in Stars
  [
    { type: "photo", media: photoFileId },
    { type: "video", media: videoFileId },
  ],
  { caption: "Exclusive content!" }
);

// Received update: Message.paid_star_count — Stars paid for this message
```

---

## Stars Payout / Withdrawal

Bots accumulate Stars from digital sales. Withdrawal is done via Telegram's bot management UI, not the Bot API. Track earnings via:

```typescript
// No direct API method — use Telegram's @BotFather or admin UI
// Stars balance displayed in bot statistics
```

---

## grammY Payment Pattern (Stars)

Complete Stars payment flow with grammY:

```typescript
import { Bot } from "grammy";

const bot = new Bot(process.env.BOT_TOKEN!);

bot.command("buy", async (ctx) => {
  await ctx.replyWithInvoice(
    "Premium Access",
    "30-day premium access",
    JSON.stringify({ type: "premium", userId: ctx.from!.id }),
    "XTR",
    [{ label: "Premium 30d", amount: 100 }]
  );
});

bot.on("pre_checkout_query", (ctx) =>
  ctx.answerPreCheckoutQuery(true)
);

bot.on("message:successful_payment", async (ctx) => {
  const { invoice_payload, total_amount, telegram_payment_charge_id } = 
    ctx.message.successful_payment!;
  const payload = JSON.parse(invoice_payload);
  
  await db.grantPremium(payload.userId, 30);
  await ctx.reply(`✅ ${total_amount} Stars received! Premium activated.`);
});

bot.start();
```
