# useFieldArray — Dynamic Fields End-to-End

## Scenario

Build an invoice form where users can add, remove, and reorder line items (product name + quantity + unit price). The total is computed from the fields.

## Setup

```bash
npm install react-hook-form @hookform/resolvers zod
```

## Schema

```ts
import { z } from 'zod'

const lineItemSchema = z.object({
  productName: z.string().min(1, 'Required'),
  quantity: z.coerce.number().int().min(1, 'Must be ≥ 1'),
  unitPrice: z.coerce.number().min(0, 'Must be ≥ 0'),
})

const invoiceSchema = z.object({
  clientName: z.string().min(1, 'Client name is required'),
  items: z.array(lineItemSchema).min(1, 'At least one item required'),
})

type InvoiceSchema = z.infer<typeof invoiceSchema>
```

## Component

```tsx
'use client'

import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

const DEFAULT_ITEM = { productName: '', quantity: 1, unitPrice: 0 }

export function InvoiceForm() {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceSchema>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      clientName: '',
      items: [DEFAULT_ITEM],  // Start with one empty row
    },
  })

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'items',
  })

  const onSubmit = handleSubmit(async (data) => {
    await saveInvoice(data)
  })

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Client name */}
      <div>
        <label>Client Name</label>
        <input {...register('clientName')} />
        {errors.clientName && <span>{errors.clientName.message}</span>}
      </div>

      {/* Line items */}
      <div className="space-y-3">
        <h3>Line Items</h3>

        {/* Array-level error (from .min(1)) */}
        {errors.items?.root?.message && (
          <p className="text-red-600">{errors.items.root.message}</p>
        )}
        {!Array.isArray(errors.items) && errors.items?.message && (
          <p className="text-red-600">{errors.items.message}</p>
        )}

        {fields.map((field, index) => (
          // ALWAYS field.id as key — never index
          <LineItemRow
            key={field.id}
            index={index}
            control={control}
            register={register}
            errors={errors}
            onRemove={() => remove(index)}
            canRemove={fields.length > 1}
            onMoveUp={index > 0 ? () => move(index, index - 1) : undefined}
            onMoveDown={index < fields.length - 1 ? () => move(index, index + 1) : undefined}
          />
        ))}

        <button
          type="button"
          onClick={() => append(DEFAULT_ITEM)}
          className="text-sm text-blue-600 hover:underline"
        >
          + Add item
        </button>
      </div>

      {/* Total display */}
      <InvoiceTotal control={control} />

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Save Invoice'}
      </button>
    </form>
  )
}
```

## LineItemRow component

```tsx
import { Control, FieldErrors, UseFormRegister } from 'react-hook-form'

interface LineItemRowProps {
  index: number
  control: Control<InvoiceSchema>
  register: UseFormRegister<InvoiceSchema>
  errors: FieldErrors<InvoiceSchema>
  onRemove: () => void
  canRemove: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
}

function LineItemRow({
  index, control, register, errors,
  onRemove, canRemove, onMoveUp, onMoveDown,
}: LineItemRowProps) {
  return (
    <div className="grid grid-cols-[1fr,6rem,8rem,auto] gap-2 items-start">
      {/* Product name */}
      <div>
        <input
          {...register(`items.${index}.productName`)}
          placeholder="Product name"
          className="w-full rounded border px-2 py-1"
        />
        {errors.items?.[index]?.productName && (
          <span className="text-xs text-red-600">
            {errors.items[index].productName.message}
          </span>
        )}
      </div>

      {/* Quantity */}
      <div>
        <input
          type="number"
          {...register(`items.${index}.quantity`)}
          min={1}
          className="w-full rounded border px-2 py-1"
        />
        {errors.items?.[index]?.quantity && (
          <span className="text-xs text-red-600">
            {errors.items[index].quantity.message}
          </span>
        )}
      </div>

      {/* Unit price */}
      <div>
        <input
          type="number"
          step="0.01"
          {...register(`items.${index}.unitPrice`)}
          className="w-full rounded border px-2 py-1"
        />
        {errors.items?.[index]?.unitPrice && (
          <span className="text-xs text-red-600">
            {errors.items[index].unitPrice.message}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1">
        {onMoveUp && (
          <button type="button" onClick={onMoveUp} title="Move up">↑</button>
        )}
        {onMoveDown && (
          <button type="button" onClick={onMoveDown} title="Move down">↓</button>
        )}
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          title="Remove"
          className="text-red-500 disabled:opacity-30"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
```

## InvoiceTotal — computed from useWatch

```tsx
function InvoiceTotal({ control }: { control: Control<InvoiceSchema> }) {
  // useWatch in a child — avoids re-rendering the parent form
  const items = useWatch({ control, name: 'items' })

  const total = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.unitPrice) || 0
    return sum + qty * price
  }, 0)

  return (
    <div className="text-right font-medium">
      Total: ${total.toFixed(2)}
    </div>
  )
}
```

## Key points

1. `field.id` as React key — stable even after reorder operations (`move`, `swap`)
2. `z.coerce.number()` in schema — HTML inputs always return strings; coercion handles conversion
3. `useWatch` in `InvoiceTotal` — recomputes total without re-rendering the parent form
4. `errors.items?.[index]?.productName` — optional chaining is required since items may not have errors
5. `canRemove={fields.length > 1}` — prevents removing the last row (Zod `.min(1)` enforces this on submit, but UX should prevent it earlier)
6. `DEFAULT_ITEM` constant — always pass `append(DEFAULT_ITEM)` with explicit defaults, not `append({})`, to avoid uncontrolled-to-controlled warnings

## Verification

After implementation, verify:
- Adding a row preserves existing row values
- Removing a row by index removes only that row
- Moving a row up/down reorders without losing values
- Submitting with an empty productName shows per-row error
- Submitting with no rows shows the array-level `.min(1)` error
- Total updates reactively as quantity/price change
