# YooKassa — Security & PCI

## PCI DSS scope

YooKassa is a PCI DSS Level 1 service provider. Merchant scope depends on integration:

| Integration | SAQ | Notes |
|---|---|---|
| Hosted payment page (`confirmation: redirect`) | **SAQ A** | Lowest. No widget JS, just a redirect URL. |
| Embedded widget (Checkout.js) | **SAQ A-EP** | Widget renders inside merchant page via iframe. |
| Custom UI with `/v3/payment_methods` create | SAQ A-EP / D | Higher scope — avoid unless required. |

Stay in SAQ A or A-EP. Never accept raw PAN/CVV on merchant servers.

## Secret Key

Server-only. Two modes:

```bash
# .env (gitignored)
YOOKASSA_SHOP_ID=123456
YOOKASSA_SECRET_KEY=live_xxxxxxxxxxxxxxxxxxxxxxx
# or for sandbox:
# YOOKASSA_SECRET_KEY=test_xxxxxxxxxxxxxxxxxxxxxxx
```

```ts
import { z } from 'zod';

export const env = z.object({
  YOOKASSA_SHOP_ID: z.string().regex(/^\d+$/),
  YOOKASSA_SECRET_KEY: z.string().regex(/^(live|test)_/),
}).parse(process.env);
```

Rotation: dashboard → API → Secret Key → regenerate. Old key invalidated immediately; coordinate deploy.

## Default authenticity model — IP allowlist + re-fetch

YooKassa does NOT include an HMAC signature on webhook calls by default. Authentication is layered:

### Layer 1: IP allowlist

YooKassa publishes a set of IP ranges from which webhook calls originate (dashboard → API → "IP-адреса для получения уведомлений"). Whitelist them:

```ts
const YOOKASSA_IP_RANGES = [
  // Current as of skill generation — verify in dashboard:
  '185.71.76.0/27',
  '185.71.77.0/27',
  '77.75.153.0/25',
  '77.75.156.11',
  '77.75.156.35',
  '77.75.154.128/25',
  '2a02:5180::/32',
];

import ipaddr from 'ipaddr.js';

export function isYookassaIp(ip: string): boolean {
  const parsed = ipaddr.parse(ip);
  return YOOKASSA_IP_RANGES.some((range) => {
    const [addr, bits] = range.split('/');
    if (!bits) return parsed.toString() === addr;
    return parsed.match(ipaddr.parseCIDR(range as `${string}/${number}`));
  });
}
```

Better: enforce at the edge (Angie/Nginx/UFW). Then the application is defence-in-depth.

### IP allowlist as sole defense vs defense-in-depth

**❌ Wrong — IP allowlist treated as the only authentication:**
```ts
app.post('/webhooks/yookassa', async (req, reply) => {
  if (!isYookassaIp(req.ip)) return reply.status(403).send();
  // Trust everything that survived the IP check
  await db.order.update({
    where: { id: req.body.object.metadata.order_id },
    data: { status: 'paid' },
  });
  return reply.status(200).send();
});
```

**✅ Right — IP allowlist + re-fetch + idempotent persistence:**
```ts
app.post('/webhooks/yookassa', async (req, reply) => {
  // Layer 1: IP (defense-in-depth above edge firewall)
  if (!isYookassaIp(req.ip)) return reply.status(403).send();

  // Layer 2: schema validation (rejects malformed payloads early)
  const body = WebhookSchema.parse(req.body);

  // Layer 3: dedup (same event can arrive 2+ times)
  const dedup = await db.webhookEvent.create({
    data: { id: `${body.event}:${body.object.id}` },
  }).catch(() => null);
  if (!dedup) return reply.status(200).send();

  // Layer 4: re-fetch — authoritative state via secret-key API call
  const payment = await checkout.getPayment(body.object.id);
  await handleEvent(body.event, payment);

  return reply.status(200).send();
});
```

**Why it matters:** YooKassa publishes IP ranges, but those ranges sit on shared infrastructure that other services use. An attacker who lands on the same AWS/cloud /24 by chance, or routes through a misconfigured upstream proxy that rewrites `X-Forwarded-For`, satisfies the IP check trivially. The re-fetch is what makes the auth model sound — it requires the secret key. IP is for traffic shaping, not authentication.

```nginx
location /webhooks/yookassa {
    allow 185.71.76.0/27;
    allow 185.71.77.0/27;
    allow 77.75.153.0/25;
    allow 77.75.156.11;
    allow 77.75.156.35;
    allow 77.75.154.128/25;
    allow 2a02:5180::/32;
    deny all;

    proxy_pass http://127.0.0.1:3000;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### Layer 2: Re-fetch payment

Before mutating order state, call `GET /v3/payments/{object.id}` and trust THAT. The webhook is just a wake-up call.

```ts
app.post('/webhooks/yookassa', async (req, reply) => {
  if (!isYookassaIp(req.ip)) return reply.status(403).send();

  const body = WebhookSchema.parse(req.body);

  // Authoritative state from API
  const payment = await checkout.getPayment(body.object.id);

  // Now safe — payment.status, payment.amount, payment.metadata are all authoritative
  await handleEvent(body.event, payment);

  return reply.status(200).send();
});
```

Why re-fetch?
- Webhook payload is not signed → could in theory be forged
- Webhook may be delayed; payment state could have advanced
- Mid-air state changes (e.g., merchant cancelled in dashboard between webhook send and receive)

This is the **canonical YooKassa pattern**.

## Layer 3: Opt-in Signing Secret (newer accounts)

Available since 2024 for select tiers. Dashboard provides a Signing Secret; webhooks include `X-Yookassa-Signature` header (format may evolve — check current docs).

If signing is enabled, verify it as a third layer:

```ts
import crypto from 'node:crypto';

function verifySignature(rawBody: string, header: string, secret: string): boolean {
  // Header format: "t=<unix_ts>,v1=<hex_hmac_sha256>"
  const parts = Object.fromEntries(header.split(',').map(s => s.split('=')));
  if (!parts.t || !parts.v1) return false;

  const payload = `${parts.t}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  // Constant-time compare
  if (expected.length !== parts.v1.length) return false;
  const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));

  // 5-minute replay window
  const age = Math.abs(Date.now() - Number(parts.t) * 1000);
  return ok && age < 5 * 60 * 1000;
}
```

Even with signing enabled, **continue re-fetching** for business-critical flows.

## TLS

- Webhook endpoints MUST be HTTPS. YooKassa rejects HTTP.
- Valid CA cert. Let's Encrypt via certbot/acme.sh.
- TLS 1.2+; disable 1.0/1.1.

## Test mode

Test environment runs at the same `https://api.yookassa.ru/v3` URL with `test_*` secret. Test webhooks carry `object.test: true`. Filter test-mode events on prod:

```ts
if (payment.test && env.NODE_ENV === 'production') {
  logger.warn({ payment }, 'test-mode webhook on prod');
  return reply.status(200).send();
}
```

## Test cards

Public (verify in dashboard for current list):

| PAN | Outcome |
|---|---|
| `5555 5555 5555 4477` | Success |
| `4111 1111 1111 1026` | Success |
| `5555 5555 5555 4444` | InsufficientFunds (`canceled` with `cancellation_details.reason: insufficient_funds`) |
| `4111 1111 1111 1968` | 3-D Secure challenge required |
| `5555 5555 5555 4592` | Card expired |

CVV: `123`. Expiry: any future date.

## Idempotency-Key handling

Treat the key as sensitive — don't log full keys in plain text (they expose merchant order naming):

```ts
logger.info({ key: hashIdempotenceKey(key) }, 'creating payment');
```

(Hash just for log indexing — the key itself is not a secret in the cryptographic sense, but loose logs leak business intelligence.)

## Logging without leaking secrets

```ts
// ❌ never log raw secret key, full PAN, signatures
logger.info({ secretKey: env.YOOKASSA_SECRET_KEY }, 'configured');

// ✅ log payment outcome shape, not auth material
logger.info({
  paymentId: payment.id,
  status: payment.status,
  amount: payment.amount,
  metadata: payment.metadata,
  cardLast4: payment.payment_method?.card?.last4,
}, 'payment processed');
```

## Key-rotation drill

1. Dashboard → API → "Создать новый секретный ключ" (creates parallel valid key)
2. Deploy new key to env, restart app
3. Confirm new key works (send a 1-RUB test payment)
4. Dashboard → revoke old key
5. Tag the deploy

YooKassa allows up to 2 concurrent active keys for zero-downtime rotation.

## Webhook URL hygiene

- Separate URLs per environment (dev/staging/prod) — never share
- Configure in dashboard, not via API for `Basic Auth` integrations
- URL changes: configure NEW URL → confirm webhooks arrive → remove OLD URL
- Document in your runbook
