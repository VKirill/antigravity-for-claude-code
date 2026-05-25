---
name: cybersecurity-audit
description: "Stack-agnostic vulnerability hunting — OWASP Top 10 2025, OWASP API Top 10, OWASP LLM Top 10, supply-chain via OSV.dev + native scanners, secrets, crypto, web (XSS/CSRF/CORS), SSRF, deserialization/RCE, broken access control, race conditions. Produces categorized findings + remediation plan. Use when: проверь на уязвимости, security audit, найди дыры, аудит безопасности, OWASP, SQL injection, XSS, CSRF, IDOR, SSRF, prompt injection, supply chain, dependency CVE, hardcoded secrets, security review, penetration testing prep. SKIP: secure-coding discipline upfront (→karpathy-guidelines); SOC2/PCI-DSS/HIPAA compliance audits; live exploitation / payload generation (defensive-only)."
tags: [security, vulnerabilities, owasp, audit, supply-chain, osv, llm-security]
---

## Usage

Loaded automatically when the user asks for a security audit, vulnerability check, or OWASP review. Used by the `worker-security-verifier` agent for its `## Vulnerability sweep` step. Stack-agnostic — works on Node/Python/Astro/Next/CRM/Telegram-bot/anything.

## Purpose

Most security scanners check one ecosystem and one class of issue. Real attackers chain: leaked secret → SSRF → IMDS credentials → S3 read → user data. A real audit covers all classes, in all stacks, with a remediation plan that prioritizes by exploitability × blast-radius, not just by CVSS score. This skill is the curated 2026 knowledge base for that.

## Use this skill when

- User asks to find vulnerabilities in code/codebase
- After dependency bump → verify CVE picture
- Before launching to public → final security pass
- After incident → root-cause-and-radius assessment
- When refactoring auth, crypto, payments, file uploads, external API calls
- When integrating a new third-party SDK (supply-chain check)
- When LLM features are added (prompt injection surface)

## Do not use this skill when

- Writing new code from scratch — use `karpathy-guidelines` to write safely upfront
- Compliance reports (SOC 2 / ISO 27001 / PCI-DSS / HIPAA) — niche; out of scope
- Active exploitation / penetration testing with real payloads — this skill is **defensive-only**: find issues + recommend fixes, never craft live exploits

## Capabilities

### OWASP Top 10 2025 — the foundation

The 10 most common web vulnerability classes, refreshed every few years by OWASP from real-world breach data. Apply this taxonomy to ANY web/API/service code:

1. Broken Access Control
2. Cryptographic Failures
3. Injection (SQL/NoSQL/Command/LDAP/XPath/SSTI)
4. Insecure Design
5. Security Misconfiguration
6. Vulnerable & Outdated Components
7. Identification & Authentication Failures
8. Software & Data Integrity Failures
9. Security Logging & Monitoring Failures
10. SSRF

→ Deep dive: [references/owasp-top-10-2025.md](references/owasp-top-10-2025.md)

### OWASP API Top 10 — for REST/GraphQL surfaces

Separate taxonomy because API attacks differ from form-based webapps: BOLA (Broken Object-Level Authorization), mass assignment, GraphQL introspection in prod, rate-limit absence, etc.

→ Deep dive: [references/owasp-api-top-10.md](references/owasp-api-top-10.md)

### OWASP LLM Top 10 — for AI features

Specific to LLM apps: prompt injection (direct/indirect), training-data poisoning, model DoS, sensitive info disclosure, system-prompt leak, insecure output handling.

→ Deep dive: [references/owasp-llm-top-10.md](references/owasp-llm-top-10.md)

### Injection patterns (deep)

Every injection vector with detection grep + remediation pattern: SQL (parameterize), NoSQL ($where), OS command, LDAP, XPath, Server-Side Template Injection (SSTI), header injection.

→ Deep dive: [references/injection-patterns.md](references/injection-patterns.md)

### Auth, session, access control

JWT pitfalls (`alg: none`, weak secret, missing exp), session fixation, IDOR, missing authz checks, privilege escalation, OAuth misconfig.

→ Deep dive: [references/auth-access-control.md](references/auth-access-control.md)

### Crypto + secrets

Weak hashes (MD5/SHA1 for passwords), broken modes (ECB), IV reuse, predictable RNG (`Math.random()` for tokens), timing-side-channels, hardcoded keys/tokens, .env hygiene, gitleaks patterns.

→ Deep dive: [references/crypto-secrets.md](references/crypto-secrets.md)

### Supply chain — OSV.dev + native scanners + typosquatting

**This is where OSV.dev lives.** Cross-ecosystem CVE check via Google's Open Source Vulnerabilities database, plus native scanners (`npm audit`, `pip-audit`, `cargo audit`, `govulncheck`), plus checks for typosquatting and dependency confusion.

→ Deep dive: [references/supply-chain-osv.md](references/supply-chain-osv.md)
→ Script: [scripts/run-osv-scan.sh](scripts/run-osv-scan.sh)

### Web frontend — XSS / CSRF / CORS / CSP

DOM/Stored/Reflected XSS, CSRF tokens vs SameSite, CORS misconfig (`Access-Control-Allow-Origin: *` with credentials), CSP holes (`unsafe-inline`, `unsafe-eval`), clickjacking, open redirect.

→ Deep dive: [references/web-frontend.md](references/web-frontend.md)

### SSRF, deserialization, RCE

Untrusted-input-to-code-execution chains: SSRF → IMDS / internal network; pickle/eval/Function/exec on user input; YAML.load unsafe; XML XXE.

→ Deep dive: [references/ssrf-deserialization.md](references/ssrf-deserialization.md)

### Race conditions

TOCTOU (Time-of-Check-Time-of-Use), idempotency window in payments (double-spend), token reuse, concurrent state mutation.

→ Deep dive: [references/race-conditions.md](references/race-conditions.md)

### Remediation plan

Findings → priority queue. Severity (Critical/High/Medium/Low) × exploitability × blast-radius → ordered checklist with owners + ETAs.

→ Template: [references/remediation-plan.md](references/remediation-plan.md)

## Behavioral Traits

- **Defaults to NEEDS WORK.** A green sweep means every check in the matrix ran clean — not "I ran a few and nothing jumped out".
- **Assumes hostile input** at every boundary (HTTP body, query params, headers, file uploads, external API responses, env vars from untrusted sources).
- **Treats secrets as already leaked** — checks rotation cadence and blast radius, not just presence.
- **Reads diffs first, then full files** — incremental audit is cheap, full-file rescan is expensive.
- **Outputs remediation** — not just "found XSS"; says "found XSS in `routes/user.ts:42`; fix: replace `innerHTML = req.body.name` with `textContent` or escape via DOMPurify".
- **Prioritizes by exploitability + blast** — a Critical CVE in a dev-only dep can wait; a Medium IDOR in user data cannot.
- **Cross-ecosystem checks via OSV.dev** — does not trust a single native scanner.
- **Reports INCONCLUSIVE** when a check can't be run, never fakes PASSED.
- **Never auto-fixes** — defensive-only; surface findings, suggest, let humans (or main thread) apply.

## Important Constraints

- NEVER craft live exploit payloads (curl injections, RCE PoCs against real targets) — this is defensive-only
- NEVER run `npm audit fix` / `pip-audit --fix` / any auto-remediation
- NEVER mark a finding as "false positive" without code evidence (file:line + reasoning)
- NEVER skip a check because "this stack probably doesn't have X" — run the check, let the result speak
- NEVER commit findings into the codebase (don't leave annotated source as a record — write into a separate report)
- ALWAYS cross-check supply-chain via OSV.dev when native scanners report 0 findings (sometimes they miss)
- ALWAYS rate severity using CVSS-aligned criteria + business context, not personal feel
- ALWAYS surface secrets findings with **full file path + git blame** so user knows when/who introduced

## Related Skills

### Authoring layer
- ✓ `karpathy-guidelines` — write secure code from the start (prevention)
- ✓ `skill-evaluation` — for editing this skill

### Stack skills (this skill references their conventions)
- ✓ `better-auth` — auth check patterns
- ✓ `zod` — schema validation strictness
- ✓ `pydantic` — same for Python
- ✓ `postgresql` — SQL injection prevention via parameterization
- ✓ `redis` — sensitive key TTL + ACL
- ✓ `nodejs` — process.env hygiene + AbortController
- ✓ `cloudpayments` · `yookassa` — payment-specific HMAC + idempotency
- ✓ `telegram-bot` · `vk-bridge` · `max-bridge` — initData/launch-params HMAC validation

### Tools the skill recommends running
- `osv-scanner` (Google) — `npx osv-scanner -L package-lock.json` or `osv-scanner --recursive .`
- `semgrep ci --config=auto` — pattern-based static analysis (free)
- `gitleaks detect --redact` — secret scan
- `trivy fs .` — IaC + container + deps
- `bandit -r .` — Python static
- `npm audit` / `pip-audit` / `cargo audit` / `govulncheck` — ecosystem-native

## API Reference

| Topic | File |
|---|---|
| Index, decision map, what-to-open-when | [references/REFERENCE.md](references/REFERENCE.md) |
| OWASP Top 10 2025 — full breakdown with grep patterns | [references/owasp-top-10-2025.md](references/owasp-top-10-2025.md) |
| OWASP API Top 10 — REST/GraphQL-specific | [references/owasp-api-top-10.md](references/owasp-api-top-10.md) |
| OWASP LLM Top 10 — prompt injection, system-prompt leak, etc. | [references/owasp-llm-top-10.md](references/owasp-llm-top-10.md) |
| Injection patterns — SQL/NoSQL/Command/LDAP/XPath/SSTI | [references/injection-patterns.md](references/injection-patterns.md) |
| Auth, sessions, JWT, IDOR, missing authz | [references/auth-access-control.md](references/auth-access-control.md) |
| Crypto pitfalls + secrets leakage + .env hygiene | [references/crypto-secrets.md](references/crypto-secrets.md) |
| Supply chain — **OSV.dev** + osv-scanner + native scanners + typosquatting | [references/supply-chain-osv.md](references/supply-chain-osv.md) |
| Web frontend — XSS / CSRF / CORS / CSP / clickjacking / open redirect | [references/web-frontend.md](references/web-frontend.md) |
| SSRF + deserialization + XXE + RCE chains | [references/ssrf-deserialization.md](references/ssrf-deserialization.md) |
| Race conditions — TOCTOU, idempotency, double-spend | [references/race-conditions.md](references/race-conditions.md) |
| Remediation plan template — Critical→Low ordered checklist | [references/remediation-plan.md](references/remediation-plan.md) |

## Templates

| Template | File |
|---|---|
| Audit report (markdown) | [templates/audit-report.md.template](templates/audit-report.md.template) |

## Scripts

| Script | File |
|---|---|
| `run-osv-scan.sh` — wraps osv-scanner CLI with REST fallback to api.osv.dev | [scripts/run-osv-scan.sh](scripts/run-osv-scan.sh) |
