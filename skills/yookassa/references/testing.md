# YooKassa — Testing

Test mode uses the same API URL with `test_*` secret keys. No money moves; receipts don't reach ОФД.

## Setup

1. Dashboard → Settings → API → toggle to "Test" tab
2. Copy `shopId` (same numeric ID) and the test `secretKey` (prefix `test_`)
3. Store separately from production secrets

## Test cards

Verify current list in dashboard. Common public test PANs:

| PAN | Outcome | `cancellation_details.reason` |
|---|---|---|
| `5555 5555 5555 4477` | Success | — |
| `4111 1111 1111 1026` | Success | — |
| `5555 5555 5555 4444` | Declined | `insufficient_funds` |
| `4111 1111 1111 1968` | 3-D Secure required | — |
| `5555 5555 5555 4592` | Card expired | `card_expired` |
| `4111 1111 1111 1059` | Fraud suspected | `fraud_suspected` |
| `5555 5555 5555 4517` | Permission revoked | `permission_revoked` |

CVV: `123`. Expiry: future `MM/YY`.

## Test СБП

In test mode, СБП payments auto-confirm after ~10 seconds without real bank-app interaction. Use `confirmation: { type: 'qr' }` and watch the `payment.succeeded` webhook arrive.

## Local webhook receiving

YooKassa cannot call `localhost`. Options:

1. **ngrok**: `ngrok http 3000` → paste `https://abc123.ngrok-free.app/webhooks/yookassa` into dashboard
2. **cloudflared**: `cloudflared tunnel --url http://localhost:3000`
3. **Staging server** with public DNS (preferred for teams)

## Replay webhooks

Dashboard → API → "Уведомления" → click any past event → "Отправить повторно". Same event ID, same payload, allows testing idempotency.

## Force payment to a specific state (test mode)

Pass `payment_method_data.type` plus a magic `amount.value` for some scenarios. Better: use the test cards above with specific amounts to reach known outcomes.

## Unit tests — webhook handler

```ts
import { describe, it, expect, vi } from 'vitest';
import { handleWebhook } from '../webhook';

describe('handleWebhook', () => {
  it('idempotently handles duplicate payment.succeeded', async () => {
    const getPayment = vi.fn().mockResolvedValue({
      id: 'pi_test',
      status: 'succeeded',
      amount: { value: '1000.00', currency: 'RUB' },
      metadata: { order_id: 'order-1' },
    });

    await handleWebhook({ type: 'notification', event: 'payment.succeeded', object: { id: 'pi_test' } }, { getPayment });
    await handleWebhook({ type: 'notification', event: 'payment.succeeded', object: { id: 'pi_test' } }, { getPayment });

    const order = await db.order.findUnique({ where: { id: 'order-1' } });
    expect(order?.status).toBe('paid');
    expect(order?.fulfilledTimes).toBe(1); // not 2
  });

  it('refuses payment with mismatched amount', async () => {
    const getPayment = vi.fn().mockResolvedValue({
      id: 'pi_test',
      status: 'succeeded',
      amount: { value: '9000.00', currency: 'RUB' }, // wrong!
      metadata: { order_id: 'order-1' }, // order is 1000 RUB
    });

    await handleWebhook({ type: 'notification', event: 'payment.succeeded', object: { id: 'pi_test' } }, { getPayment });

    const order = await db.order.findUnique({ where: { id: 'order-1' } });
    expect(order?.status).toBe('pending_payment'); // refused
  });
});
```

## E2E with Playwright

```ts
test('checkout flow — embedded widget', async ({ page }) => {
  await page.goto('https://staging.example.com/checkout/test-order');

  await page.getByRole('button', { name: 'Перейти к оплате' }).click();

  // YooKassa embedded widget loads inside an iframe
  const yk = page.frameLocator('iframe[src*="yookassa.ru/checkout-widget"]');
  await yk.getByLabel('Номер карты').fill('5555 5555 5555 4477');
  await yk.getByLabel('Срок').fill('12/30');
  await yk.getByLabel('CVV').fill('123');
  await yk.getByRole('button', { name: 'Оплатить' }).click();

  // 3DS test prompt may appear for specific cards
  // await yk.getByRole('button', { name: 'Подтвердить' }).click();

  await expect(page).toHaveURL(/orders\/test-order\/result/, { timeout: 30_000 });
  await expect(page.getByText('Оплачено')).toBeVisible();
});
```

## Fixture payloads

Captured anonymized webhooks for replay in unit tests:

```ts
// tests/fixtures/payment-succeeded.json
{
  "type": "notification",
  "event": "payment.succeeded",
  "object": {
    "id": "29084b71-000f-5000-9000-1d0b35d96a99",
    "status": "succeeded",
    "amount": { "value": "1000.00", "currency": "RUB" },
    "description": "Test order",
    "created_at": "2026-05-15T10:00:00.000Z",
    "captured_at": "2026-05-15T10:00:30.000Z",
    "test": true,
    "refundable": true,
    "metadata": { "order_id": "test-order-1" },
    "payment_method": {
      "type": "bank_card",
      "id": "29084b71-000f-5000-9000-1d0b35d96a99",
      "saved": false,
      "card": { "last4": "4477", "card_type": "MasterCard", "issuer_country": "RU" }
    }
  }
}
```

## Going live

1. Switch widget `confirmation_token` source to use prod `shopId` + `live_*` key
2. Replace server env `YOOKASSA_SECRET_KEY` with prod
3. Configure webhook URLs in **prod** account settings
4. Send a 10-RUB real transaction → verify webhook → refund it
5. Tag deploy in repo for rollback reference
6. Verify ОФД receipt actually generated (check customer email + dashboard fiscal receipts list)
