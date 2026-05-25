# JS → TypeScript Migration Checklist

Pre-flight, acceptance, and self-check for migrating a JavaScript codebase to TypeScript.

---

## Pre-flight (before starting)

- [ ] Decide on strategy: rename-and-fix / allowJs incremental / JSDoc-first (see migration.md)
- [ ] Snapshot current error-free build: `npm run build` passes without errors
- [ ] All tests pass: `npm test` green
- [ ] Record current `@ts-ignore`/`@ts-expect-error` count (target: reduce to 0)
- [ ] Identify untyped dependencies and plan `@types/*` installs or ambient declarations
- [ ] Agree on TypeScript version pin with team (recommended: TS 6.0.x — note default-shifts: `strict: true`, `module: esnext`, `target: es2025`, `types: []`)
- [ ] Removed in TS 6: `amd` / `umd` / `systemjs` module systems; `--baseUrl`, `--moduleResolution classic`, `--outFile` deprecated; `esModuleInterop: false` no longer permitted — audit `tsconfig.json` and migration scripts for these before bumping
- [ ] Set initial `tsconfig.json` with `strict: false` and `noImplicitAny: false` (loosen later)
- [ ] Add `tsc --noEmit` to CI pipeline — failing CI is the signal to track progress

---

## Phase 1: Baseline (no type errors, permissive config)

- [ ] `tsconfig.json` created with `allowJs: true` or all files renamed to `.ts`
- [ ] `tsc --noEmit` runs without error (even with permissive config)
- [ ] CI green
- [ ] `@types/*` installed for all major dependencies
- [ ] Ambient declarations written for untyped packages (at minimum: `declare module "pkg"`)

---

## Phase 2: Enable `strict: true`

- [ ] Set `"strict": true` in tsconfig
- [ ] Fix all `noImplicitAny` errors (ts(7006), ts(7031))
  - [ ] All function parameters have explicit types
  - [ ] All `catch (e)` bindings handled as `unknown`
- [ ] Fix all `strictNullChecks` errors (ts(2532), ts(2531))
  - [ ] No `Object is possibly null` suppressions left unaddressed
  - [ ] Null checks added with `?.`, `??`, or `assertDefined`
- [ ] `tsc --noEmit` green with `strict: true`

---

## Phase 3: Domain Types

- [ ] Core domain models have explicit interfaces/types (User, Order, Product, etc.)
- [ ] API response shapes are typed (not `any`)
- [ ] Database row types defined (Prisma generated, or manual interface)
- [ ] Error handling uses typed errors (not `catch (e: any)`)
- [ ] Event/message types use discriminated unions where applicable
- [ ] IDs and domain primitives use branded types where mix-ups are risky

---

## Phase 4: Strict+

- [ ] `"exactOptionalPropertyTypes": true` enabled and errors fixed
- [ ] `"noUncheckedIndexedAccess": true` enabled — all `arr[0]` and `obj[key]` accesses null-checked
- [ ] `"verbatimModuleSyntax": true` enabled — all type-only imports use `import type`
- [ ] `"isolatedModules": true` enabled (if using Vite/esbuild/type-stripping)
- [ ] No `namespace` usage in new code
- [ ] No `const enum` in packages consumed by bundlers

---

## Acceptance Criteria (migration complete)

- [ ] `tsc --noEmit` exits 0 with `strict: true` and all target flags enabled
- [ ] Zero `@ts-ignore` comments in production code (`@ts-expect-error` allowed with documented reason)
- [ ] `any` count is < N (agreed threshold, typically < 10 for new code)
- [ ] All public function signatures have explicit parameter and return types
- [ ] All tests pass
- [ ] Build output is identical to pre-migration (no behavioral changes)
- [ ] CI pipeline includes `tsc --noEmit` as a required step

---

## Self-check (model verifies before declaring done)

- [ ] No `as any` casts added to silence errors — all silenced with `@ts-expect-error` + comment
- [ ] No `// @ts-ignore` added without comment explaining why
- [ ] No return types widened to `any` or `unknown` to avoid fixing the real type
- [ ] Branded types applied to at least: entity IDs (UserId, OrderId, etc.)
- [ ] `exactOptionalPropertyTypes` didn't require `| undefined` sprayed everywhere — if so, review the property design
- [ ] Migration did not change runtime behavior (types are erased — confirm with tests)

---

## Verification Commands

```bash
# Verify zero errors
tsc --noEmit
echo "Exit: $?"

# Count suppressions (should be 0 or documented)
grep -r "@ts-ignore\|@ts-expect-error" src --include="*.ts" | wc -l

# Count any escapes (informational)
grep -rn ": any\b\|as any\b" src --include="*.ts" | grep -v "@ts-expect-error" | wc -l

# Verify no implicit any remaining
grep -rn "ts(7006)\|ts(7031)" <(tsc --noEmit 2>&1) | wc -l
```
