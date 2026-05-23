# vitest — Migration: Vitest 3 → 4

Step-by-step guide to upgrading from Vitest 3.x to 4.x.

## Summary of breaking changes

| Change | Impact | Fix |
|---|---|---|
| `test.workspace` → `test.projects` | Config silently ignored | Rename key |
| Pool config flattened | Config silently ignored | Move to `poolOptions.*` |
| Snapshot format v2 | Existing snapshots fail | Run `--update-snapshots` |
| Spy isolation fixed | Cross-file spy tests fail | Add `vi.restoreAllMocks()` |
| Removed deprecated `vi.*` aliases | Runtime errors | Update to current names |
| `@vitest/browser` import path | Import errors | Use `vitest/browser` |

## Step 1: Update dependencies

```bash
npm install -D vitest@4 @vitest/coverage-v8@4 @vitest/browser@4 @vitest/ui@4
```

Check for peer dependency warnings. Vitest 4 supports **Vite 6 and Vite 7**. Vite 8 is **NOT** supported: Vitest 4.1.0 briefly added Vite 8 beta support, but 4.1.1 dropped it; Vitest 5 (still in beta as of 2026-05) is the line that will officially re-add Vite 8.

If still on Vite 5:
```bash
npm install -D vite@7 vitest@4
```

If on Vite 8: stay on Vitest 5 beta or pin Vite back to 7 until Vitest 5 GA.

## Step 2: Rename workspace → projects (if not already done in 3.2)

Search for `workspace` in all `vitest.config.*` files:

```bash
grep -r "test\.workspace" .
```

Rename every occurrence:

```ts
// Before:
export default defineConfig({ test: { workspace: ['packages/*/vitest.config.ts'] } })

// After:
export default defineConfig({ test: { projects: ['packages/*/vitest.config.ts'] } })
```

**There is no warning** when the old key is used — tests simply run without project config, appearing to work but ignoring monorepo structure.

## Step 3: Flatten pool config

Find top-level pool options:

```bash
grep -r "test\.forks\|test\.threads\|test\.vmForks\|test\.vmThreads" .
```

Move them under `poolOptions`:

```ts
// Before (v3):
export default defineConfig({
  test: {
    forks: {
      singleFork: true,
      isolate: false,
    },
  },
})

// After (v4):
export default defineConfig({
  test: {
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        isolate: false,
      },
    },
  },
})
```

## Step 4: Update snapshots

Run vitest once to see which snapshots fail:

```bash
vitest run --reporter=verbose 2>&1 | grep -i snapshot
```

When ready, regenerate all snapshots in v2 format:

```bash
vitest run --update-snapshots
```

Review the diff carefully before committing — snapshot changes should be intentional. If many snapshots changed in unexpected ways, the serializer format may have exposed hidden bugs in snapshot content.

## Step 5: Fix spy isolation

Vitest 4 fixed a bug where spy state leaked across test files. If you had tests that depended on this behavior (intentionally or not), they will now fail.

Pattern that breaks:
```ts
// fileA.test.ts
vi.spyOn(UserService, 'getUser').mockReturnValue({ id: '1' })
// (no restore)

// fileB.test.ts — assumed spy was still set from fileA
expect(UserService.getUser).toHaveBeenCalled()  // FAILS in v4
```

Fix pattern: scope spy setup and teardown to the test file that uses it:

```ts
// fileB.test.ts
beforeEach(() => {
  vi.spyOn(UserService, 'getUser').mockReturnValue({ id: '1' })
})
afterEach(() => {
  vi.restoreAllMocks()
})

it('calls getUser', () => {
  expect(UserService.getUser).toHaveBeenCalled()
})
```

## Step 6: Remove deprecated vi.* aliases

Check for removed aliases:

```bash
grep -r "vi\.advanceTimers\b\|vi\.clearTimers\b\|vi\.runAll\b" src/
```

Updated names:

| Removed (v3) | Current (v4) |
|---|---|
| `vi.advanceTimers` | `vi.advanceTimersByTime` |
| `vi.runAll` | `vi.runAllTimers` |
| `vi.clearTimers` | `vi.clearAllTimers` |
| `vi.mock.calls` (direct access) | `vi.mocked(fn).mock.calls` |

## Step 7: Update browser mode import paths

If using browser mode, update imports:

```ts
// Before:
import { page } from '@vitest/browser/context'

// After (v4 — still same, but verify version):
import { page, userEvent } from '@vitest/browser/context'
```

The package is still `@vitest/browser` but the in-test import path is `@vitest/browser/context`. Verify your test files use `@vitest/browser/context` not `vitest/browser`.

## Step 8: Verify CI

Run the full test suite:

```bash
vitest run --reporter=verbose
```

Common failures after upgrade:
- `Cannot find module '@vitest/coverage-v8'` — install the coverage package for the correct version
- Snapshot mismatches — run `--update-snapshots`
- `test.workspace is not a valid config option` — actually Vitest 4 doesn't warn, but tests won't be found — check for the rename
- `vi.restoreAllMocks is not a function` — unlikely; means wrong vitest version is loaded (check lockfile)

## Rollback

If v4 upgrade causes hard blockers, pin to v3:
```bash
npm install -D vitest@3 @vitest/coverage-v8@3
```

Report blockers at the Vitest GitHub issues before rollback — many v4 "issues" are fixed bugs that exposed real test problems.
