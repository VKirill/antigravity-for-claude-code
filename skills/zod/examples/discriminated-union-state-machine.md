# Discriminated Union as State Machine

## Scenario

Model an order's lifecycle states as a TypeScript discriminated union with Zod, ensuring each state carries only its relevant fields and TypeScript narrows automatically in switch statements.

## States

| State | Fields |
|---|---|
| `draft` | items (non-empty array) |
| `pending_payment` | paymentIntentId |
| `paid` | paidAt, transactionId |
| `shipping` | trackingNumber, carrierCode |
| `delivered` | deliveredAt |
| `cancelled` | cancelledAt, reason |
| `refunded` | refundedAt, refundId |

## Schema

```ts
import { z } from "zod";

// Shared base fields on every order state
const OrderBaseSchema = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  totalCents: z.number().int().nonnegative(),
  createdAt: z.date(),
});

// Item schema
const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  priceCents: z.number().int().nonnegative(),
});

// Each state is a separate ZodObject with a literal "status" discriminator
const DraftOrderSchema = OrderBaseSchema.extend({
  status: z.literal("draft"),
  items: z.array(OrderItemSchema).nonempty(),
});

const PendingPaymentSchema = OrderBaseSchema.extend({
  status: z.literal("pending_payment"),
  paymentIntentId: z.string().min(1),
  items: z.array(OrderItemSchema).nonempty(),
});

const PaidOrderSchema = OrderBaseSchema.extend({
  status: z.literal("paid"),
  items: z.array(OrderItemSchema).nonempty(),
  paidAt: z.date(),
  transactionId: z.string(),
});

const ShippingOrderSchema = OrderBaseSchema.extend({
  status: z.literal("shipping"),
  items: z.array(OrderItemSchema).nonempty(),
  paidAt: z.date(),
  transactionId: z.string(),
  trackingNumber: z.string(),
  carrierCode: z.enum(["ups", "fedex", "dhl", "usps"]),
  shippedAt: z.date(),
});

const DeliveredOrderSchema = OrderBaseSchema.extend({
  status: z.literal("delivered"),
  items: z.array(OrderItemSchema).nonempty(),
  paidAt: z.date(),
  transactionId: z.string(),
  trackingNumber: z.string(),
  carrierCode: z.enum(["ups", "fedex", "dhl", "usps"]),
  shippedAt: z.date(),
  deliveredAt: z.date(),
});

const CancelledOrderSchema = OrderBaseSchema.extend({
  status: z.literal("cancelled"),
  cancelledAt: z.date(),
  reason: z.string().max(500),
});

const RefundedOrderSchema = OrderBaseSchema.extend({
  status: z.literal("refunded"),
  cancelledAt: z.date(),
  reason: z.string().max(500),
  refundedAt: z.date(),
  refundId: z.string(),
});

// The union — O(1) dispatch via "status" discriminator
export const OrderSchema = z.discriminatedUnion("status", [
  DraftOrderSchema,
  PendingPaymentSchema,
  PaidOrderSchema,
  ShippingOrderSchema,
  DeliveredOrderSchema,
  CancelledOrderSchema,
  RefundedOrderSchema,
]);

export type Order = z.infer<typeof OrderSchema>;

// Per-state types for use inside state-specific handlers
export type DraftOrder = z.infer<typeof DraftOrderSchema>;
export type PaidOrder = z.infer<typeof PaidOrderSchema>;
// ... etc.
```

## Parsing from the database

```ts
function parseOrderFromDb(raw: unknown): Order {
  const result = OrderSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Order DB row failed validation: ${result.error.flatten().fieldErrors}`
    );
  }
  return result.data;
}
```

## State machine transitions

TypeScript narrows correctly on every `switch` branch:

```ts
function processOrderEvent(order: Order, event: string): Order {
  switch (order.status) {
    case "draft": {
      // order.items is accessible — TypeScript knows this is DraftOrder
      if (event === "submit" && order.items.length > 0) {
        // Return new state — cast or re-parse (re-parse is safer)
        const nextState: PendingPaymentSchema = {
          ...order,
          status: "pending_payment",
          paymentIntentId: "pi_xxx",
        };
        return PendingPaymentSchema.parse(nextState);
      }
      return order;
    }

    case "pending_payment": {
      // order.paymentIntentId is accessible
      if (event === "payment_confirmed") {
        return PaidOrderSchema.parse({
          ...order,
          status: "paid",
          paidAt: new Date(),
          transactionId: "txn_xxx",
        });
      }
      return order;
    }

    case "paid": {
      if (event === "shipped") {
        return ShippingOrderSchema.parse({
          ...order,
          status: "shipping",
          trackingNumber: "1Z999AA10123456784",
          carrierCode: "ups",
          shippedAt: new Date(),
        });
      }
      return order;
    }

    case "shipping": {
      if (event === "delivered") {
        return DeliveredOrderSchema.parse({
          ...order,
          status: "delivered",
          deliveredAt: new Date(),
        });
      }
      return order;
    }

    case "delivered":
    case "cancelled":
    case "refunded":
      // Terminal states — no transitions
      return order;
  }
}
```

## Why discriminated union beats z.union here

- `z.union` tests schemas in order — O(n). With 7 states it tries all 7 on "draft" input.
- `z.discriminatedUnion("status", [...])` hashes the discriminator value — O(1). It looks up "draft" in a map and tests only `DraftOrderSchema`.
- TypeScript switch narrowing works identically for both, but `discriminatedUnion` gives better Zod error messages ("Invalid discriminator value, expected one of: draft, pending_payment, ...").

## Bonus: state-specific validation functions

```ts
export function isDraft(order: Order): order is DraftOrder {
  return order.status === "draft";
}

export function isPaid(order: Order): order is PaidOrder {
  return order.status === "paid";
}

// Use in business logic
function chargeOrder(order: Order) {
  if (!isDraft(order)) {
    throw new Error(`Cannot charge order in status: ${order.status}`);
  }
  // TypeScript knows order is DraftOrder here
  console.log("Charging for items:", order.items.length);
}
```
