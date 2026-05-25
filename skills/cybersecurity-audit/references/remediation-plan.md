# Remediation plan template

After findings are collected, prioritize. Severity alone is not enough — exploitability × blast radius decides the queue.

## Priority formula

```
Priority = Severity × Exploitability × Blast-radius

Severity:        Critical=4, High=3, Medium=2, Low=1
Exploitability:  Reachable from public input=3, Auth-required=2, Internal-only=1
Blast-radius:    All users=3, Tenant=2, Single user=1
```

Multiply → highest number first. Tie-break by effort (cheap fixes win).

## Plan format

```markdown
# Security remediation — {{PROJECT_NAME}}
Source: audit dated {{DATE}}

## P0 — fix now, block deploy until done

- [ ] [Critical · BOLA · 27pts · Effort S] `/api/orders/:id` returns any user's order
  - File: `src/routes/orders.ts:42`
  - Fix: add `userId: req.user.id` to `findFirst` where-clause
  - Verify: re-run worker-security-verifier; manual test with two user sessions
  - Owner: <name>
  - ETA: <date>

- [ ] [Critical · Hardcoded secret · 24pts · Effort M] Stripe live key in `src/lib/billing.ts:8`
  - Fix steps:
    1. Rotate key at https://dashboard.stripe.com immediately
    2. Move to env var `STRIPE_SECRET_KEY`
    3. Update `.env.example` with placeholder
    4. `git log -p -S "sk_live_"` to confirm no other history matches
    5. Optional: rewrite history via `git filter-repo` (if force-push acceptable)
  - Owner: ...
  - ETA: same-day

## P1 — fix this PR

- [ ] [High · Missing rate-limit · 18pts · Effort S] `/login` has no rate-limit
  - Fix: add `express-rate-limit` middleware; 5 attempts / 15 min / IP
  - Owner: ...
  - ETA: ...

## P2 — fix this sprint

- [ ] [Medium · Missing CSP · 12pts · Effort M] No CSP header on production
  - Plan: add via helmet with report-only mode for 1 week, then enforce
  - Owner: ...
  - ETA: ...

## P3 — backlog / defer with consent

- [ ] [Low · Missing Referrer-Policy · 3pts · Effort S]
  - Decision: deferred to next security pass
  - Why: low impact, no current threat actor

## Verification checklist (after fixes)

- [ ] Re-run `worker-security-verifier` agent — verdict should be PASSED (or NEEDS WORK for known deferred items)
- [ ] Re-run `osv-scanner --recursive` — confirm CVE count went down
- [ ] Re-run `gitleaks detect` — confirm 0 unexplained findings
- [ ] Manual test of fixed P0 items with 2 different user sessions
- [ ] Update `docs/security.md` with fix decisions

## Tracking

- [ ] All P0 items closed before merge
- [ ] Sign-off: <name> on <date>
- [ ] Next audit: <date / event>
```

## Effort estimation rubric

Единицы — task contracts (worker-coder round-trips), не человеко-часы. Калибровка см. `dev-orchestrator.md → Time estimation discipline`.

| Symbol | Meaning |
|---|---|
| S (Small) | 1 контракт. Middleware, env var, однострочный фикс — один worker round-trip. |
| M (Medium) | 2–4 контракта. Validation layer, refactor auth в одном модуле, миграция секрета. |
| L (Large) | 5–10 контрактов + отдельный SPEC. Замена auth-библиотеки, redesign tenancy filter, рефакторинг нескольких модулей. |
| XL | Отдельная фича / отдельный план. Архитектурное изменение; требует feature-planner и собственный `tasks.yaml`. |

## Communication patterns

### To stakeholders (non-technical)

Translate severity into business language:

| Severity | Plain-language explanation |
|---|---|
| Critical | "Someone external can take over user accounts or read all data right now" |
| High | "Real risk of data leak or account takeover under realistic attack" |
| Medium | "Defense layer is missing; not exploitable alone but weakens overall posture" |
| Low | "Hardening; nice to have, not blocking" |

### To developers (technical)

Include exact file:line + fix snippet. Don't say "fix the IDOR in orders.ts" — say "add `userId: req.user.id` to the `where` clause at orders.ts:42".

### To incident responders (if active exploitation suspected)

Include:
- Discovery timestamp
- Affected resources (users, tenants, data classes)
- Indicators of exploitation (log query to run)
- Rotation/invalidation steps already taken
- Open questions for forensics

## When to escalate

- Critical finding + evidence of active exploitation in logs → incident response (treat as breach until proven otherwise)
- Critical finding + unable to fix within 24h → notify stakeholders, consider taking endpoint offline
- Persistent finding across 3 audits → architectural issue, not a code issue; escalate for refactor decision

## Closing the loop

For each closed finding:

- [ ] Code fix landed (PR link)
- [ ] Test added (regression — same attack should now fail)
- [ ] Documented in `docs/security-decisions.md` if architectural
- [ ] Verifier re-run shows clean
- [ ] Stakeholder sign-off (for Critical/High)
