# Troubleshooting — cloudpayments

Symptom-indexed. Required for `risk: high-stakes` per skill-evaluation v3. Each entry: **Symptoms → Diagnose → Common causes → Fix (paste-runnable)**.

---

## HMAC verification fails on every webhook

**Symptoms**
- Every webhook from CloudPayments returns 403 from your handler
- `content-hmac` header is present in the request
- Test webhook from dashboard "Test" button also fails
- Locally with manual curl + crafted body, verification "works" → broken in production only

**Diagnose**
```bash
# 1. Capture a real webhook body (use ngrok dump or temporary file log)
# 2. Compute HMAC manually with the same key + body bytes
echo -n "$(cat captured-body.txt)" | openssl dgst -sha256 -hmac "$CP_API_SECRET" -binary | base64

# 3. Compare to the Content-HMAC header value in the captured request
# If different → encoding/body issue. If equal → handler is processing differently.
```

**Common causes**
- ❌ Body-parser middleware (`express.json()`, `@fastify/multipart`) consumes the stream BEFORE HMAC verification → `req.body` is parsed JSON, original bytes lost → HMAC computed over reformatted JSON ≠ what server signed
- ❌ Using `JSON.stringify(req.body)` to recompute HMAC — key order, whitespace, number format differs from original
- ❌ Wrong key — using `publicId` instead of `apiSecret`
- ❌ Production key vs sandbox key — using sandbox secret against production webhook
- ❌ Key rotated in dashboard but env variable not updated
- ❌ Base64 padding mismatch (rare; some libs drop `=` padding)

**Fix — Fastify**
```ts
import Fastify from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';

const app = Fastify();

// Register raw body capture BEFORE the route
app.addContentTypeParser(
  ['application/x-www-form-urlencoded', 'application/json'],
  { parseAs: 'buffer' },
  (_req, body, done) => done(null, body),
);

app.post('/webhooks/cp', async (req, reply) => {
  const sigHeader = req.headers['content-hmac'] as string | undefined;
  if (!sigHeader) return reply.code(403).send({ code: 1 });

  const expected = createHmac('sha256', process.env.CP_API_SECRET!)
    .update(req.body as Buffer)            // raw bytes, NOT parsed JSON
    .digest();
  const provided = Buffer.from(sigHeader, 'base64');

  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return reply.code(403).send({ code: 1 });
  }

  // Now safe to parse and process
  const params = new URLSearchParams((req.body as Buffer).toString('utf8'));
  // ...
  return { code: 0 };
});
```
Same pattern for Express via `express.raw({ type: '*/*' })` on the webhook route only.

---

## Check gate rejects valid payments

**Symptoms**
- `cp.CloudPayments({ publicId }).pay(...)` shows "Платёж отклонён"
- CloudPayments dashboard shows the Check webhook fired and your endpoint returned non-zero code
- Customer sees a generic decline without context

**Diagnose**
1. Open CloudPayments dashboard → Notifications log → find the Check call
2. Inspect the response body your endpoint returned

**Common causes**
- ❌ Your DB lookup for `InvoiceId` happens before the order is persisted (race condition with frontend)
- ❌ Idempotency dedup table treats Check as a duplicate of previous Pay attempt
- ❌ User session expired between widget open and Check arrival (5–15 min window)
- ❌ Wrong response code semantics: returning `{code: 13}` for transient errors when CloudPayments interprets non-zero as "reject this charge"

**Fix**
```ts
// Check gate response codes (from cloudpayments.ru/docs)
//   0  = OK, allow the charge
//   10 = invalid InvoiceId — reject permanently
//   11 = amount mismatch
//   12 = invalid AccountId (user not found)
//   13 = duplicate (already paid)
//   20 = generic decline (use for "not ready yet, retry later" too)
//
// For transient errors (DB not ready, race condition), return 500 from your handler
// — CloudPayments will retry. Never return 0 if you can't actually charge.
```

---

## Pay webhook never arrives

**Symptoms**
- Customer paid successfully (dashboard shows `Completed`)
- Your `webhooks/cp` endpoint never received a request
- No entry in CloudPayments Notifications log for this transaction's Pay event

**Common causes**
- ❌ CloudPayments source IP not whitelisted at firewall (Angie/nginx/Cloudflare) — request silently dropped at edge
- ❌ Your handler returned non-200 to a previous webhook → CloudPayments suspended deliveries to this URL (auto-disable after N failures)
- ❌ HTTPS cert expired or self-signed in production — CloudPayments rejects untrusted TLS
- ❌ HTTP 1.0 only — CloudPayments expects HTTP/1.1+
- ❌ Webhook URL in dashboard points to staging, not prod

**Diagnose**
```bash
# Confirm endpoint is publicly reachable
curl -X POST https://yourdomain.com/webhooks/cp -d 'TestField=1' -i

# Confirm CloudPayments IPs aren't blocked
ufw status | grep -E '91\.142\.84|130\.193\.51'  # current published ranges — re-check quarterly

# Check Notifications log in dashboard for "Server returned status X" / "Connection refused"
```

**Fix**
- Whitelist CloudPayments IPs (published in dashboard → Technical → IP addresses)
- In dashboard → Notifications → re-enable the URL if auto-suspended
- Renew TLS cert (`certbot renew`) and verify chain

---

## Duplicate Pay webhooks → double-grant access

**Symptoms**
- User got two emails / two access grants for one payment
- Log shows the same `TransactionId` Pay webhook processed twice within seconds

**Common causes**
- ❌ Your handler did the side-effect BEFORE persisting the dedup row → second concurrent webhook didn't see the dedup
- ❌ No `TransactionId`-based idempotency key
- ❌ DB transaction not committed before the side-effect (you await `prisma.event.create({...})` but then await `email.send(...)` outside the transaction)

**Fix**
```ts
// Idempotent Pay handler — wrap side effects in a transaction that includes the dedup row
await prisma.$transaction(async (tx) => {
  const existing = await tx.processedWebhook.findUnique({
    where: { txId: params.get('TransactionId') ?? '' },
  });
  if (existing) return;  // already processed

  await tx.processedWebhook.create({
    data: { txId: params.get('TransactionId')!, processedAt: new Date() },
  });

  // Side effects INSIDE the transaction — if any fail, the dedup row rolls back too
  await tx.subscription.create({ /* grant access */ });
});

// Queue email send OUTSIDE the transaction but AFTER it commits
await mailQueue.add('payment-confirmation', { userId, txId });
```
Use `removeOnComplete`-bounded BullMQ queue for the email step — see `bullmq` skill.

---

## 3-D Secure stuck (popup never returns)

**Symptoms**
- Widget shows 3DS iframe / redirect → spinner forever
- Browser console shows postMessage origin mismatch
- Customer sees blank page after returning from bank ACS

**Common causes**
- ❌ CSP blocks the 3DS frame source (`frame-src` doesn't include CloudPayments / bank ACS domains)
- ❌ Mobile Safari intelligent tracking blocks cross-site cookies on return
- ❌ `return_url` (when using server-side `cp.charge`) points to dev/staging from production
- ❌ Popup blocker (rare with widget; common with custom integrations)

**Fix**
- CSP allow-list: `frame-src 'self' https://widget.cloudpayments.ru https://*.bank-acs.* https://acs.cloudpayments.ru`
- Use post-redirect-get pattern with `return_url` and a server-side state lookup, not in-popup completion
- Test 3DS flow on real mobile devices, not just desktop

---

## Recurring rebill silently fails

**Symptoms**
- Subscription dashboard shows "Active"
- Expected charge date passed, no Recurrent webhook arrived
- User wasn't charged

**Common causes**
- ❌ Saved token expired (card replaced, card lost, issuer rotated PAN)
- ❌ Issuer declined the recurring charge for fraud signals (3DS step-up required)
- ❌ Subscription status changed to `Cancelled` after dashboard inactivity (rare; check audit log)
- ❌ `MaxPeriods` reached — subscription auto-completed
- ❌ Customer's account in your system marked as deleted but subscription not cancelled with CloudPayments → orphan subscription

**Diagnose**
```bash
# Check subscription state via API
curl -X POST https://api.cloudpayments.ru/subscriptions/get \
  -u "$CP_PUBLIC_ID:$CP_API_SECRET" \
  -d "Id=$SUBSCRIPTION_ID"
```

**Fix**
- Listen to `Fail` webhook (not just `Pay`/`Recurrent`) — fired when rebill declines
- On `Fail`, surface a "Update payment method" prompt to the user, retry once with explicit charge
- On dashboard "Cancelled" status, mark the subscription dead in your DB and prompt re-subscription

---

## 54-ФЗ receipt rejected by OFD

**Symptoms**
- Pay webhook succeeded but customer didn't get a receipt
- CloudPayments dashboard shows "Receipt error" for the transaction
- OFD log shows validation failure

**Common causes**
- ❌ `Vat` value not in enum (only `null` / `0` / `10` / `20` are valid)
- ❌ Missing `CustomerEmail` AND `CustomerPhone` (at least one is required)
- ❌ `Items[].Price * Quantity !== Amount` arithmetic mismatch (sum must match total)
- ❌ `taxationSystem` set to a value that doesn't match your registered system (e.g., set USN-6 when registered ОСН)
- ❌ Item name > 128 chars or non-Cyrillic characters that the FN can't render

**Fix**
- Validate the CustomerReceipt shape with Zod before sending — see `templates/customer-receipt.ts.template`
- Always send `CustomerEmail`; phone as fallback only
- Keep arithmetic in kopecks internally, convert to rubles at the boundary

---

## Sandbox vs production confusion

**Symptoms**
- Test card `4242 4242 4242 4242` works in dev, real card fails with "Invalid card"
- Webhook signatures don't match in prod even though they matched in dev

**Common causes**
- ❌ Mixed env vars — `CP_PUBLIC_ID` is sandbox but `CP_API_SECRET` is production (or vice versa)
- ❌ Widget script URL pinned to sandbox (`https://widget.cloudpayments.tld/test-bundles/...`) in production build
- ❌ `cp.charge` endpoint targets sandbox base URL in production

**Fix**
- Use ONE pair of env vars per environment, validated at boot:
  ```ts
  import { z } from 'zod';
  const env = z.object({
    CP_PUBLIC_ID: z.string().regex(/^pk_(test_)?[a-f0-9]{32}$/),
    CP_API_SECRET: z.string().min(32),
    CP_ENV: z.enum(['sandbox', 'production']),
  }).parse(process.env);
  // Reject startup if test publicId is paired with prod secret or env mismatch
  ```

---

## IP allowlist drift

**Symptoms**
- Webhooks worked for months, suddenly stop in production
- Firewall log shows incoming POST blocked from new IP

**Common causes**
- ❌ CloudPayments added new edge IPs without notice
- ❌ Your IP allowlist was hard-coded a year ago, never updated

**Fix**
- Schedule quarterly review: fetch published list from dashboard → diff vs firewall config → reconcile
- Add a structured log when blocking POSTs to `/webhooks/cp` so anomalies surface fast
- Prefer HMAC verification (cryptographic) as primary defense; IP allowlist as defense-in-depth, not the only gate

---

## More symptoms?

If your symptom isn't listed, capture: full webhook payload (sanitized), CloudPayments Notifications log entry, your handler's response, and timing of the failure. Most production issues fall into one of: raw-body lost, IP allowlist drift, HMAC key mismatch, or idempotency miss. Re-check those four first.
