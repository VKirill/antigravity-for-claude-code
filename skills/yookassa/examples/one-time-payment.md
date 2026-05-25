# Example — Successful One-Time Payment (Checkout.js)

End-to-end flow for a one-time digital purchase via the YooKassa Checkout.js embedded widget.

## Scenario

Customer buys SaaS Pro plan (1000 RUB, instant access). Stack: Next.js 16 + Fastify webhook receiver + PostgreSQL via Prisma + `@a2seven/yoo-checkout`.

## Step 1: Create order + initialize payment (server)

```ts
// app/api/checkout/route.ts (Next.js Route Handler)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { YooCheckout } from '@a2seven/yoo-checkout';
import { db } from '@/lib/db';
import { buildReceipt } from '@/lib/yookassa/receipt';

const checkout = new YooCheckout({
  shopId: process.env.YOOKASSA_SHOP_ID!,
  secretKey: process.env.YOOKASSA_SECRET_KEY!,
});

const Body = z.object({
  productId: z.string(),
  email: z.email(),
});

export async function POST(req: Request) {
  const { productId, email } = Body.parse(await req.json());
  const product = await db.product.findUniqueOrThrow({ where: { id: productId } });

  const result = await db.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        productId, email,
        amount: product.price, currency: 'RUB',
        status: 'pending_payment',
      },
    });

    const idempotenceKey = crypto.randomUUID();

    const payment = await checkout.createPayment({
      amount: { value: Number(product.price).toFixed(2), currency: 'RUB' },
      capture: true,
      confirmation: { type: 'embedded' },
      description: product.label,
      metadata: { order_id: order.id, product_id: productId },
      receipt: buildReceipt({
        items: [{
          description: product.label,
          quantity: 1,
          amount: Number(product.price),
          vatCode: 1,
          paymentSubject: 'service',
          paymentMode: 'full_payment',
        }],
        customer: { email },
        taxSystemCode: 2,
      }),
    }, idempotenceKey);

    await tx.payment.create({
      data: {
        orderId: order.id,
        yookassaId: payment.id,
        idempotenceKey,
        status: 'pending',
      },
    });

    return {
      orderId: order.id,
      confirmationToken: (payment.confirmation as any).confirmation_token,
    };
  });

  return NextResponse.json(result);
}
```

## Step 2: Mount Checkout.js widget (client)

```tsx
// app/checkout/page.tsx
'use client';
import Script from 'next/script';
import { useState } from 'react';

export default function Checkout() {
  const [token, setToken] = useState<string | null>(null);

  async function startCheckout() {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 'pro', email: 'buyer@example.com' }),
    });
    const { confirmationToken, orderId } = await res.json();
    setToken(confirmationToken);

    // After token is set, mount the widget
    queueMicrotask(() => {
      // @ts-expect-error — YooMoneyCheckoutWidget is global from script
      const widget = new window.YooMoneyCheckoutWidget({
        confirmation_token: confirmationToken,
        return_url: `${location.origin}/orders/${orderId}/result`,
        error_callback: (e: unknown) => console.error('YK widget error', e),
      });
      widget.render('payment-form');
    });
  }

  return (
    <>
      <Script src="https://yookassa.ru/checkout-widget/v1/checkout-widget.js" strategy="afterInteractive" />
      {!token ? (
        <button onClick={startCheckout} className="rounded bg-blue-600 px-4 py-2 text-white">
          Купить подписку Pro
        </button>
      ) : (
        <div id="payment-form" />
      )}
    </>
  );
}
```

## Step 3: Webhook handler (server)

See `templates/webhook-fastify.ts.template`. Production payment.succeeded handler:

```ts
async function onPaymentSucceeded(payment: Payment) {
  const orderId = payment.metadata?.order_id;
  if (!orderId) return;

  await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order || order.status === 'paid') return;

    if (order.amount.toFixed(2) !== payment.amount.value) {
      logger.error({ order, payment }, 'amount mismatch — refusing');
      return;
    }

    await tx.payment.update({
      where: { yookassaId: payment.id },
      data: { status: 'succeeded' },
    });
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        cardLast4: payment.payment_method?.card?.last4 ?? null,
      },
    });
    await tx.entitlement.create({
      data: { userEmail: order.email, productId: order.productId },
    });
  });

  await queue.add('email.receipt-confirm', { orderId });
}
```

## Step 4: Result page

```tsx
// app/orders/[id]/result/page.tsx
// Polls /api/orders/[id] every 2s for status === 'paid'.
// Webhook may arrive slightly before return_url redirects; re-fetch authoritative.
```

## Verification (manual test with sandbox)

After running end-to-end with a test card (`5555 5555 5555 4477`):

- Order created with `status: 'pending_payment'`
- Payment row created with `yookassaId`, `idempotenceKey`, `status: 'pending'`
- Widget renders, accepts card, redirects to result URL
- `payment.succeeded` webhook arrives within seconds (IP allowed, payment re-fetched)
- Order status → `paid`, entitlement row inserted
- Receipt email arrives (54-ФЗ ОФД transmission, may take ~30s)

## Failure paths

| Failure | Recovery |
|---|---|
| User abandons widget | Order stays `pending_payment`. Cron expires after 24h. |
| Card declined | `payment.canceled` webhook with `cancellation_details.reason` → order `payment_failed` |
| Webhook arrives but DB transaction fails | Return non-2xx → YooKassa retries → next time DB is OK, idempotent dedup ensures no double-grant |
| 3-DS interrupted | Widget handles inline; abandoned challenge leaves order `pending_payment` |
| Duplicate webhook | Re-fetch + idempotent transaction handles it; the `webhookEvent` unique key dedups |

## Edge: amount mismatch attack

Attacker forges a webhook claiming `amount: 9000` for an order priced at 1000. The handler **re-fetches** the payment from YooKassa, gets the real `1000.00`, and compares against the order. Refuses. Never trust the webhook body.
