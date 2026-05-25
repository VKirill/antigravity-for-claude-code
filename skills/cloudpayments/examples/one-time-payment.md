# Example — Successful One-Time Payment

End-to-end flow for a one-time digital purchase via the CloudPayments widget.

## Scenario

A customer buys a SaaS Pro plan (1000 RUB, instant access). Merchant runs Next.js 16 + Fastify webhook receiver + PostgreSQL via Prisma.

## Step 1: Create order (server)

```ts
// app/api/orders/route.ts (Next.js Route Handler)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

const Body = z.object({
  productId: z.string(),
  email: z.email(),
});

export async function POST(req: Request) {
  const { productId, email } = Body.parse(await req.json());
  const product = await db.product.findUniqueOrThrow({ where: { id: productId } });

  const order = await db.order.create({
    data: {
      productId,
      email,
      amount: product.price,
      currency: 'RUB',
      status: 'pending_payment',
    },
  });

  return NextResponse.json({
    invoiceId: order.id,
    amount: Number(order.amount),
    description: product.label,
  });
}
```

## Step 2: Mount widget (client)

```tsx
// app/checkout/[orderId]/page.tsx
'use client';
import Script from 'next/script';
import { useEffect, useRef } from 'react';

export default function Checkout({ params }: { params: Promise<{ orderId: string }> }) {
  const ref = useRef<HTMLButtonElement>(null);
  const orderIdPromise = params; // React 19 async params

  useEffect(() => {
    let widget: any;
    (async () => {
      const { orderId } = await orderIdPromise;
      const res = await fetch(`/api/orders/${orderId}`);
      const order = await res.json();

      // @ts-expect-error — cp is global from widget bundle
      widget = new cp.CloudPayments({ publicId: process.env.NEXT_PUBLIC_CP_PUBLIC_ID });

      ref.current?.addEventListener('click', () => {
        widget.pay(
          'charge',
          {
            publicId: process.env.NEXT_PUBLIC_CP_PUBLIC_ID,
            description: order.description,
            amount: order.amount,
            currency: 'RUB',
            invoiceId: order.invoiceId,
            email: order.email,
            requireEmail: true,
            skin: 'modern',
            data: {
              CloudPayments: {
                CustomerReceipt: {
                  Items: [{
                    label: order.description,
                    price: order.amount,
                    quantity: 1,
                    amount: order.amount,
                    vat: null,
                    method: 4,
                    object: 4,
                  }],
                  taxationSystem: 1,
                  email: order.email,
                  AmountsHelp: { electronic: order.amount },
                },
              },
            },
          },
          {
            onSuccess: () => {
              // server confirms via webhook — UI just redirects to a "processing" state
              window.location.assign(`/orders/${order.invoiceId}/processing`);
            },
            onFail: (reason: string) => {
              alert(`Платёж не прошёл: ${reason}`);
            },
          },
        );
      });
    })();
  }, []);

  return (
    <>
      <Script src="https://widget.cloudpayments.ru/bundles/cloudpayments.js" strategy="afterInteractive" />
      <button ref={ref} className="rounded bg-blue-600 px-4 py-2 text-white">
        Оплатить
      </button>
    </>
  );
}
```

## Step 3: Process webhooks (server)

See `templates/webhook-fastify.ts.template`. Production handler:

```ts
app.post('/webhooks/cp/pay', async (req, reply) => {
  const rawBody = req.body as Buffer;
  if (!verifyHmac(rawBody, req.headers['content-hmac'] as string)) {
    return reply.status(401).send({ code: 13 });
  }
  const p = PayPayload.parse(parsePayload(rawBody));

  // Idempotent: re-running this with the same TransactionId must not double-fulfill
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: p.InvoiceId } });
    if (!order) return; // unknown order — ignore
    if (order.status === 'paid') return; // already processed

    if (Number(order.amount) !== Number(p.Amount)) {
      req.log.error({ order, payload: p }, 'amount mismatch');
      return;
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        cpTransactionId: p.TransactionId,
        cardLast4: p.CardLastFour ?? null,
        cpToken: p.Token ?? null,
      },
    });

    // Grant product access
    await tx.entitlement.create({
      data: { userEmail: order.email!, productId: order.productId },
    });
  });

  return reply.status(200).send({ code: 0 });
});
```

## Step 4: Customer reaches "processing" page

```tsx
// app/orders/[id]/processing/page.tsx
// polls /api/orders/[id] every 2s for status === 'paid', then redirects to /thank-you
```

## Verification

After running the flow end-to-end with a test card (`4242 4242 4242 4242`):

- `pending_payment` order created in DB
- Widget opens, accepts card, closes on success
- `Pay` webhook arrives within 1-3 seconds
- HMAC verified (no 401 in logs)
- Order status → `paid`, `paidAt` set, `cpTransactionId` populated
- Entitlement row created
- Customer redirected to `/thank-you`
- Receipt email arrives within ~30 seconds (54-ФЗ ОФД transmission)

## Failure paths

| Failure | Recovery |
|---|---|
| Widget closed before paying | Order stays `pending_payment`. Cron expires it after 24h. |
| Bank declines | `Fail` webhook arrives → order → `payment_failed`, no entitlement |
| Webhook arrives but DB down | CloudPayments retries with backoff. Make sure `/webhooks/cp/pay` returns 5xx on DB error, not 200. |
| 3DS interrupted | Widget handles inline. If user closes mid-challenge, order stays `pending_payment` |
| Duplicate webhook | Idempotent transaction handles it. No double-grant. |
