# CloudPayments — Security & PCI

## PCI DSS scope

CloudPayments is a PCI DSS Level 1 service provider. Merchant scope depends on integration:

| Integration | SAQ | Notes |
|---|---|---|
| Widget (iframe checkout) | **SAQ A-EP** | Recommended. PAN never touches merchant servers. |
| Hosted invoice page (`/orders/create`) | **SAQ A** | Lowest scope. Merchant only deals in payment links. |
| Server-side cryptogram (custom UI) | SAQ A-EP / D | More scope — merchant JS handles card fields. Avoid unless required. |

Never accept raw PAN/CVV in your own forms unless your team has PCI scope discipline and a QSA. Use the widget.

## API Secret

Loaded from env, server-only. Treat as a database password:

```bash
# .env (gitignored)
CP_PUBLIC_ID=pk_xxxxxxxxxxxxxxxxxxxxxxxxx
CP_API_SECRET=2b3c4d...
```

```ts
import { z } from 'zod';

export const env = z.object({
  CP_PUBLIC_ID: z.string().min(1),
  CP_API_SECRET: z.string().min(20),
}).parse(process.env);
```

Rotation: dashboard → API → "Generate new Secret". Old secret invalidated immediately — coordinate deploy.

## HMAC signature verification

Every webhook carries `Content-HMAC` header (legacy alias: `X-Content-HMAC`). Value: base64(HMAC-SHA256(rawBody, apiSecret)).

```ts
import crypto from 'node:crypto';

export function verifyCloudPaymentsHmac(args: {
  rawBody: Buffer | string;
  headerHmac: string | undefined;
  apiSecret: string;
}): boolean {
  if (!args.headerHmac) return false;

  const expected = crypto
    .createHmac('sha256', args.apiSecret)
    .update(args.rawBody)
    .digest('base64');

  const a = Buffer.from(expected);
  const b = Buffer.from(args.headerHmac);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
```

### Read raw body (Fastify)

```ts
import Fastify from 'fastify';

const app = Fastify();

app.addContentTypeParser(
  ['application/json', 'application/x-www-form-urlencoded'],
  { parseAs: 'buffer' },
  (_req, body, done) => done(null, body),
);

app.post('/webhooks/cp/pay', async (req, reply) => {
  const rawBody = req.body as Buffer;
  const hmac = req.headers['content-hmac'] as string | undefined;

  if (!verifyCloudPaymentsHmac({ rawBody, headerHmac: hmac, apiSecret: env.CP_API_SECRET })) {
    return reply.status(401).send({ code: 13 });
  }

  // Now safe to parse:
  const payload = JSON.parse(rawBody.toString('utf8'));
  // ... business logic
  return reply.status(200).send({ code: 0 });
});
```

### Read raw body (Express)

```ts
import express from 'express';

app.post(
  '/webhooks/cp/pay',
  express.raw({ type: '*/*' }), // captures Buffer in req.body
  (req, res) => {
    const rawBody = req.body as Buffer;
    const hmac = req.get('Content-HMAC');

    if (!verifyCloudPaymentsHmac({ rawBody, headerHmac: hmac, apiSecret: env.CP_API_SECRET })) {
      return res.status(401).json({ code: 13 });
    }

    const payload = JSON.parse(rawBody.toString('utf8'));
    // ... business logic
    res.status(200).json({ code: 0 });
  },
);
```

### Common HMAC pitfalls

- ❌ JSON-parsing the body before computing HMAC — re-serialization differs from raw bytes
- ❌ Computing HMAC over the URL-decoded form body for `application/x-www-form-urlencoded` — use raw bytes
- ❌ Using `===` to compare — vulnerable to timing attacks
- ❌ Not handling `Content-HMAC` AND `X-Content-HMAC` — some legacy integrations send the latter

## IP allowlist (defence-in-depth)

CloudPayments publishes the IP ranges from which webhooks originate (dashboard → Integrations → Notifications). Whitelist them at your edge (Angie/Nginx/UFW):

```nginx
# /etc/angie/conf.d/cloudpayments.conf
location /webhooks/cp/ {
    allow 130.193.70.0/24;     # example — check current ranges in dashboard
    allow 91.142.84.0/24;
    deny all;

    proxy_pass http://127.0.0.1:3000;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_pass_request_body on;
}
```

HMAC verification stays the source of truth — IP allowlist is supplementary.

## TLS

- Webhook endpoints MUST be HTTPS. CloudPayments rejects plain HTTP.
- Use a valid CA cert. Let's Encrypt via certbot/acme.sh is fine.
- Disable TLS 1.0/1.1; require TLS 1.2+.

## Test mode keys

Test environment uses identical URLs but different keys (prefixed `pk_test_xxx`). Test mode webhooks carry `TestMode: 1` — many integrations drop these by default to keep prod DB clean.

```ts
if (payload.TestMode === 1 && env.NODE_ENV === 'production') {
  logger.warn('test-mode webhook on prod', { payload });
  return reply.status(200).send({ code: 0 });
}
```

## Test cards

Public test card numbers (verify in dashboard for current list):

| PAN | Outcome |
|---|---|
| `4242 4242 4242 4242` | Success |
| `5555 5555 5555 4444` | Success (MasterCard) |
| `4012 0010 3714 1112` | Decline (InsufficientFunds) |
| `4012 0010 3766 1118` | 3-D Secure required |

CVV: any 3 digits. Expiry: any future date.

## Key-rotation drill

1. Dashboard → API → generate new secret (DO NOT activate yet — most workflows allow staging)
2. Deploy new secret to server env, restart
3. Activate in dashboard
4. Send test webhook from dashboard tool — verify 200 OK
5. Roll back if any 401s; keep deploy small

## Auditing webhook history

Every webhook attempt is logged in the dashboard for ~30 days. Useful for:
- Diagnosing missed webhooks (was it retried? did it 401?)
- Replaying a webhook against staging
- Confirming a transaction without DB access

## Logging without leaking secrets

```ts
// ❌ never log raw body in plaintext — may contain PAN-like fragments
logger.info({ rawBody: rawBody.toString() }, 'webhook received');

// ✅ log scrubbed payload
logger.info({
  TransactionId: payload.TransactionId,
  InvoiceId: payload.InvoiceId,
  Amount: payload.Amount,
  Status: payload.Status,
  cardLast4: payload.CardLastFour,
}, 'webhook received');
```

Never log `CardCryptogramPacket`, `Token` (in full), or `apiSecret`.
