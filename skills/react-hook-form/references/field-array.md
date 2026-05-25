# useFieldArray — Dynamic Field Lists

## Setup

```ts
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'

const schema = z.object({
  items: z.array(
    z.object({
      name: z.string().min(1),
      quantity: z.number().min(1),
    })
  ).min(1, 'At least one item required'),
})
type Schema = z.infer<typeof schema>

function LineItemsForm() {
  const { control, register, handleSubmit, formState: { errors } } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { items: [{ name: '', quantity: 1 }] },
  })

  const { fields, append, remove, insert, move, swap } = useFieldArray({
    control,
    name: 'items',
  })

  return (
    <form onSubmit={handleSubmit(console.log)}>
      {fields.map((field, index) => (
        // CRITICAL: use field.id as key, never index
        <div key={field.id}>
          <input {...register(`items.${index}.name`)} />
          {errors.items?.[index]?.name && (
            <span>{errors.items[index].name.message}</span>
          )}

          <input
            type="number"
            {...register(`items.${index}.quantity`, { valueAsNumber: true })}
          />

          <button type="button" onClick={() => remove(index)}>
            Remove
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => append({ name: '', quantity: 1 })}
      >
        Add item
      </button>

      {/* Array-level error */}
      {errors.items?.root && <p>{errors.items.root.message}</p>}
      {typeof errors.items?.message === 'string' && <p>{errors.items.message}</p>}

      <button type="submit">Submit</button>
    </form>
  )
}
```

## The field.id rule

`useFieldArray` generates a stable internal `id` for each element. **Always use `field.id` as the React `key`**, never the array index:

```tsx
// Correct
fields.map((field, index) => <div key={field.id}>...</div>)

// Wrong — causes key collisions when items reorder
fields.map((field, index) => <div key={index}>...</div>)

// Wrong — your data's id may not exist or may not be unique
fields.map((field, index) => <div key={field.data.id}>...</div>)
```

## All array methods

```ts
const { fields, append, prepend, remove, insert, move, swap, update, replace } = useFieldArray(...)

// append — add to end
append({ name: '', quantity: 1 })
append([{ name: 'A', quantity: 1 }, { name: 'B', quantity: 2 }])  // multiple

// prepend — add to beginning
prepend({ name: '', quantity: 1 })

// remove — remove by index
remove(0)
remove([0, 2])  // remove multiple by index

// insert — insert at position
insert(1, { name: 'New', quantity: 1 })

// move — reorder
move(0, 2)  // move item at index 0 to index 2

// swap — exchange two positions
swap(0, 1)

// update — replace item at index
update(0, { name: 'Updated', quantity: 5 })

// replace — replace entire array
replace([{ name: 'Reset', quantity: 1 }])
```

## Accessing array field data in handlers

Within event handlers, use `getValues` to read current array state:

```ts
const { getValues } = useForm<Schema>(...)

function duplicateItem(index: number) {
  const item = getValues(`items.${index}`)
  append({ ...item })
}
```

## useController with useFieldArray

When using custom input components with Controller inside field arrays:

```tsx
{fields.map((field, index) => (
  <div key={field.id}>
    <Controller
      name={`items.${index}.category`}
      control={control}
      render={({ field: ctrlField }) => (
        <CategorySelect {...ctrlField} />
      )}
    />
  </div>
))}
```

## Nested arrays (array of arrays)

For a form with "groups of items", use nested `useFieldArray` calls:

```ts
const schema = z.object({
  groups: z.array(z.object({
    groupName: z.string(),
    items: z.array(z.object({ name: z.string() })),
  }))
})

function GroupsForm() {
  const { control, register } = useForm<Schema>({ ... })

  const { fields: groups, append: appendGroup } = useFieldArray({
    control,
    name: 'groups',
  })

  return (
    <>
      {groups.map((group, groupIndex) => (
        <GroupRow
          key={group.id}
          groupIndex={groupIndex}
          control={control}
          register={register}
        />
      ))}
    </>
  )
}

function GroupRow({ groupIndex, control, register }: GroupRowProps) {
  // Each level gets its own useFieldArray with the full dot-path name
  const { fields: items, append: appendItem } = useFieldArray({
    control,
    name: `groups.${groupIndex}.items`,
  })

  return (
    <div>
      <input {...register(`groups.${groupIndex}.groupName`)} />
      {items.map((item, itemIndex) => (
        <input
          key={item.id}
          {...register(`groups.${groupIndex}.items.${itemIndex}.name`)}
        />
      ))}
      <button type="button" onClick={() => appendItem({ name: '' })}>
        Add item
      </button>
    </div>
  )
}
```

## Error handling for arrays

```ts
// Field-level error (specific item)
errors.items?.[0]?.name?.message

// Array-level error (from Zod .min() or .refine() on the array itself)
errors.items?.message         // Zod message string
errors.items?.root?.message   // RHF root error for the array

// Pattern: show array-level message
{Array.isArray(errors.items)
  ? null
  : errors.items?.message && <p>{errors.items.message}</p>
}
```

## Default values for field arrays

Always provide a non-empty `defaultValues` for arrays if the user should see at least one row on load:

```ts
useForm<Schema>({
  defaultValues: {
    items: [{ name: '', quantity: 1 }],  // Start with one empty row
  },
})
```

If `defaultValues.items` is `[]`, `fields` starts empty. The first `append` call adds the first row.

## shouldUnregister and arrays

With `shouldUnregister: false` (default), unmounted array items retain their values in the form state. This is the correct behavior for multi-step forms. Do NOT set `shouldUnregister: true` with field arrays that may be temporarily hidden — values will be dropped.
