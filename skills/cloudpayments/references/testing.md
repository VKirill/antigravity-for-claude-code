# CloudPayments — Testing

Test mode runs against the production API at `https://api.cloudpayments.ru` with `pk_test_*` keys. No money moves; webhooks fire with `TestMode: 1`.

## Setup

1. Dashboard → Settings → API → toggle to "Test" tab → copy `Public ID` and `API Secret`
2. Store separately from production secrets (different env file, different vault path)
3. Point the widget at the test `publicId` in your dev/staging build

## Test cards

Public test PANs (current as of skill generation — verify in dashboard):

| PAN | Brand | Outcome |
|---|---|---|
| `4242 4242 4242 4242` | Visa | Success, no 3DS |
| `5555 5555 5555 4444` | MasterCard | Success, no 3DS |
| `4012 0010 3714 1112` | Visa | Decline: InsufficientFunds (5051) |
| `4012 0010 3766 1118` | Visa | 3-D Secure challenge required |
| `2200 0000 0000 0004` | МИР | Success |
| `4111 1111 1111 1112` | Visa | Decline: ExpiredCard (5054) |

CVV: any 3 digits. Expiry: any future MM/YY.

## Test recurrent

Test environment supports `/subscriptions/*` but cycles do NOT auto-fire on schedule (avoiding test noise). Manually trigger via dashboard:

Dashboard → Subscriptions → select test sub → "Force next charge" → CloudPayments executes the cycle and your webhooks fire as in prod.

## Local webhook receiving

CloudPayments cannot call `localhost`. Three options:

1. **ngrok** — `ngrok http 3000` → `https://abc123.ngrok-free.app/webhooks/cp/pay` → paste into dashboard
2. **cloudflared** — `cloudflared tunnel --url http://localhost:3000`
3. **Staging server** with public DNS — preferred for team workflows

## Fixture replays

CloudPayments dashboard → Notifications → click any past webhook → "Resend". The webhook fires again with the same HMAC. Useful for testing idempotency.

## Unit testing the HMAC verifier

```ts
// tests/hmac.test.ts
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { verifyCloudPaymentsHmac } from '../webhook';

describe('verifyCloudPaymentsHmac', () => {
  const secret = 'test_secret';
  const body = '{"TransactionId":123,"Amount":1000.00}';
  const validHmac = crypto.createHmac('sha256', secret).update(body).digest('base64');

  it('accepts valid signature', () => {
    expect(verifyCloudPaymentsHmac({ rawBody: body, headerHmac: validHmac, apiSecret: secret })).toBe(true);
  });

  it('rejects tampered body', () => {
    expect(verifyCloudPaymentsHmac({
      rawBody: body + '_TAMPER',
      headerHmac: validHmac,
      apiSecret: secret,
    })).toBe(false);
  });

  it('rejects wrong secret', () => {
    expect(verifyCloudPaymentsHmac({ rawBody: body, headerHmac: validHmac, apiSecret: 'wrong' })).toBe(false);
  });

  it('rejects missing header', () => {
    expect(verifyCloudPaymentsHmac({ rawBody: body, headerHmac: undefined, apiSecret: secret })).toBe(false);
  });
});
```

## E2E with Playwright

For widget-based checkouts, Playwright can drive the iframe:

```ts
test('successful checkout', async ({ page }) => {
  await page.goto('https://staging.example.com/checkout?orderId=test-1');
  await page.getByRole('button', { name: 'Оплатить' }).click();

  const cpFrame = page.frameLocator('iframe[src*="widget.cloudpayments.ru"]');
  await cpFrame.getByLabel('Номер карты').fill('4242 4242 4242 4242');
  await cpFrame.getByLabel('Срок').fill('12/30');
  await cpFrame.getByLabel('CVV').fill('123');
  await cpFrame.getByRole('button', { name: 'Оплатить' }).click();

  await expect(page.getByText('Оплачено')).toBeVisible({ timeout: 30_000 });
});
```

Selectors inside the CP iframe may change — keep them centralized in a page object.

## Fixture payloads

For unit tests of webhook handlers, use real anonymized fixtures captured from dashboard:

```ts
// tests/fixtures/pay-webhook.json
{
  "TransactionId": 99999999,
  "Amount": 1000.00,
  "Currency": "RUB",
  "DateTime": "2026-05-15T10:00:00",
  "InvoiceId": "test-order-1",
  "AccountId": "test-user-1",
  "Email": "test@example.com",
  "CardFirstSix": "424242",
  "CardLastFour": "4242",
  "CardType": "Visa",
  "Status": "Completed",
  "TestMode": 1,
  "Token": "tk_test_xxx"
}
```

## Sandbox-only flags

`JsonData.TestModeBehavior` (CloudPayments-specific extension) lets you force outcomes in test mode:

```json
"JsonData": {
  "TestModeBehavior": { "DeclineWithCode": 5051 }
}
```

Verify availability in dashboard — feature parity changes occasionally.

## Going live

1. Switch widget `publicId` to production key
2. Update server env `CP_API_SECRET` to prod
3. In dashboard, set production webhook URLs
4. Send a 1-RUB real transaction from your own card → verify Pay webhook → refund it
5. Tag the deploy in your repo for rollback reference
