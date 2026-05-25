# Race conditions

Time-of-check-time-of-use bugs, idempotency window, double-spend, concurrent state mutation. Often overlooked because they don't show up in single-request testing.

## TOCTOU (Time-Of-Check-Time-Of-Use)

Classic: check permission → act. Between the two, state changes.

```ts
// ❌
async function transfer(fromId, toId, amount) {
  const from = await db.account.findUnique({ where: { id: fromId } });
  if (from.balance < amount) return { error: 'insufficient' };
  // ⏱️ race window — concurrent transfer can drain balance here

  await db.account.update({ where: { id: fromId }, data: { balance: { decrement: amount } } });
  await db.account.update({ where: { id: toId },   data: { balance: { increment: amount } } });
}

// ✅ — atomic in a transaction with row lock, or use conditional update
async function transfer(fromId, toId, amount) {
  await db.$transaction(async tx => {
    // Conditional decrement — fails if balance would go negative
    const updated = await tx.account.updateMany({
      where: { id: fromId, balance: { gte: amount } },
      data: { balance: { decrement: amount } }
    });
    if (updated.count === 0) throw new Error('insufficient');
    await tx.account.update({ where: { id: toId }, data: { balance: { increment: amount } } });
  });
}
```

PostgreSQL: use `SELECT ... FOR UPDATE` or rely on row-level locking via transactions.

## Idempotency in payments

Same request fired twice = charge twice. Common cause: client retries on network blip; server re-processes.

### Pattern: idempotency key

```ts
app.post('/api/charge', async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) return res.status(400).end();

  // Check if we've processed this key
  const existing = await db.idempotencyRecord.findUnique({ where: { key: idempotencyKey } });
  if (existing) return res.json(existing.response);  // replay cached result

  // Do the charge
  const result = await stripe.charges.create({ amount: req.body.amount, ... });

  // Persist for future replay (TTL ~ 24h)
  await db.idempotencyRecord.create({
    data: { key: idempotencyKey, response: result, expiresAt: Date.now() + 86400000 }
  });

  res.json(result);
});
```

**Key generation rule:** client generates UUID per intended action, retries reuse same UUID. Don't derive key from request body hash alone — same body submitted intentionally twice (e.g., paying same invoice twice on purpose) is ambiguous.

### CloudPayments / YooKassa idempotency

YooKassa: `Idempotence-Key` header (required for `/v3/payments`).
CloudPayments: `InvoiceId` field — used by their backend as idempotency anchor; reuse for retries of same charge.

→ See `worker-payments-verifier` agent + `cloudpayments` / `yookassa` skills for provider-specific patterns.

## Double-spend / concurrent withdrawal

Same wallet, two simultaneous withdrawals.

**Fix:** unique transaction ID OR row lock OR optimistic concurrency (version column).

```sql
-- Optimistic concurrency
UPDATE wallets
SET balance = balance - $amount, version = version + 1
WHERE id = $id AND balance >= $amount AND version = $expectedVersion;
-- If 0 rows updated → either insufficient OR concurrent write happened → retry
```

## Token reuse (auth / OTP / reset link)

User submits same OTP twice = login twice. Single-use OTPs need atomic check-and-invalidate.

```ts
// ❌ TOCTOU
async function verifyOtp(userId, code) {
  const otp = await db.otp.findFirst({ where: { userId, code, used: false } });
  if (!otp) return false;
  await db.otp.update({ where: { id: otp.id }, data: { used: true } });
  return true;
}

// ✅ — atomic invalidate
async function verifyOtp(userId, code) {
  const result = await db.otp.updateMany({
    where: { userId, code, used: false, expiresAt: { gt: new Date() } },
    data: { used: true }
  });
  return result.count === 1;
}
```

## Concurrent state mutation

Two HTTP requests both increment a counter:

```ts
// ❌
let count = await redis.get('visits');
await redis.set('visits', count + 1);
// race: both reads return 5, both writes set 6 → lost increment

// ✅ — use atomic op
await redis.incr('visits');
```

For Postgres: `UPDATE counters SET n = n + 1 WHERE ...` (atomic) instead of read-modify-write.

For application state: actor model, message queue, or single-writer pattern (e.g., BullMQ `concurrency: 1` for state-mutating jobs).

## File operations

```ts
// ❌ TOCTOU on filesystem
if (!fs.existsSync(path)) {
  fs.writeFileSync(path, data);  // race: another process can create the file between
}

// ✅ — atomic via flag
fs.writeFileSync(path, data, { flag: 'wx' });  // wx = open for write, fail if exists
```

## Webhook replay (different from idempotency)

Attacker captures webhook + replays later. Different from "client retries with same idempotency key".

**Fix:** check timestamp in HMAC payload + reject if older than N minutes; track processed webhook IDs.

```ts
const ts = parseInt(req.headers['x-timestamp']);
if (Math.abs(Date.now() / 1000 - ts) > 300) return res.status(401).end();  // 5 min window

const idempotencyId = req.headers['x-webhook-id'];
const seen = await redis.set(`webhook:${idempotencyId}`, '1', 'EX', 600, 'NX');
if (seen !== 'OK') return res.status(200).end();  // already processed
```

## Audit grep

```bash
# Find check-then-act patterns (heuristic — manual review needed)
grep -rnE 'findUnique\(|findFirst\(|findOne\(' src/ -A5 | grep -B5 'update\(\|create\(\|delete\('

# Find raw read-modify-write
grep -rnE 'await.*get\(|await.*find' src/ -A8 | grep -B8 'set\(|update\(\|put\('

# Find missing idempotency in payment routes
grep -rnE 'stripe\.charges|stripe\.paymentIntents|yookassa|cloudpayments' src/ -B3 -A3 | \
  grep -B3 'create\(' | grep -v -i idempotency
```

## Testing for race conditions

Single-request testing won't find these. Approaches:

1. **Concurrent requests** — fire N parallel identical requests, assert exactly one succeeds:
   ```bash
   for i in {1..50}; do curl -X POST $URL -d "@payload.json" & done; wait
   ```
2. **Chaos testing** — `vegeta attack -duration=10s -rate=100/s`, look for double-charges in logs
3. **Property tests** — invariant: balance never negative; total amount in == total amount out

## Severity calibration

| Finding | Severity |
|---|---|
| Payment route without idempotency key handling | 🔴 Critical |
| TOCTOU in balance/wallet check | 🔴 Critical |
| OTP reusable (no atomic invalidate) | 🔴 Critical |
| Race in inventory decrement (over-sell flash sale) | 🔴 Critical |
| Webhook replay not detected (no timestamp + ID dedup) | ⚠️ High |
| Race in counter increment (non-financial) | 🟡 Medium |
| Race in cache invalidation (stale data risk) | 🟡 Medium |
| File-create TOCTOU (typical local-dev pattern) | 🟢 Low |
