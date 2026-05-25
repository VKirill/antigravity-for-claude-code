# YooKassa — 54-ФЗ Fiscalization

YooKassa is a registered fiscal agent. Attach a `receipt` object to payment / refund / payout creation, and YooKassa transmits to ОФД automatically (АТОЛ / Эвотор / Платформа ОФД per merchant config).

## receipt object shape

```ts
type Receipt = {
  customer: { email?: string; phone?: string; full_name?: string; inn?: string };
  items: ReceiptItem[];
  tax_system_code?: 1 | 2 | 3 | 4 | 5 | 6;       // optional if set globally
  receipt_industry_details?: ReceiptIndustryDetail[];
  receipt_operational_details?: ReceiptOperationalDetail;
};

type ReceiptItem = {
  description: string;                            // ≤128 chars
  quantity: string;                               // e.g. "1.000"
  amount: { value: string; currency: string };   // per-line total
  vat_code: 1 | 2 | 3 | 4 | 5 | 6;
  payment_subject?: PaymentSubject;
  payment_mode?: PaymentMode;
  product_code?: string;
  country_of_origin_code?: string;
  customs_declaration_number?: string;
  excise?: string;
  supplier?: Supplier;
  agent_type?: AgentType;
  measure?: Measure;
  mark_quantity?: { numerator: number; denominator: number };
  mark_code_info?: object;
};
```

Pass `customer.email` OR `customer.phone` — one is required (both is fine).

## tax_system_code (СНО — Система налогообложения)

| Code | СНО |
|---|---|
| 1 | ОСН (общая) |
| 2 | УСН доходы |
| 3 | УСН доходы минус расходы |
| 4 | ЕНВД (deprecated post-2021 — leave for backfill only) |
| 5 | ЕСХН |
| 6 | Патент / Самозанятый |

Most modern SaaS / freelancer flows: `2` (УСН доходы) or `6` (Самозанятый).

If your merchant has only one СНО configured, you can omit `tax_system_code` — YooKassa uses the default.

## vat_code (Ставка НДС)

| Code | Meaning |
|---|---|
| 1 | НДС не облагается |
| 2 | НДС 0% |
| 3 | НДС 10% |
| 4 | НДС 20% |
| 5 | НДС 10/110 (расчётная) |
| 6 | НДС 20/120 (расчётная) |

Note: this is a DIFFERENT enum from CloudPayments. CloudPayments uses `null/0/10/20`; YooKassa uses `1..6`.

## payment_subject (Признак предмета расчёта)

| Value | Russian | When |
|---|---|---|
| `commodity` | Товар | Physical goods |
| `excise` | Подакцизный товар | Alcohol / tobacco |
| `job` | Работа | Construction / repair work |
| `service` | Услуга | SaaS subscriptions, consulting |
| `gambling_bet` | Ставка азартной игры | Gambling |
| `gambling_prize` | Выигрыш азартной игры | Gambling payout |
| `lottery` | Лотерейный билет | Lottery sale |
| `lottery_prize` | Выигрыш лотереи | Lottery payout |
| `intellectual_activity` | Предоставление РИД | IP licensing |
| `payment` | Платёж (аванс / задаток) | Deposits / advance |
| `agent_commission` | Агентское вознаграждение | Marketplace fee |
| `composite` | Составной предмет | Combined |
| `another` | Иной предмет | Catch-all |

SaaS → `service`. Donations → `another` or `payment`. Marketplace fee → `agent_commission`.

## payment_mode (Признак способа расчёта)

| Value | Russian | When |
|---|---|---|
| `full_prepayment` | Полная предоплата | Paid in full before delivery |
| `partial_prepayment` | Частичная предоплата | Partial advance |
| `advance` | Аванс | Generic advance |
| `full_payment` | Полный расчёт | Standard — pay & receive |
| `partial_payment` | Частичный расчёт и кредит | Partial + credit |
| `credit` | Передача в кредит | Buy now pay later |
| `credit_payment` | Оплата кредита | Loan installment |

For SaaS subscription (instant delivery): `full_payment`.
For pre-order: `full_prepayment`.

## Example: SaaS subscription

```ts
const receipt = {
  customer: { email: 'buyer@example.com' },
  items: [
    {
      description: 'Подписка Pro · май 2026',
      quantity: '1.00',
      amount: { value: '1000.00', currency: 'RUB' },
      vat_code: 1,                  // НДС не облагается (УСН)
      payment_subject: 'service',
      payment_mode: 'full_payment',
      measure: 'piece',             // или 'month' — proceed per docs
    },
  ],
  tax_system_code: 2,               // УСН доходы
};
```

## Example: multi-item with delivery

```ts
const receipt = {
  customer: { phone: '+79001234567' },
  items: [
    {
      description: 'Книга «JS the good parts»',
      quantity: '1.000',
      amount: { value: '800.00', currency: 'RUB' },
      vat_code: 3,                  // 10%
      payment_subject: 'commodity',
      payment_mode: 'full_payment',
    },
    {
      description: 'Доставка',
      quantity: '1.000',
      amount: { value: '200.00', currency: 'RUB' },
      vat_code: 4,                  // 20%
      payment_subject: 'service',
      payment_mode: 'full_payment',
    },
  ],
  tax_system_code: 1,               // ОСН
};
// total: 1000.00 — must equal payment.amount.value
```

## Sum-of-items invariant

`SUM(items[i].amount.value × items[i].quantity)` MUST equal `payment.amount.value` (within rounding to 2 decimals). Mismatch → ОФД rejects → merchant gets dashboard alert.

Actually, in YooKassa's receipt model, `items[i].amount.value` is the **per-line total** (price × quantity is computed by the merchant). Be careful: pass the final per-line subtotal here, not the unit price.

## measure (Единица измерения)

| Value | Russian |
|---|---|
| `piece` | Штука / единица |
| `gram` | Грамм |
| `kilogram` | Килограмм |
| `ton` | Тонна |
| `centimeter` | Сантиметр |
| `decimeter` | Дециметр |
| `meter` | Метр |
| `square_centimeter` | См² |
| `square_decimeter` | Дм² |
| `square_meter` | М² |
| `milliliter` | Миллилитр |
| `liter` | Литр |
| `cubic_meter` | М³ |
| `kilowatt_hour` | КВт·ч |
| `gigacalorie` | Гкал |
| `day` | Сутки |
| `hour` | Час |
| `minute` | Минута |
| `second` | Секунда |
| `kilobyte` | КБайт |
| `megabyte` | МБайт |
| `gigabyte` | ГБайт |
| `terabyte` | ТБайт |
| `another` | Иное |

For SaaS month-billed: `another` (with description "1 мес") is common, or `piece`.

## Refund receipt

When calling `POST /v3/refunds`, attach a matching `receipt` (FFD 1.2 requires it for B2C refunds).

```ts
const refund = await checkout.createRefund({
  payment_id: payment.id,
  amount: { value: '1000.00', currency: 'RUB' },
  receipt: {
    customer: { email: order.email },
    items: order.items.map((i) => ({
      description: i.label,
      quantity: String(i.quantity.toFixed(3)),
      amount: { value: (i.price * i.quantity).toFixed(2), currency: 'RUB' },
      vat_code: i.vatCode,
      payment_subject: i.subject ?? 'service',
      payment_mode: 'full_payment',
    })),
  },
}, crypto.randomUUID());
```

YooKassa transmits a "возврат прихода" receipt to ОФД.

## Auto-receipts ("авточек")

YooKassa offers "Авточек" — automatic receipt generation in dashboard from minimal merchant data. Useful for cash-on-delivery scenarios where the merchant doesn't structure items per item. Configure in dashboard; not all merchant accounts support it.

## Where the receipt data flows

```
Merchant API call ─► YooKassa ─► OFD (АТОЛ / Эвотор / Платформа ОФД)
                                  │
                                  └─► ФНС
                                  └─► Customer email / SMS
```

`GET /v3/receipts?payment_id={id}` returns registered fiscal receipts. The `fiscal_provider_id` and `fn_serial_number` fields are needed for accounting and disputes.

## Common mistakes

- ❌ `vat_code: 1` for 0% НДС (use `2` — `1` is "не облагается")
- ❌ Forgetting `tax_system_code` when merchant has multiple СНО configured
- ❌ `quantity: "1"` instead of `"1.00"` — YooKassa requires decimal format
- ❌ Sum of `items[].amount.value` differing from `payment.amount.value`
- ❌ Missing `payment_subject` — defaults vary; explicit is safer
- ❌ Refund without `receipt` when original had one — ОФД flags merchant
