# vitest — Snapshots Reference

File snapshots, inline snapshots, snapshot v2 format, update workflow.

## Two types of snapshots

| Type | Stored | Best for |
|---|---|---|
| File snapshot (`toMatchSnapshot`) | `__snapshots__/file.test.ts.snap` | Large objects, serialized HTML, complex structures |
| Inline snapshot (`toMatchInlineSnapshot`) | Inside the test source file | Small stable values, self-documenting tests |

## File snapshots

```ts
import { describe, it, expect } from 'vitest'

it('renders user card', () => {
  const html = renderUserCard({ name: 'Alice', role: 'admin' })
  expect(html).toMatchSnapshot()
})
```

On first run, Vitest writes the snapshot to `__snapshots__/user-card.test.ts.snap`. On subsequent runs, it compares against the stored value.

Named snapshots (multiple per test):
```ts
it('renders all states', () => {
  expect(renderCard({ status: 'active' })).toMatchSnapshot('active state')
  expect(renderCard({ status: 'disabled' })).toMatchSnapshot('disabled state')
})
```

## Inline snapshots

```ts
it('formats currency', () => {
  expect(formatCurrency(1234.56, 'USD')).toMatchInlineSnapshot(`"$1,234.56"`)
})
```

On first run (with no argument), Vitest inserts the serialized value:
```ts
// Write:
expect(formatCurrency(1234.56, 'USD')).toMatchInlineSnapshot()

// After first run, file is updated to:
expect(formatCurrency(1234.56, 'USD')).toMatchInlineSnapshot(`"$1,234.56"`)
```

Inline snapshots for objects:
```ts
it('parses config', () => {
  expect(parseConfig('{"port":3000}')).toMatchInlineSnapshot(`
    {
      "port": 3000,
    }
  `)
})
```

## Updating snapshots

When the output legitimately changes, update stored snapshots:

```bash
# CLI flags (equivalent)
vitest run --update-snapshots
vitest run -u

# Watch mode interactive key
# Press 'u' to update failing snapshots
```

Always review what changed before committing updated snapshots — they're assertions, not generated code.

## Snapshot format v2 (Vitest 4)

Vitest 4 introduced snapshot format v2. Breaking change from v3:

- Shadow-root content is now serialized (v3 skipped it)
- Custom element attributes serialization changed
- Some whitespace normalization differences

When upgrading from v3 to v4, existing snapshot files may fail on the first run due to format differences. Run `vitest run --update-snapshots` once after upgrading to regenerate all snapshots in v2 format. Review the diff before committing.

## Custom serializers

Add custom snapshot serializers for project-specific types:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    snapshotSerializers: ['./src/test/my-serializer.ts'],
  },
})
```

```ts
// src/test/my-serializer.ts
export default {
  test(val: unknown): val is MyModel {
    return val instanceof MyModel
  },
  print(val: MyModel, serialize: (val: unknown) => string): string {
    return `MyModel(${val.id}: ${val.name})`
  },
}
```

## Snapshot best practices

**Use inline for**: primitives, small objects (< 10 properties), human-readable strings. The assertion lives next to the code — easier to review.

**Use file for**: HTML strings, large JSON payloads, component render output. File snapshots are reviewed in `git diff` during PR.

**Avoid snapshots for**: error messages with stack traces (contain file paths), timestamps, UUIDs, anything random/non-deterministic. These produce false positives on every run.

```ts
// Bad: snapshot contains dynamic data
expect(error).toMatchSnapshot()  // stack trace changes every run

// Good: assert the stable parts
expect(error.message).toBe('User not found')
expect(error.code).toBe('NOT_FOUND')
```

## Snapshot matchers

Asymmetric matchers work inside snapshots for partial matching:

```ts
expect(user).toMatchSnapshot({
  createdAt: expect.any(Date),  // allow any Date value
  id: expect.stringMatching(/^user_/),
})
```

## Cleaning up orphaned snapshots

```bash
vitest run --reporter=verbose  # shows which snapshots are unused

# Remove obsolete snapshots (those no longer referenced by any test)
vitest run --update-snapshots  # also removes obsolete entries
```

To check if snapshot files have unlinked entries, run vitest with `--passWithNoTests` in CI and review the output.
