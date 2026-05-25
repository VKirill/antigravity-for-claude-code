# Migration Checklist: Next.js 15 → 16

## Pre-flight

- [ ] Back up or create a feature branch
- [ ] Run `next build` on the existing codebase — record all current warnings and errors
- [ ] Run `npm run test` (or equivalent) — confirm all tests pass before migration
- [ ] Note any webpack plugins or custom loaders in `next.config.*`
- [ ] Check `next.config.js` vs `next.config.ts` — Next.js 16 prefers `.ts`

## Step 1: Upgrade package versions

```bash
npm i next@16 react@19 react-dom@19
npm i -D @types/react@19 @types/react-dom@19
```

Verify:
- [ ] `package.json` shows `next: ^16.x`, `react: ^19.x`
- [ ] No peer dependency conflicts in `npm install` output

## Step 2: Rename middleware.ts → proxy.ts

```bash
mv middleware.ts proxy.ts
# or if in src/
mv src/middleware.ts src/proxy.ts
```

- [ ] File renamed to `proxy.ts`
- [ ] All imports of middleware utilities updated if any
- [ ] `export const config = { matcher: [...] }` still present

## Step 3: Fix async Dynamic APIs

Next.js 16 makes `params`, `searchParams`, `cookies()`, `headers()`, and `draftMode()` Promises.

### Pages

Search for all usages and await them:

```bash
# Find files that need updating
grep -r "params\." app/ --include="*.tsx" --include="*.ts" -l
grep -r "searchParams\." app/ --include="*.tsx" --include="*.ts" -l
```

Before:
```ts
export default function Page({ params }: { params: { id: string } }) {
  const { id } = params
```

After:
```ts
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
```

- [ ] All `page.tsx` files: `params` type changed to `Promise<{...}>`
- [ ] All `page.tsx` files: `searchParams` type changed to `Promise<{...}>`
- [ ] All `route.ts` files: `params` in second argument changed to `Promise<{...}>`
- [ ] All `layout.tsx` files that receive `params`: type updated

### cookies() and headers()

```bash
grep -r "cookies()" app/ --include="*.tsx" --include="*.ts" -l
grep -r "headers()" app/ --include="*.tsx" --include="*.ts" -l
```

Before:
```ts
const cookieStore = cookies()
const token = cookieStore.get('token')
```

After:
```ts
const cookieStore = await cookies()
const token = cookieStore.get('token')
```

- [ ] All `cookies()` calls are awaited
- [ ] All `headers()` calls are awaited
- [ ] `draftMode()` calls are awaited if used

### generateMetadata

```ts
// Before
export async function generateMetadata({ params }: { params: { id: string } })

// After
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
```

- [ ] All `generateMetadata` functions updated

## Step 4: Migrate caching (optional but recommended)

`'use cache'` directive replaces `unstable_cache` and `fetch` cache options.

### Replace unstable_cache

Before:
```ts
import { unstable_cache } from 'next/cache'
const getCachedProduct = unstable_cache(
  async (id: string) => db.products.findUnique({ where: { id } }),
  ['product'],
  { revalidate: 3600, tags: ['products'] }
)
```

After:
```ts
'use cache'
import { cacheLife, cacheTag } from 'next/cache'
export async function getProduct(id: string) {
  cacheLife('hours')
  cacheTag(`product-${id}`)
  return db.products.findUnique({ where: { id } })
}
```

- [ ] `unstable_cache` usages replaced with `'use cache'` directive
- [ ] `fetch` cache options replaced with `'use cache'` wrappers (optional — fetch options still work)
- [ ] `export const revalidate = N` on pages reviewed — `cacheLife` in data functions is preferred

## Step 5: Enable PPR (optional)

PPR is stable in Next.js 16. Enable incrementally per route or globally:

```ts
// Per route
export const experimental_ppr = true

// Or globally in next.config.ts
experimental: { ppr: true }
```

- [ ] PPR enabled on routes that benefit (pages with mix of static shell + dynamic data)
- [ ] `<Suspense>` boundaries placed around dynamic content

## Step 6: Fix Turbopack incompatibilities

Run `next build` and check for Turbopack errors:

- [ ] No webpack-specific plugins in `next.config.ts` (remove or replace with Turbopack equivalents)
- [ ] No `.babelrc` or `babel.config.js` — use SWC instead
- [ ] Custom loaders (e.g., `svg-inline-loader`) migrated to `turbopack.rules` in `next.config.ts`

If you have blocking incompatibilities, fall back: `next build --no-turbopack` and file an issue.

## Step 7: TypeScript types

Update `tsconfig.json` if needed:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "moduleResolution": "bundler",     // recommended for Next.js 16
    "allowImportingTsExtensions": true
  }
}
```

- [ ] No TypeScript errors from async params type changes
- [ ] `moduleResolution: "bundler"` set (or `"NodeNext"`)
- [ ] No type errors from React 19 changes (ref as prop, etc.)

## Acceptance

- [ ] `next build` completes without errors
- [ ] `next dev` starts without warnings about deprecated APIs
- [ ] All pages render correctly in development
- [ ] Server Actions submit and return correct state
- [ ] `proxy.ts` middleware redirects correctly
- [ ] Cache revalidation works: `revalidateTag` flushes cached data
- [ ] E2E tests pass (`playwright test` or equivalent)
- [ ] No regressions in Core Web Vitals (check Lighthouse before/after)

## Rollback

If migration fails:

```bash
git checkout main              # or restore branch
npm i next@15 react@18 react-dom@18
npm run build
```
