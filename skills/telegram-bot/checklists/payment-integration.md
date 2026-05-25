# Payment Integration Checklist

Run this before enabling payment features (Stars XTR or Payments 2.0).

---

## Decision: Stars vs Payments 2.0

Choose based on use case:

| Factor | Stars (XTR) | Payments 2.0 (fiat) |
|---|---|---|
| What you're selling | Digital goods, subscriptions, in-bot content | Physical goods, services with shipping |
| Currency | Stars (Telegram's virtual currency) | Real currencies (USD, EUR, RUB, etc.) |
| Payment provider | None — Telegram handles it | Required (Stripe, Payme, etc.) |
| Telegram commission | ~30% | None (provider fees apply) |
| Refunds | Via `refundStarPayment` API (within 30 days) | Via payment provider dashboard |
| Setup complexity | Minimal | Requires BotFather provider setup |

- [ ] Decision documented: **Stars / Payments 2.0 / Both**

---

## Stars (XTR) setup

- [ ] Invoice uses `currency: "XTR"` — no `provider_token`
- [ ] `amount` is in Stars units (whole numbers), NOT cents
- [ ] `is_flexible: false` — Stars invoices do not support flexible amounts
- [ ] `subscription_period` set (2592000 seconds = 30 days) if implementing subscriptions
- [ ] `pre_checkout_query` handler registered — always responds within 10 s
- [ ] For Stars, `pre_checkout_query` just calls `answerPreCheckoutQuery(true)` — no server-side inventory check needed
- [ ] `successful_payment` handler registered before the bot starts

---

## Payments 2.0 (fiat) setup

- [ ] Payment provider configured in BotFather: `/mybots → Payments → Add Provider`
- [ ] `PAYMENT_PROVIDER_TOKEN` set in env — different for test and production
- [ ] Stripe test mode used in staging environment
- [ ] `currency` is an ISO 4217 code (USD, EUR, etc.) — NOT "XTR"
- [ ] `amount` is in smallest currency unit (cents for USD, kopecks for RUB, etc.)
- [ ] `shipping_query` handler registered if `is_flexible: true` (physical shipping)
- [ ] `shipping_query` handler responds within 10 s with valid `ShippingOption[]`
- [ ] `pre_checkout_query` handler validates order and responds within 10 s

---

## successful_payment handler (both systems)

- [ ] Handler is idempotent — uses `telegram_payment_charge_id` as the deduplication key
- [ ] Payment is recorded to the database BEFORE granting access
- [ ] `telegram_payment_charge_id` is stored as PRIMARY KEY (prevents duplicate grant)
- [ ] Access is granted ONLY in `successful_payment`, never in `pre_checkout_query`
- [ ] User receives a confirmation message after successful grant
- [ ] Handler tested with a real payment in test/sandbox mode

---

## Refund flow

- [ ] Refund mechanism exists (admin command or dashboard)
- [ ] For Stars: `refundStarPayment(userId, chargeId)` implemented
- [ ] Stars refund only works within 30 days — age check added before attempt
- [ ] Refund revokes the granted access (premium flag cleared)
- [ ] Refund is recorded in database with `refunded_at` timestamp
- [ ] Error handling for already-refunded or expired charge IDs

---

## Testing

- [ ] Full payment flow tested end-to-end in development (Stripe test mode or small real Stars)
- [ ] `successful_payment` handler tested with a real payment — access granted correctly
- [ ] Duplicate `successful_payment` update tested — idempotency confirmed (no double-grant)
- [ ] Refund tested — access revoked after refund
- [ ] `pre_checkout_query` timeout tested — what happens if handler is slow?
- [ ] Database schema reviewed — `payments` table has PRIMARY KEY on `telegram_payment_charge_id`

---

## Pre-launch acceptance

- [ ] Send test invoice via `/buy` command — invoice message appears in Telegram
- [ ] Tap "Pay" — payment dialog opens with correct title, amount, and description
- [ ] Complete payment — `successful_payment` update received and processed
- [ ] Premium access confirmed active for the test user
- [ ] Log shows: chargeId recorded, grant applied, confirmation sent
- [ ] Duplicate the `successful_payment` update manually — idempotency confirmed in logs

---

## Self-check (model verifies before declaring done)

- [ ] No access grant in `pre_checkout_query` — only validation
- [ ] No `provider_token` for Stars invoices
- [ ] Stars amounts are whole numbers, not multiplied by 100
- [ ] `answerPreCheckoutQuery` is always called (even for rejection cases)
- [ ] `telegram_payment_charge_id` stored as PK or unique constraint
