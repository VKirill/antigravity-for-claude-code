# Example: verifier checklist outputs

Concrete examples of what `test-verifier`, `security-verifier`, and `payments-verifier` return on a typical feature PR. Use as calibration.

**Scenario:** Implementation of the 2FA SPEC from [planner-spec-output.md](planner-spec-output.md) is complete. Main agent invokes the three verifiers in parallel.

---

## test-verifier output

User invokes: `@test-verifier`

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
  (was the skip intentional? RFC 6238 vectors are the canonical correctness check)
- src/app/login/totp/page.tsx has no corresponding test file
  (UI is hard to unit-test but at least a render-smoke test is typical)
```

**What main does next:** fix the two failures, investigate why `enrollmentSessionId` is undefined (likely a missing import), decide whether to unskip the RFC test, and add a render-smoke test for the new page.

---

## security-verifier output

User invokes: `@security-verifier`

```
Verdict: 🔴 ISSUES FOUND

Summary: 1 Critical, 2 High, 1 Medium across 4 files

Issues:
- src/lib/encryption.ts:23 [🔴 Critical] secrets — TOTP_ENCRYPTION_KEY read with fallback to "dev-key-do-not-use"
  Remediation: throw at startup if env var missing; never fall back to a known weak key

- src/server/auth/totp-routes.ts:67 [⚠️ High] input-validation — enrollment payload accepts any string for `code` field
  Remediation: add Zod schema z.string().regex(/^\d{6}$/) before verification

- src/middleware.ts:34 [⚠️ High] auth — role check uses startsWith("admin") which matches "admin_disabled"
  Remediation: exact equality or check against allowlist set

- src/server/auth/totp-routes.ts:112 [🟡 Medium] logging — full TOTP secret logged on enrollment failure
  Remediation: log secret_id only; never log the actual secret value

Notes:
- npm audit reports 0 Critical, 0 High in production dependencies
- otpauth@9.3.0 used for verification — well-maintained, no known CVEs
```

**What main does next:** fix Critical immediately (encryption key fallback is a deploy-blocker), fix the two High in this PR, file the Medium as a follow-up commit.

---

## payments-verifier output

User invokes: `@payments-verifier` — but the 2FA change doesn't touch payment code.

```
Verdict: ⚠️ INCONCLUSIVE

Summary: 0 Critical, 0 High, 0 Medium across 0 files
Provider(s) detected: none

Reason: changed files (12 total) include no payment-related code. No CloudPayments / YooKassa SDK imports, no webhook handlers, no order/refund logic touched.

Recommendation: skip payments-verifier for this PR. It's appropriate only when payment-handling code is in the diff.
```

**What main does next:** ack and move on. (`payments-verifier` correctly returned INCONCLUSIVE rather than fake CLEAN — exactly the right behavior.)

---

## Composed report main presents to user

After all three verifiers return, main synthesizes:

```
Verification summary for 2FA implementation:

🔴 Tests: 2 failed
   - src/lib/totp.test.ts:67 (drift window assertion)
   - src/server/auth/totp-routes.test.ts:142 (missing import)

🔴 Security: 1 Critical, 2 High, 1 Medium
   Critical: TOTP_ENCRYPTION_KEY has unsafe fallback
   High: payload validation missing on enrollment; role check is prefix-match
   Medium: TOTP secret logged on error

⚠️ Payments: skipped (no payment code in diff)

Recommendation: fix Critical security issue first (deploy-blocker), then test failures, then High security. Medium can be a follow-up.

Want me to start fixing?
```

User: "yes, do it"

Main fixes in order:
1. Encryption key Critical — change to throw at startup
2. Test failures — fix import, investigate drift assertion
3. Two High security — add Zod schema, fix role check
4. Re-invoke verifiers in parallel to confirm CLEAN

---

## Calibration

If your verifiers return less specific output:

### Test-verifier symptoms
- Returns "tests pass" with no count → missing "MUST run COMPLETE" in body
- Returns full stack traces → output format too loose
- Returns PASSED but issues exist → Early Victory; tighten body
- Returns PASSED on a partial run → INCONCLUSIVE not in verdict vocabulary

### Security-verifier symptoms
- Returns "no issues found" on code with obvious secrets → sweep not running comprehensively
- Returns Critical for things that should be Medium → severity table not internalized; tune body
- Misses dependency CVEs → npm audit / pip-audit not in tool list

### Payments-verifier symptoms
- Returns CLEAN on payment code with no signature validation → body checklist incomplete
- Returns INCONCLUSIVE when payment code IS in diff → tool restriction too tight or file detection logic wrong

See [agents/test-verifier.md](../agents/test-verifier.md), [agents/security-verifier.md](../agents/security-verifier.md), [agents/payments-verifier.md](../agents/payments-verifier.md) for the production agents that produce output at this quality level.
