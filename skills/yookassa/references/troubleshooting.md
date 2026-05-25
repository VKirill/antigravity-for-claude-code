# Troubleshooting — yookassa

Symptom-indexed. Find what the user sees, follow the diagnosis steps, apply the fix. Required for `risk: high-stakes` skills per skill-evaluation v3.

> Defaults referenced below live in [recommended-defaults.md](recommended-defaults.md).

---

## Webhook IP allowlist drift (firewall blocks legitimate YooKassa traffic)

**Symptoms**
- Dashboard → "Integration → HTTP-notifications" shows red "delivery error" counters
- Application logs show NO inbound `POST /webhooks/yookassa` for several hours
- Edge logs (Angie/Nginx) show `403 forbidden` from unrecognized IPs
- Some events processed (cards) but not others (sometimes СБП), depending on the egress IP YooKassa picked

**Diagnose**
```bash
# 1. What the edge actually saw
sudo grep '/webhooks/yookassa' /var/log/angie/access.log | tail -50 | awk '{print $1}' | sort -u

# 2. Reverse-DNS the unknown source(s)
dig -x <suspicious-ip>

# 3. Pull current YooKassa changelog for new ranges
curl -s https://yookassa.ru/developers/using-api/changelog | grep -i 'IP\|notification' | head -20

# 4. Compare with what your firewall allows
sudo nft list chain inet filter input | grep -i yookassa
# or
sudo ufw status numbered | grep -E '185\.71|77\.75|2a02:5180'
```

**Common causes**
- ❌ Firewall config last updated before YooKassa added `2a02:5180::/32` (IPv6) or `77.75.156.{11,35}`
- ❌ Edge config copied from old project; IP list stale by >12 months
- ❌ Quarterly refresh skipped (see [recommended-defaults.md](recommended-defaults.md) cadence)

**Fix**
1. Re-read the canonical list from the YooKassa dashboard ("Интеграция → HTTP-уведомления") — that page is authoritative.
2. Update edge + application allowlists. Example Angie/Nginx:
```nginx
location /webhooks/yookassa {
    allow 185.71.76.0/27;
    allow 185.71.77.0/27;
    allow 77.75.153.0/25;
    allow 77.75.154.128/25;
    allow 77.75.156.11/32;
    allow 77.75.156.35/32;
    allow 2a02:5180::/32;
    deny all;
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header X-Real-IP $remote_addr;
}
```
3. Test: in dashboard, hit "Отправить тестовое уведомление" → confirm 200 in your app logs.
4. Schedule a quarterly cron reminder to re-verify against [yookassa.ru/developers/using-api/changelog](https://yookassa.ru/developers/using-api/changelog).

---

## Webhook arrived, but `GET /v3/payments/{id}` returns 404 (re-fetch race)

**Symptoms**
- Webhook handler logs: `payment.succeeded` event for `id=29084b71-...` then `404 not_found` on re-fetch
- A retry minutes later succeeds
- Customer sees "оплата прошла" but order stays `pending` for a while

**Diagnose**
```bash
# Replay the re-fetch manually
curl -sS -u $SHOP_ID:$SECRET_KEY https://api.yookassa.ru/v3/payments/29084b71-... | jq .
# If now returns 200, it was a transient race; if still 404, the id is invalid
```

**Common causes**
- ❌ Sub-second race between YooKassa fanning out the webhook and its read-after-write consistency on `/v3/payments/{id}` (rare but real)
- ❌ Webhook handler ran in a different region/account (test webhook → prod re-fetch with prod creds, or vice versa)
- ❌ Logged the payload, picked an `id` from a nested object (e.g. `payment_method.id`) instead of `object.id`

**Fix**
1. Implement bounded re-fetch retry per [recommended-defaults.md](recommended-defaults.md) (3 attempts, 500ms/1s/2s backoff). On final 404, requeue the webhook for delayed retry (BullMQ delay 30s).
2. Validate `object.id` is a UUID with Zod before calling `getPayment`.
3. Audit: any place reading `payment_method.id` and passing to `getPayment` is a bug.
```ts
// ❌ Wrong — confused field
const p = await checkout.getPayment(body.object.payment_method.id);

// ✅ Right — the payment id is on object itself
const p = await checkout.getPayment(body.object.id);
```

---

## Payment stuck in `waiting_for_capture` (no automatic capture)

**Symptoms**
- Dashboard shows hold count growing
- 7 days after creation, payments auto-flip to `canceled` with `cancellation_details.reason = 'expired_on_capture'`
- Customer card shows pending hold that vanishes after a week
- Merchant doesn't see settlement

**Diagnose**
```bash
# Pull recent waiting_for_capture payments
curl -sS -u $SHOP_ID:$SECRET_KEY 'https://api.yookassa.ru/v3/payments?status=waiting_for_capture&limit=50' | jq '.items[] | {id, created_at, expires_at, amount}'
```

**Common causes**
- ❌ Created with `capture: false` but no `payment.waiting_for_capture` webhook handler → nothing capturing
- ❌ Handler exists but only runs on `payment.succeeded` (wrong event)
- ❌ Capture logic threw and silently failed; no DLQ
- ❌ Misconception: YooKassa does NOT auto-capture in the dashboard — manual or API-driven only

**Fix**
1. Either default to `capture: true` for digital goods (immediate fulfillment), OR implement the `payment.waiting_for_capture` webhook handler:
```ts
async function onPaymentWaitingForCapture(payment: Payment) {
  const order = await db.order.findUnique({ where: { id: payment.metadata?.order_id } });
  if (!order || order.status === 'cancelled') {
    await checkout.cancelPayment(payment.id, `cancel-${payment.id}`);
    return;
  }
  await checkout.capturePayment(
    payment.id,
    { amount: payment.amount, receipt: buildReceipt(order) },
    `cap-${payment.id}`,  // stable idempotence key
  );
}
```
2. Add an alert when `getJobCounts('waiting_for_capture')` > threshold for > 1 hour.
3. Replay stuck holds via a one-shot script before they hit the 7-day window.

---

## `400 Bad Request` — Idempotence-Key reuse with different body

**Symptoms**
- `createPayment` / `createRefund` returns `400` with body like `{ "type": "error", "code": "invalid_request", "description": "Idempotence-Key already used with different request" }` (wording varies)
- Happens on retry after a code change between attempts
- Or on rebill where amount changed mid-cycle

**Diagnose**
```bash
# Confirm the cached body via the resource directly
curl -sS -u $SHOP_ID:$SECRET_KEY https://api.yookassa.ru/v3/payments/<id_from_cache>  | jq .

# Compare with what you're trying to send
diff <(echo "$cached_body" | jq -S .) <(echo "$new_body" | jq -S .)
```

**Common causes**
- ❌ Same key reused for a different amount (e.g., subscription price changed; same `cycleKey`)
- ❌ Idempotence-Key generated from `Date.now()` truncated to minute → collision under load
- ❌ Retry layer hashing only some fields into the key

**Fix**
1. Generate a fresh `crypto.randomUUID()` for genuinely new operations:
```ts
// ❌ Wrong — reusing key across body mutations
const key = `pay-${orderId}`;
await checkout.createPayment({ amount: { value: '500.00', ... }, ... }, key);
// later, with different amount
await checkout.createPayment({ amount: { value: '600.00', ... }, ... }, key); // 400

// ✅ Right — key scoped to (action, immutable inputs)
const key = `pay-${orderId}-v${attemptVersion}`;  // bump version on body change
```
2. Persist `(idempotenceKey, requestBodyHash)` pairs in your DB; before calling, assert match.
3. For genuine retries (same body), reuse the saved key — that's the whole point.

---

## Saved `payment_method_id` rejected on rebill

**Symptoms**
- First charge succeeded with `save_payment_method: true`
- Rebill via `payment_method_id` returns `payment.status: canceled` with `cancellation_details.reason` of `card_expired` / `permission_revoked` / `payment_method_restricted` / `fraud_suspected`
- Customer's bank app may show no decline (issuer-side silent)

**Diagnose**
```bash
# Inspect the failed payment
curl -sS -u $SHOP_ID:$SECRET_KEY https://api.yookassa.ru/v3/payments/<id> | jq '{ status, cancellation_details, payment_method }'
```

**Common causes per reason**
- `card_expired` — card's `expiry_month/expiry_year` passed; method id might still look valid but issuer declines
- `permission_revoked` — customer pulled consent (e.g. from issuer app's "recurring payments" list)
- `payment_method_restricted` — issuer-side hold / customer reported stolen
- `fraud_suspected` — YooKassa or issuer fraud signal; do NOT retry

**Fix**
1. Treat the reasons as terminal — stop scheduled rebills and trigger a "re-add card" flow:
```ts
const TERMINAL_REASONS = new Set([
  'card_expired',
  'permission_revoked',
  'payment_method_restricted',
  'fraud_suspected',
]);

async function onSubscriptionRebillFailed(payment: Payment) {
  const reason = payment.cancellation_details?.reason;
  if (reason && TERMINAL_REASONS.has(reason)) {
    await db.subscription.update({
      where: { id: payment.metadata!.subscription_id },
      data: { status: 'cancelled', lastFailureReason: reason },
    });
    await queue.add('email.re-add-card', { userId: payment.metadata!.user_id });
  }
}
```
2. Preemptively check card expiry on `bank_card` saves and prompt re-add ~30 days before expiry.

---

## СБП payment shows `succeeded` in dashboard but webhook never arrived

**Symptoms**
- Dashboard lists payment as `succeeded`
- Application has no record; `payment.succeeded` webhook never hit
- Customer sees money debited but order not fulfilled
- Other payment types (cards) deliver webhooks fine

**Diagnose**
```bash
# Is the webhook subscription configured for THIS event?
# Dashboard → Integration → HTTP notifications → verify "payment.succeeded" is enabled

# Pull recent successful payments and reconcile
curl -sS -u $SHOP_ID:$SECRET_KEY 'https://api.yookassa.ru/v3/payments?status=succeeded&limit=20' | jq '.items[] | {id, payment_method: .payment_method.type, created_at}'
```

**Common causes**
- ❌ The webhook delivery URL is on a host that recently failed a TLS check (expired cert) — YooKassa stops sending until you fix and re-enable
- ❌ Webhook subscription was for OAuth-token integration but the merchant is on HTTP Basic; the `POST /v3/webhooks` subscription is irrelevant — configure in dashboard instead
- ❌ Race on first-time СБП integration: handler returned 500 the first few times → YooKassa kept retrying for 24h then dropped
- ❌ App returned 200 but didn't actually persist — looks fine to YooKassa, missing in your DB

**Fix**
1. Reconcile a stuck CБП payment manually via API; YooKassa won't replay past the 24h retry window:
```ts
const p = await checkout.getPayment(paymentId);
if (p.status === 'succeeded') await onPaymentSucceeded(p);
```
2. Add a daily reconciliation job: list `succeeded` payments from YooKassa, diff against your DB, fire missing webhooks internally.
3. Ensure TLS cert auto-renew (certbot/acme.sh) is wired and monitored.

---

## 54-ФЗ receipt rejected by ОФД

**Symptoms**
- Payment succeeds but dashboard shows red "ОФД error" badge
- `GET /v3/receipts?payment_id=<id>` returns `status: 'canceled'` with an error code
- Customer didn't receive email/SMS with the fiscal receipt

**Diagnose**
```bash
curl -sS -u $SHOP_ID:$SECRET_KEY "https://api.yookassa.ru/v3/receipts?payment_id=<id>" | jq '.items[] | {status, error}'
```

**Common causes**
- ❌ `vat_code: 1` used for "НДС 0%" (wrong — that's `2`; `1` is "НДС не облагается")
- ❌ `quantity: "1"` instead of `"1.00"` / `"1.000"` (FFD wants explicit decimal)
- ❌ Missing both `customer.email` AND `customer.phone` — at least one is required
- ❌ Sum of `items[].amount.value × items[].quantity` ≠ `payment.amount.value`
- ❌ `tax_system_code` mismatch with merchant's registered СНО (if multiple configured)
- ❌ `measure` missing under FFD 1.2 for marked goods

**Fix**
1. Cross-check enums in [recommended-defaults.md](recommended-defaults.md) — esp. the `vat_code` 1–6 table.
2. Validate receipt before submitting:
```ts
const sumOfItems = items.reduce((s, i) => s + Number(i.amount.value), 0);
if (Math.abs(sumOfItems - Number(payment.amount.value)) > 0.01) {
  throw new Error(`receipt items total ${sumOfItems} != payment ${payment.amount.value}`);
}
if (!receipt.customer.email && !receipt.customer.phone) {
  throw new Error('receipt requires customer.email or customer.phone');
}
```
3. After ОФД rejection, issue a corrective `POST /v3/receipts` with the fix.

---

## `ENOTFOUND` / connection timeout from SDK

**Symptoms**
- `@a2seven/yoo-checkout` calls throw `getaddrinfo ENOTFOUND api.yookassa.ru` or hang past 30s
- Curl from the same host works fine
- Or: requests succeed locally but 403 in CI / production VPC

**Diagnose**
```bash
# DNS
dig api.yookassa.ru +short
# TCP
nc -zv api.yookassa.ru 443
# TLS
echo | openssl s_client -connect api.yookassa.ru:443 -servername api.yookassa.ru 2>&1 | grep -E '^(SSL handshake|Verify return code)'
# Sanity check the SDK is hitting the right host
node -e "const {YooCheckout} = require('@a2seven/yoo-checkout'); console.log(new YooCheckout({shopId:'1',secretKey:'test_x'}).root)"
# Expect: https://api.yookassa.ru/v3
```

**Common causes**
- ❌ Egress blocked by VPC NACL / corporate proxy
- ❌ `https_proxy` env var pointed at a proxy without TLS termination for `api.yookassa.ru`
- ❌ `NODE_TLS_REJECT_UNAUTHORIZED=0` masked a real cert issue earlier; intermittent failures now
- ❌ Confused with `https://yoomoney.ru` (consumer wallet API — different)

**Fix**
1. Confirm egress allows `api.yookassa.ru:443`. Common in RU-VPC setups: outbound to non-RU ranges blocked.
2. Remove `NODE_TLS_REJECT_UNAUTHORIZED=0` if set; fix the root CA chain instead.
3. Pin SDK version in `package.json`; some older `@a2seven/yoo-checkout` versions had bugs around proxy handling.

---

## Refund stuck in `pending`

**Symptoms**
- `POST /v3/refunds` returned `status: 'pending'` minutes/hours ago
- `refund.succeeded` webhook never fired
- Dashboard shows refund row with "в обработке" indefinitely

**Diagnose**
```bash
curl -sS -u $SHOP_ID:$SECRET_KEY https://api.yookassa.ru/v3/refunds/<id> | jq '{ status, payment_id, amount, description }'
```

**Common causes**
- Cross-rail refund (e.g., card-issued refund routes through Visa/MasterCard settlement which can take 1–3 business days)
- Issuer-side hold; YooKassa is waiting for confirmation
- СБП refund pending bank network confirmation
- Original `payment.payment_method.type` not refundable to that channel (rare; YooKassa would error at create-time normally)

**Fix**
1. Wait up to 5 business days before treating as broken — refund timing is rail-dependent.
2. Build a daily reconciler that polls `pending` refunds and fires `refund.succeeded` handlers when they flip.
3. If still pending after 5 business days, escalate via YooKassa support with `refund.id`.

---

## Signed-webhook signature mismatch (opt-in HMAC enabled)

**Symptoms**
- Account has Signing Secret enabled (newer tier)
- `X-Yookassa-Signature` header present but verification fails
- Some events verify fine, others fail — or all fail after a config change

**Diagnose**
```ts
// Log the raw inputs (not the secret) for one request
console.log({
  header: req.headers['x-yookassa-signature'],
  bodyLen: req.rawBody?.length,
  bodyFirst40: req.rawBody?.slice(0, 40),
});
```

**Common causes**
- ❌ Computing HMAC over `JSON.stringify(req.body)` (parsed/re-stringified) instead of raw bytes
- ❌ Fastify body-parser ran before raw-body capture → original bytes gone
- ❌ Secret stored with surrounding whitespace / quotes from `.env`
- ❌ Replay-window check too tight (clock skew between hosts > 5 minutes)

**Fix**
```ts
// Fastify — opt out of JSON parser for this route
app.post('/webhooks/yookassa', { config: { rawBody: true } }, async (req, reply) => {
  const sig = req.headers['x-yookassa-signature'] as string;
  if (!verifyYookassaSignature(req.rawBody, sig, env.YOOKASSA_SIGNING_SECRET)) {
    return reply.status(403).send();
  }
  // ... still re-fetch the payment afterwards
});
```
- Strip env secret on load: `env.YOOKASSA_SIGNING_SECRET = raw.trim()`.
- Set system NTP to enforce clock sync (`timedatectl status`).
- Always also do the IP allowlist + re-fetch — signature is additive defense, not a replacement.

---

## More symptoms?

Capture and attach to the support ticket / postmortem:
- `GET /v3/payments/<id>` body
- The webhook payload your handler received (sanitized)
- Edge access log line for the webhook IP
- YooKassa dashboard event-delivery counters for the same event
- App-side handler return code + processing time
