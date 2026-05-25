# Payments — VK Pay via VKWebAppOpenPayForm

VK Pay is VK's native payment surface. From a Mini App you open a pay form; the host handles the flow (card / wallet / SBP), and you receive a result with a `transaction_id` which is your idempotency key.

**This is HIGH-STAKES.** Never trust the client-reported result alone — always verify server-side before granting access.

## Actions overview

| action | Purpose | Money flow |
|---|---|---|
| `pay-to-service` | Merchant payment — user pays your Mini App's VK Pay merchant account | User → your merchant balance |
| `pay-to-user` | P2P transfer to a specific user with a fixed amount | User → another user |
| `pay-to-group` | Payment to a community's VK Pay account | User → community balance |
| `transfer-to-user` | Open generic transfer form, user picks amount | User → user (free amount) |
| `transfer-to-group` | Open generic transfer to community | User → community (free amount) |

For **selling digital goods inside your Mini App**, you want `pay-to-service`.

## `pay-to-service` (merchant payment)

```ts
const result = await bridge.send('VKWebAppOpenPayForm', {
  app_id: 12345678,
  action: 'pay-to-service',
  params: {
    amount: 199,                        // major units (rubles), not kopecks — but check VK Pay docs for your currency
    description: 'Premium subscription, 1 month',
    merchant_id: 0,                     // your merchant ID from VK Pay merchant cabinet
    order_id: 'order_2026_05_16_001',   // YOUR internal order ID — keep unique per attempt
    ts: Math.floor(Date.now() / 1000),  // unix seconds
    data: JSON.stringify({ user: vk_user_id, plan: 'premium-1m' }),
    // sign: <pre-computed HMAC-SHA256 of all the above with your merchant secret>
  },
});
// result on success: { status: 'success', transaction_id: number, amount: number, extra: ... }
// result on cancel:  rejects with { error_type: 'client_error', error_data: { error_reason: 'User canceled' } }
```

The `sign` here is the **merchant signature** — separate from launch-param `sign`. Compute server-side with your VK Pay merchant secret. The host validates it before charging the user.

### Merchant signature algorithm

1. Build a sorted ASCII-key list of the `params` object (everything except `sign`).
2. URL-encode values; join as `k=v&k=v`.
3. `HMAC-SHA256(merchant_secret, message).digest('hex')`.
4. Lowercase hex result is the `sign` value.

(Verify against the current VK Pay merchant integration docs for your specific merchant onboarding — VK has historically supported a few hex/base16 conventions.)

### Generating the pay request — server-side

Never embed `merchant_secret` in the client. The frontend asks the server to mint a signed params block:

```ts
// server route: POST /api/vkpay/intent
app.post('/api/vkpay/intent', async (req, reply) => {
  const vk = req.vk; // populated by sign-verifying middleware
  const orderId = generateUniqueOrderId(); // ULID or uuidv7

  // Insert pending order BEFORE returning to client — pre-create the row
  await db.orders.insert({
    id: orderId,
    user_id: vk.vk_user_id,
    amount: 199,
    plan: 'premium-1m',
    status: 'pending',
  });

  const params = {
    amount: 199,
    description: 'Premium subscription, 1 month',
    merchant_id: VK_PAY_MERCHANT_ID,
    order_id: orderId,
    ts: Math.floor(Date.now() / 1000),
    data: JSON.stringify({ user: vk.vk_user_id, plan: 'premium-1m' }),
  };
  const sign = signMerchant(params, VK_PAY_MERCHANT_SECRET);

  return { params: { ...params, sign }, app_id: VK_APP_ID };
});
```

Client:

```ts
const { app_id, params } = await fetch('/api/vkpay/intent', { method: 'POST' }).then(r => r.json());
const result = await bridge.send('VKWebAppOpenPayForm', {
  app_id,
  action: 'pay-to-service',
  params,
});

if (result.status === 'success') {
  // Tell server to verify and grant
  await fetch('/api/vkpay/confirm', {
    method: 'POST',
    body: JSON.stringify({
      order_id: params.order_id,
      transaction_id: result.transaction_id,
      amount: result.amount,
    }),
  });
}
```

### Server-side confirmation (independent verification)

```ts
app.post('/api/vkpay/confirm', async (req, reply) => {
  const { order_id, transaction_id, amount } = req.body;

  // 1. Look up our pending order
  const order = await db.orders.findById(order_id);
  if (!order || order.user_id !== req.vk.vk_user_id) return reply.code(404);

  // 2. Idempotency — if transaction_id already recorded, return current state
  const existing = await db.payments.findByTxn(transaction_id);
  if (existing) return reply.send({ status: existing.status });

  // 3. Verify with VK Pay API independently (or wait for the webhook)
  const vkPayState = await vkPayApi.getTransaction(transaction_id);
  if (vkPayState.status !== 'success' || vkPayState.amount !== order.amount) {
    return reply.code(409).send({ error: 'mismatch' });
  }

  // 4. Atomic grant + payment record + idempotency row
  await db.$transaction(async (tx) => {
    await tx.payments.insert({
      transaction_id,                     // PRIMARY KEY — unique constraint
      order_id,
      user_id: req.vk.vk_user_id,
      amount: vkPayState.amount,
      status: 'succeeded',
    });
    await tx.orders.update(order_id, { status: 'paid' });
    await grantAccess(tx, req.vk.vk_user_id, order.plan);
  });

  reply.send({ status: 'succeeded' });
});
```

Key invariants:
- `transaction_id` is the unique idempotency key — UNIQUE constraint at DB level.
- Insert payment row + grant access in ONE transaction.
- Re-verify amount and status against VK Pay's authoritative state — do not trust the client value.

## `pay-to-user` and `pay-to-group`

P2P transfers with a fixed amount:

```ts
await bridge.send('VKWebAppOpenPayForm', {
  app_id: 12345678,
  action: 'pay-to-user',
  params: {
    user_id: 987654,
    amount: 100,
    description: 'Tip for sharing recipe',
  },
});
```

These don't require merchant secret — they're peer-to-peer through the VK Pay wallet. Suitable for tip jars, P2P marketplaces, donation flows.

## `transfer-to-user` / `transfer-to-group`

Open the transfer form with no fixed amount — the user picks:

```ts
await bridge.send('VKWebAppOpenPayForm', {
  app_id: 12345678,
  action: 'transfer-to-user',
  params: {
    user_id: 987654,
  },
});
```

Useful for "tip any amount" flows or community donation buttons.

## Comparison vs CloudPayments / YooKassa direct

| Concern | VK Pay (via bridge) | CloudPayments / YooKassa direct |
|---|---|---|
| In-flow UX | Native VK widget, no redirect | Embed widget or redirect |
| 54-ФЗ fiscal receipts | VK is MoR for `pay-to-service`; receipts via VK | You configure CustomerReceipt / receipts per provider |
| Available payment methods | Card + VK Pay wallet + SBP | Card + SBP + Tinkoff Pay + SberPay + MIR Pay |
| Reach | VK users only (already in client) | Any user on any platform |
| Fees | VK Pay merchant fees | Provider-specific |
| Webhook reliability | Use VK Pay API for verification | Standard webhook+HMAC |

Use VK Pay when the audience is inside the VK ecosystem and you want zero-friction checkout. Use a regular Russian gateway (cloudpayments / yookassa) for cross-platform reach. They can coexist — offer VK Pay first inside the Mini App, redirect to a web checkout for users outside.

## Pitfalls

- **Don't trust `result.status === 'success'`** alone. The client value is not signed; a hostile user can monkey-patch the bridge and call your `/confirm` endpoint with fake data. Always re-verify server-side.
- **`transaction_id` reuse**: enforce uniqueness at DB layer. Even if the client retries the confirmation call, the unique constraint protects you.
- **Pre-create order rows BEFORE opening the pay form** — you need a stable `order_id` and a state to bind the transaction to. Don't create-on-confirm.
- **Amount drift**: the user may see a different amount than your `params.amount` if you computed it incorrectly. Lock the amount in DB and compare both `params.amount` and `vkPayState.amount` against it.
- **54-ФЗ for digital goods**: VK Pay handles receipts for `pay-to-service` when VK is MoR — confirm with your merchant onboarding which receipts are auto-issued vs your responsibility.
- **No production cancel callback** — the bridge promise rejects on cancel; the order stays `pending`. Either expire stale `pending` rows on a cron or use a webhook from VK Pay.
