# Example: building a feature end-to-end

Full session transcript showing main agent + planner + verifiers working together for the 2FA feature. Demonstrates the correct coordination pattern.

---

## User starts the session

**User:**
> Хочу добавить 2FA через TOTP в auth flow. better-auth + prisma уже есть, постгрес.

**Main agent** (assessing complexity):

> This is a non-trivial feature touching auth, DB schema, and UI. Let me get a plan first.
>
> [invokes @feature-planner]

---

## Planning phase

**`@feature-planner`** runs:

1. Reads `package.json`, `prisma/schema.prisma`, `src/server/auth/` to understand existing patterns
2. Reads `~/.claude/skills/better-auth/SKILL.md` (preloaded)
3. Produces SPEC + checklist + budgets
4. Returns summary, stops

**Planner returns to main:**

> SPEC produced for: 2FA via TOTP.
> - 8 acceptance criteria
> - 12 files (8 new, 3 modified, 1 auto-generated), total budget ~790 lines
> - 1 phase (Phase 2 deferred to separate SPEC)
> - Skills for main to load during implementation: nextjs, prisma, better-auth, zod, tailwind, react-hook-form, vitest, postgresql
> - Open questions: 3
>
> Recommendation: Resolve open questions 1 and 2 with user before implementing.

**Main** writes SPEC to `.claude/plans/2fa-totp/SPEC.md`, then asks the user:

> SPEC is ready. Three open questions before implementing:
>
> 1. Do you have an existing rate-limiting infrastructure to reuse, or should this PR add one?
> 2. Initial rollout — admin/staff only, or all users?
> 3. Recovery flow for lost devices — manual support (current acceptable Phase 1)? Or in scope?

**User:**
> 1. есть rate-limiter на redis, переиспользуй. 2. все юзеры опционально, role-enforce пока никому. 3. через поддержку, ок

**Main** updates SPEC with answers, confirms with user, then implements.

---

## Implementation phase (main agent, in main context)

Main loads the relevant skills (`nextjs`, `prisma`, `better-auth`, `zod`, etc.) and implements. No subagent involved during implementation. Main has full context throughout.

Progression:

1. **Schema migration**: edits `prisma/schema.prisma`, runs `npx prisma migrate dev --name add_totp_device`
2. **Pure TOTP logic**: creates `src/lib/totp.ts` + tests
3. **Encryption helper**: creates `src/lib/encryption.ts` + tests
4. **Server routes**: creates `src/server/auth/totp-routes.ts` + tests
5. **Modify login flow**: edits `src/server/auth/login.ts`
6. **UI pages**: creates enrollment and login-prompt pages
7. **Middleware**: edits `src/middleware.ts`

Total commits over the session: 5 (one per logical chunk).

Main then says:

> Implementation complete. Running verifiers in parallel.

---

## Verification phase

**Main invokes 3 verifiers in parallel** (since 2FA touches auth/security):

```
@test-verifier   →  runs vitest full suite
@security-verifier →  6-category sweep on changed files
@payments-verifier →  (will be INCONCLUSIVE, see below)
```

### test-verifier returns:

```
Verdict: 🔴 FAILED

Summary: 312 passed, 2 failed, 1 skipped, 315 total (8.4s)

Failures:
- src/lib/totp.test.ts:67 verifies TOTP within drift window
  AssertionError: expected true to equal false
- src/server/auth/totp-routes.test.ts:142 rejects expired enrollment session
  ReferenceError: enrollmentSessionId is not defined

Concerns:
- 1 test marked `.skip`: src/lib/totp.test.ts:198 "handles RFC 6238 test vector C"
```

### security-verifier returns:

```
Verdict: 🔴 ISSUES FOUND

Summary: 1 Critical, 2 High, 1 Medium across 4 files

Issues:
- src/lib/encryption.ts:23 [🔴 Critical] secrets — fallback to "dev-key-do-not-use"
- src/server/auth/totp-routes.ts:67 [⚠️ High] input-validation — `code` field accepts any string
- src/middleware.ts:34 [⚠️ High] auth — role check uses startsWith
- src/server/auth/totp-routes.ts:112 [🟡 Medium] logging — full secret logged on error
```

### payments-verifier returns:

```
Verdict: ⚠️ INCONCLUSIVE

Reason: no payment-related code in diff
Recommendation: skip payments-verifier for this PR
```

---

## Iteration phase

Main composes a summary for the user:

```
Verification results:

🔴 Tests: 2 failures
🔴 Security: 1 Critical, 2 High, 1 Medium
⚠️ Payments: skipped (not applicable)

Critical (deploy-blocker): TOTP_ENCRYPTION_KEY fallback to weak default.
Want me to fix everything in order of severity?
```

**User:**
> да, чини

Main fixes:

1. **Critical encryption key fallback** — changes to `throw new Error('TOTP_ENCRYPTION_KEY env var required')` if missing
2. **Test failure 1** (drift window) — investigates, finds clock-skew tolerance was off-by-one; fixes
3. **Test failure 2** (undefined variable) — adds missing import
4. **High: payload validation** — adds `z.object({ code: z.string().regex(/^\d{6}$/) })`
5. **High: role check** — changes `startsWith` to exact equality against allowlist
6. **Medium: secret in logs** — changes to log secret_id only

After fixes, main re-invokes verifiers in parallel.

### Re-verification

```
@test-verifier:    315 passed, 0 failed, 1 skipped, 316 total (8.7s) — ✅ PASSED
                    Note: 1 test still .skip — RFC 6238 vector. Investigated and added.

@security-verifier: 0 Critical, 0 High, 0 Medium — ✅ CLEAN
                    Notes:
                    - Consider rotating TOTP_ENCRYPTION_KEY periodically (out of scope for this PR)
```

Main confirms with user:

> Verification clean. 2FA implementation complete:
>
> - 12 files (8 new, 3 modified, 1 migration)
> - 315 tests pass (was 312 before this PR)
> - No security issues
> - SPEC in `.claude/plans/2fa-totp/SPEC.md` for reference
>
> Ready for code review.

---

## What this example demonstrates

### Correct patterns

✅ **Planner produced SPEC, stopped, did not implement** — planner-with-stop, no telephone game

✅ **Main implemented in main context** — no implementer subagent; main had full conversation memory throughout the multi-hour session

✅ **Three verifiers ran in parallel** after implementation — context isolation for each (test output, security sweep results, payments sweep) didn't pollute main

✅ **Main iterated on findings** — didn't accept findings and ship; verifier loop fired until clean

✅ **`payments-verifier` correctly INCONCLUSIVE** — not fake CLEAN on irrelevant code

✅ **No subagent tried to spawn another subagent**

✅ **Each verifier ran the complete sweep** — `test-verifier` ran 315 tests, not a sample; `security-verifier` ran all 6 categories on all 4 relevant files

### What would have gone wrong without this skill

If Kirill had instead created `planner` → `implementer` → `tester` → `reviewer` subagents (the role-split anti-pattern):

- ❌ Planner SPEC would be re-read by implementer, costing context tokens
- ❌ Implementer would reconstruct auth-flow knowledge that planner already understood
- ❌ Tester would write tests against an inferred contract, missing edge cases the planner had already considered
- ❌ Reviewer would read everything and reconstruct intent, then disagree with implementer on some design choices

Documented cost: Anthropic's experiment showed **sub-agents spent more tokens on coordination than on actual work** under this pattern.

Documented benefit of the pattern in this example: **fresh blackbox verification** at the end, **separate context for each verifier** (security and tests don't interfere), **no telephone game** because main remembered everything.

---

## Calibration takeaways

A session like this should:

- Total: ~20–40 task contracts, обычно 1 сессия Claude Code без compact (30–90 мин wall-clock).
- Subagent invocations: ~5 total (1 planner, 3 initial verifiers, then 2-3 re-verifiers after fixes)
- Main context: never compacted (the verifiers absorb the bulk-output phases)
- Open questions: surfaced **before** implementation, not discovered halfway through

If your sessions look very different — re-read [decision-framework.md](../references/decision-framework.md) and [decomposition-patterns.md](../references/decomposition-patterns.md).
