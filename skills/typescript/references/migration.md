# TypeScript — JS → TS Migration

Three strategies, JSDoc typing, strict ramp, `@ts-ignore` debt management.

---

## TS 5.x → 6.0 Upgrade Checklist (for projects already on TypeScript)

TypeScript 6.0 (2026-03-23, latest 6.0.3) is a **bridge release to TS 7 (Go-port)** with mostly default-shifts rather than new syntax. Before bumping, audit:

1. **`tsconfig.json` default-shifts** — TS 6 now defaults `strict: true`, `module: esnext`, `target: es2025`, `types: []`. If your config relied on the old defaults, you'll see surprise errors. **Fix**: set the old values explicitly, then migrate one at a time. The `"types": []` shift is the most disruptive — global `@types/*` packages (e.g. `@types/node`, `@types/jest`) are no longer auto-loaded; add `"types": ["node", ...]` explicitly.
2. **Removed module systems** — `amd`, `umd`, `systemjs` are gone. **Fix**: switch to `esnext` / `commonjs` / `nodenext`.
3. **Deprecated flags** — `--baseUrl`, `--moduleResolution classic`, `--outFile` are deprecated; `target: es5` deprecated. **Fix**: prefer `paths` without `baseUrl`; `moduleResolution: "bundler" | "nodenext"`; bundle outputs via Vite/Rollup instead of `--outFile`.
4. **Forced flags** — `esModuleInterop: false` and `allowSyntheticDefaultImports: false` are no longer permitted. **Fix**: remove these overrides (the new mandatory `true` matches what every bundler already assumes).
5. **`importsNotUsedAsValues` / `preserveValueImports`** — **removed**. **Fix**: use `verbatimModuleSyntax: true` (TS 5.0+) instead.
6. **New built-ins available** — `Temporal.*`, `RegExp.escape()`, `Map.prototype.getOrInsert*` — only usable with `lib: ["ES2025", ...]`.
7. **Subpath imports** — Node's `#/` prefix now works in TS without intermediate dirs. Optional but cleans up monorepo internals.

Verify post-bump: `tsc --noEmit` exit 0 on `strict: true`, no new `ts(2304)` (missing type) or `ts(1259)` (esModuleInterop) errors.

---

## Strategy Selection

| Strategy | When | Risk | Speed |
|---|---|---|---|
| **Rename-and-fix** | Small codebase (<10k lines), team committed to TS, can pause features | Medium | Fastest end-to-end |
| **`allowJs` + incremental** | Large codebase, migration in parallel with feature work | Low | Slow but continuous |
| **JSDoc-first** | Cannot change file extensions (tooling constraint), pure JS codebase | Low | Slowest |

---

## Strategy 1: Rename-and-Fix

Rename files, fix errors, raise strict flags gradually.

```bash
# Step 1: rename all .js files to .ts
find src -name "*.js" -not -path "*/node_modules/*" \
  -exec sh -c 'mv "$0" "${0%.js}.ts"' {} \;
```

**Phase 1 tsconfig** — permissive start:
```jsonc
{
  "compilerOptions": {
    "allowJs": false,
    "noImplicitAny": false,
    "strict": false,
    "skipLibCheck": true
  }
}
```

**Phase 2** — fix implicit any errors, raise flags one by one:
```bash
# Count implicit any errors
tsc --noEmit 2>&1 | grep "ts(7006)\|ts(7031)" | wc -l
```

**Phase 3 tsconfig** — final target:
```jsonc
{
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  }
}
```

**When to use**: teams that can dedicate a sprint. More churn upfront, clean state faster.

---

## Strategy 2: `allowJs` + File-by-File Migration

Keep existing JS files working; migrate one file at a time.

```jsonc
// tsconfig.json — starting state
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": false,        // Don't type-check JS files yet
    "strict": true,          // Strict applies only to .ts files
    "skipLibCheck": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"]    // includes both .js and .ts
}
```

**Migration workflow per file**:
1. Rename `foo.js` → `foo.ts`
2. Fix type errors in that file
3. Commit — CI verifies it stays green

**Batch migration approach**:
```bash
# Find files with no imports from other project files (low-risk to migrate first)
# These are leaf nodes in the dependency graph — safe to migrate in isolation
grep -rL "from '\.\." src --include="*.js" | head -20
```

Start with utility files (no imports from other project files). Finish with entry points.

---

## Strategy 3: JSDoc + `@ts-check`

Enable per-file type checking without renaming:

```js
// @ts-check
// This .js file is now type-checked by TypeScript

/**
 * @param {string} name
 * @param {number} age
 * @returns {import('./types').User}
 */
function createUser(name, age) {
  return { id: crypto.randomUUID(), name, age };
}
```

**JSDoc type annotation reference**:

```js
// @ts-check

/** @type {string} */
let name = "Alice";

/** @type {string | null} */
let maybeNull = null;

/** @type {(x: number) => number} */
const double = (x) => x * 2;

// Import types from .d.ts or .ts files
/** @type {import('./types').Config} */
const config = { port: 3000 };

// Generic function
/**
 * @template T
 * @param {T[]} arr
 * @param {(x: T) => boolean} predicate
 * @returns {T[]}
 */
function filter(arr, predicate) {
  return arr.filter(predicate);
}
```

**Enable globally** (after adding JSDoc to key files):
```jsonc
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true           // Now checks all .js files
  }
}
```

---

## Handling `@ts-ignore` Debt

**Never add `@ts-ignore` silently.** Always use `@ts-expect-error` — it fails CI if the suppressed error disappears:

```ts
// Bad: @ts-ignore — silently suppresses even if the error is fixed
// @ts-ignore
const x: string = 42;

// Good: @ts-expect-error — fails if the error no longer exists (tells you when it's safe to remove)
// @ts-expect-error — TODO: fix after migrating legacy API
const x: string = 42;
```

**Track suppressions**:
```bash
# Count current suppressions
grep -r "@ts-expect-error\|@ts-ignore" src --include="*.ts" | wc -l

# List with context (for review)
grep -rn "@ts-expect-error" src --include="*.ts" | head -30
```

Create a migration tracking file:
```markdown
# ts-migration-debt.md
| File | Line | Reason | Owner | Target date |
|---|---|---|---|---|
| api/legacy.ts | 42 | Old SDK has wrong types | @alice | 2026-06-01 |
```

---

## Strict Ramp Plan

Enable flags one at a time in CI. Each PR must not increase the error count.

**Recommended order** (least to most impactful):
1. `noImplicitAny: true` — biggest bang, eliminates widest class of bugs
2. `strictNullChecks: true` — may require many `!` assertions initially; replace with guards over time
3. `strict: true` — enables remaining 6 flags (others are incremental)
4. `noUncheckedIndexedAccess: true` — requires `arr[0] ?? default` patterns
5. `exactOptionalPropertyTypes: true` — may require explicit `| undefined` in some types

**Automation**: add a CI job that runs `tsc --noEmit` and fails on regression:
```yaml
# .github/workflows/typecheck.yml
- name: Typecheck
  run: |
    ERROR_COUNT=$(tsc --noEmit 2>&1 | grep "error TS" | wc -l)
    echo "TypeScript errors: $ERROR_COUNT"
    if [ "$ERROR_COUNT" -gt "$TS_ERROR_BUDGET" ]; then
      echo "Error count increased above budget!"
      exit 1
    fi
```

Set `TS_ERROR_BUDGET` to current count and ratchet it down each sprint.

---

## Adding Types for Untyped Dependencies

**Option A: Use `@types/*` if available**:
```bash
npm install -D @types/lodash @types/express
```

**Option B: Write a minimal ambient declaration**:
```ts
// types/untyped-pkg.d.ts
declare module "untyped-pkg" {
  export function doThing(x: string): number;
  export default class Thing {
    constructor(options: { debug?: boolean });
    run(): Promise<void>;
  }
}
```

**Option C: Stub as `any` temporarily** (to unblock migration):
```ts
// types/untyped-pkg.d.ts
declare module "untyped-pkg";  // module is typed as any — minimizes errors, loses type safety
```

Track Option C stubs as debt to replace with proper declarations.

---

## Common Migration Errors

### `Parameter 'x' implicitly has an 'any' type` (ts(7006))

```ts
// Before (JS)
function process(items) { return items.map(x => x.id); }

// After (TS)
function process(items: { id: string }[]): string[] {
  return items.map(x => x.id);
}
```

### `Object is possibly 'undefined'` (ts(2532))

```ts
// Before
const first = arr[0].name;

// After — option 1: null check
const first = arr[0]?.name;

// After — option 2: assert non-null (only when logically guaranteed)
const first = arr[0]!.name;  // document WHY this is safe
```

### `Property 'x' does not exist on type 'Y'` (ts(2339))

Usually signals a missing type definition or incorrect type assumption. Fix the type, don't suppress.

```ts
// Before: using dynamic property access
const val = config["some_key"]; // ts(2339) if config is typed

// After: add key to type or use Record
type Config = { some_key: string; other_key: number };
```

---

## Verification After Migration

```bash
# Zero errors (ideal)
tsc --noEmit && echo "PASS"

# Check for remaining suppressions
grep -r "@ts-expect-error\|@ts-ignore" src --include="*.ts"

# Check for remaining 'any' escapes (informational, not blocking)
grep -r ": any\b\|as any\b" src --include="*.ts" | grep -v "// eslint-disable"
```

See `checklists/migration-checklist.md` for the full pre-completion checklist.
