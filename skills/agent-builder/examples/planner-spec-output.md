# Example: SPEC.md output from feature-planner

What a real `feature-planner` output looks like. Use as calibration: if your planner produces less structured / less concrete output, something's off.

**Scenario:** user asks "Add 2FA via TOTP to the auth flow" on a Next.js app with `better-auth`, Prisma, PostgreSQL.

---

## What main agent invokes

User message:

> Хочу добавить 2FA через TOTP в auth flow. better-auth + prisma уже есть, постгрес.

Main delegates to `@feature-planner`.

## What feature-planner returns

The planner returns SPEC content (which main then writes to disk). Below is what a good SPEC.md looks like:

---

```markdown
# SPEC: 2FA via TOTP

## Goal
Users can enroll a TOTP device (Google Authenticator, 1Password, Authy) and are required to provide a TOTP code on subsequent logins. Enrollment is optional per user; admins can enforce it for specific roles.

## Non-goals
- SMS-based 2FA (out of scope; security/reliability concerns)
- WebAuthn / passkeys (separate effort; can co-exist later)
- Recovery codes (Phase 2 — see below)
- Backup TOTP devices (Phase 2)

## Acceptance criteria
- [ ] User can navigate to /settings/security and enroll a TOTP device
- [ ] Enrollment displays QR code (otpauth:// URL) and a manual-entry secret
- [ ] User confirms enrollment by entering one valid 6-digit code
- [ ] On login, if user has enrolled TOTP, system prompts for code after password
- [ ] Login fails if TOTP code is incorrect or expired (>30s drift)
- [ ] Admin can mark a role as requiring TOTP; users in that role can't sign in without enrolling
- [ ] All TOTP secrets stored encrypted at rest
- [ ] Failed TOTP attempts rate-limited (5 per minute per user)

## File plan (with budgets)

| File | New/Modified | Target lines | Purpose |
|---|---|---|---|
| `prisma/schema.prisma` | Modified | +12 / -0 | Add `TotpDevice` model + relation to `User` |
| `prisma/migrations/.../migration.sql` | New (generated) | ~30 | Auto-generated migration |
| `src/lib/totp.ts` | New | ~80 | Pure TOTP logic: generate secret, verify code, build otpauth URL |
| `src/lib/totp.test.ts` | New | ~120 | Unit tests: known TOTP test vectors, drift handling, replay prevention |
| `src/lib/encryption.ts` | New | ~50 | AES-GCM wrap/unwrap for secrets at rest |
| `src/lib/encryption.test.ts` | New | ~40 | Unit tests for encrypt/decrypt round-trip |
| `src/server/auth/totp-routes.ts` | New | ~100 | Enrollment, verification, disable endpoints |
| `src/server/auth/totp-routes.test.ts` | New | ~150 | Integration tests with mock DB |
| `src/server/auth/login.ts` | Modified | +30 / -10 | Insert TOTP step after password verification |
| `src/app/settings/security/page.tsx` | New | ~120 | Enrollment UI: QR code, confirmation input |
| `src/app/login/totp/page.tsx` | New | ~60 | TOTP prompt during login flow |
| `src/middleware.ts` | Modified | +15 / -0 | Block role-enforced users without TOTP |

**Total budget:** ~750 lines new, ~40 modified

## Dependencies / external touches

**New libraries:**
- `otpauth@^9.3.0` (TOTP generation/verification; small, well-maintained, no deps)
- `qrcode@^1.5.4` (QR rendering, server-side)

**Skills main should load during implementation:**
- `nextjs` (route conventions, server components)
- `prisma` (schema syntax, migration workflow)
- `better-auth` (extending the auth flow correctly)
- `zod` (validation schemas for endpoint payloads)
- `tailwind` (UI styling)
- `react-hook-form` (enrollment form)
- `vitest` (test runner)
- `postgresql` (migration deployment)

**Migrations:** one new migration adding `totp_devices` table.

**Env vars:**
- `TOTP_ENCRYPTION_KEY` — 32-byte hex; must be present in production
- `TOTP_ISSUER` — string shown in authenticator app (e.g., "MyApp")

## Architecture decisions

- **TOTP secret encrypted at rest with AES-GCM, key from env.** Alternative considered: hash-only storage (rejected: TOTP verification requires the original secret).
- **TOTP verification has 30s ± 1 window drift tolerance.** Tighter is too painful (clock skew); looser allows replay. Industry standard.
- **TOTP step is a separate route, not modal.** Allows direct linking from password manager, easier to test, simpler state.
- **Role-enforced TOTP is enforced at middleware, not in routes.** Single point of control; routes don't need to check.
- **Pure logic in `src/lib/totp.ts` (Ousterhout: deep module).** Single import, hides RFC details, exports `generateSecret`, `verifyCode`, `buildOtpauthUrl`.
- **No backup/recovery codes in Phase 1.** They're security-critical and need their own design. Listed as non-goal explicitly.

## Open questions

1. **Rate limiting infrastructure.** Existing rate limiter in this codebase? If yes, reuse. If not, this PR adds one (~50 additional lines).
2. **TOTP for admin/staff accounts only initially, or all users?** Affects rollout strategy and whether enforcement UI is needed in Phase 1.
3. **Recovery flow if user loses TOTP device.** Currently: contact support to disable TOTP after manual identity verification. Acceptable for Phase 1?

## Phases

This SPEC is **Phase 1**. Phase 2 (separate SPEC after Phase 1 ships):
- Recovery codes (10 single-use codes generated at enrollment)
- Backup TOTP devices (multiple per user)
- Optional admin override (with audit trail)
```

---

## What the planner returns to main (summary)

After producing the SPEC above:

```
SPEC produced for: 2FA via TOTP.
- 8 acceptance criteria
- 12 files (8 new, 3 modified, 1 auto-generated), total budget ~790 lines
- 1 phase (Phase 2 deferred to separate SPEC)
- Skills for main to load during implementation: nextjs, prisma, better-auth, zod, tailwind, react-hook-form, vitest, postgresql
- Open questions: 3

Recommendation: Resolve open questions 1 and 2 with user before implementing. Question 3 can be deferred to a runbook.
```

Then planner **stops**. Does not offer to implement. Main reads SPEC, asks user the 3 open questions, then implements.

---

## What good vs not-good SPECs look like

### Good (this example)

- ✅ Goal in user POV, 2-3 sentences
- ✅ Non-goals explicit (prevents scope creep)
- ✅ Acceptance criteria testable from outside (observable pass/fail)
- ✅ File plan with budgets per file
- ✅ Skills for main listed by name from Kirill's stack
- ✅ Architecture decisions name choices AND rejected alternatives
- ✅ Open questions surfaced before implementation

### Not-good (avoid)

- ❌ "Add 2FA. It should be secure." (no acceptance criteria)
- ❌ "Files: a bunch in src/auth/" (no budget, no purpose)
- ❌ "Use industry-standard libraries" (no concrete library)
- ❌ "Discuss with user as needed" (no open questions surfaced)
- ❌ Planner continues into implementation suggestions ("first, install the library...")

---

## Calibration

If your `feature-planner` agent produces SPECs significantly less structured than this — check:
1. Is `karpathy-guidelines` skill actually preloaded? (Kirill's stack)
2. Is `permissionMode: plan` set? (Forces read-only — focuses planner on planning)
3. Is `model: opus` set? (Sonnet plans, but less rigorously)
4. Does the body require the 3-artifact structure? (SPEC + checklist + budgets)

See [agents/feature-planner.md](../agents/feature-planner.md) for the production agent that produces output at this quality level.
