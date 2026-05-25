# CloudPayments — 54-ФЗ Fiscalization

Russian Federal Law 54-ФЗ requires every B2C cash transaction to produce a **fiscal receipt (чек)** transmitted to ОФД (Operator Fiscal Data) within 30 days. CloudPayments is a registered fiscal agent — attach a `CustomerReceipt` to charge/refund requests and CloudPayments takes care of ОФД transmission.

## CustomerReceipt shape

Attach via:
- **Widget**: pass in `data.CloudPayments.CustomerReceipt`
- **REST**: include `JsonData: { CloudPayments: { CustomerReceipt: {...} } }` in the charge request

```ts
type CustomerReceipt = {
  Items: ReceiptItem[];
  taxationSystem: 0 | 1 | 2 | 3 | 4 | 5;
  email?: string;          // one of email | phone is REQUIRED
  phone?: string;
  isBso?: boolean;         // true = БСО (Strict Reporting Form), false = чек
  AgentSign?: number;      // 1..7 — for agent/marketplace transactions
  AmountsHelp?: {
    electronic: number;    // paid online
    advancePayment?: number;
    credit?: number;
    provision?: number;
  };
};

type ReceiptItem = {
  label: string;           // up to 128 chars
  price: number;           // per unit, in rubles
  quantity: number;        // 0.001 precision
  amount: number;          // price × quantity (must match exactly)
  vat: 0 | 10 | 20 | null; // null = НДС не облагается
  method: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  object: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
  measurementUnit?: string; // "шт", "час", "месяц", etc.
};
```

## taxationSystem (СНО — Система налогообложения)

| Code | СНО | When |
|---|---|---|
| 0 | ОСН (общая) | Default for large businesses |
| 1 | УСН доходы | Most common SaaS / freelancers |
| 2 | УСН доходы минус расходы | SaaS with significant expenses |
| 3 | ЕСХН | Agricultural |
| 4 | Патент | Patent (ИП) |
| 5 | НПД (Самозанятый) | Self-employed |

Set this once per merchant config; it must match what's filed with ФНС.

## Vat (НДС)

| Value | Meaning |
|---|---|
| `null` | НДС не облагается (most SaaS on УСН) |
| `0` | НДС 0% |
| `10` | НДС 10% (essentials — food, books, kids' goods) |
| `20` | НДС 20% (standard rate since 2019) |

(Also `110` / `120` for calculated VAT — uncommon.)

## method (Признак способа расчёта)

| Code | Meaning |
|---|---|
| 1 | Предоплата 100% (full prepayment) |
| 2 | Предоплата (partial prepayment) |
| 3 | Аванс |
| 4 | Полный расчёт (most common — payment in full at delivery) |
| 5 | Частичный расчёт и кредит |
| 6 | Передача в кредит |
| 7 | Оплата кредита |

For SaaS: `4` (full payment, service delivered immediately). For pre-orders: `1`.

## object (Признак предмета расчёта)

| Code | Meaning |
|---|---|
| 1 | Товар |
| 2 | Подакцизный товар |
| 3 | Работа |
| 4 | Услуга |
| 5 | Ставка азартной игры |
| 6 | Выигрыш азартной игры |
| 7 | Лотерейный билет |
| 8 | Выигрыш лотереи |
| 9 | Предоставление РИД |
| 10 | Платёж |
| 11 | Агентское вознаграждение |
| 12 | Составной предмет расчёта |
| 13 | Иной предмет расчёта |

SaaS subscription → `4` (услуга). Physical goods → `1`. Donations → `13`.

## Example: SaaS subscription receipt

```ts
const customerReceipt = {
  Items: [
    {
      label: 'Подписка Pro · май 2026',
      price: 1000.00,
      quantity: 1.0,
      amount: 1000.00,
      vat: null,        // НДС не облагается (УСН)
      method: 4,        // полный расчёт
      object: 4,        // услуга
      measurementUnit: 'мес',
    },
  ],
  taxationSystem: 1,    // УСН доходы
  email: 'buyer@example.com',
  AmountsHelp: { electronic: 1000.00 },
};
```

## Email or phone

54-ФЗ requires the customer to receive the receipt. CloudPayments delivers via email OR SMS to the phone in the receipt. **Exactly one is required** (passing both is fine — email takes precedence).

## Multi-item receipts

Sum of `Items[].amount` MUST equal the charge `Amount`. Mismatch = ОФД rejects, merchant gets dashboard alert.

```ts
const customerReceipt = {
  Items: [
    { label: 'Книга «JS the good parts»', price: 800, quantity: 1, amount: 800, vat: 10, method: 4, object: 1 },
    { label: 'Доставка', price: 200, quantity: 1, amount: 200, vat: 20, method: 4, object: 4 },
  ],
  taxationSystem: 0,
  email: 'buyer@example.com',
  AmountsHelp: { electronic: 1000 },
};
// charge Amount = 1000 ✓
```

## Refund receipts (чек возврата)

When calling `/payments/refund`, attach a `CustomerReceipt` with the SAME items as the original charge (or partial subset for partial refund). CloudPayments transmits the "возврат прихода" receipt to ОФД.

Skipping the refund receipt = 54-ФЗ violation. Always include.

## Where the receipt data flows

```
Merchant API call ─► CloudPayments ─► OFD (Эвотор/ОФД.ru/Платформа ОФД)
                                       │
                                       └─► ФНС (Налоговая)
                                       └─► Customer email/SMS
```

`Pay` webhook payload includes `OperationType` and (optionally) `FiscalReceiptUrl` once the receipt is registered with ОФД. Store it on the order for compliance audits.

## Common mistakes

- ❌ Sum of items' `amount` doesn't equal charge `Amount` — ОФД rejects
- ❌ Wrong `taxationSystem` — receipt issues but tax filings break
- ❌ `vat: 0` instead of `vat: null` for УСН (zero VAT ≠ not subject to VAT)
- ❌ Missing email AND phone — fiscalization fails silently in some configs
- ❌ Refund without `CustomerReceipt` — original receipt remains active, customer technically still "owes" goods
- ❌ Hard-coding `object: 1` for service businesses

## Alternative: built-in receipt generation

For UI-driven flows, the widget UI offers to render receipt fields directly. Server-side flows must build the JSON manually — see `templates/customer-receipt.ts.template`.
