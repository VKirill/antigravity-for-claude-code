# References index — cybersecurity-audit

Slim navigator. Open the specific file when needed.

## Decision tree

```
User asks for a security audit
│
├─ "проверь весь проект на дыры"
│   → run full sweep: open every reference, walk OWASP Top 10 + API + LLM in order
│
├─ "проверь deps на CVE"
│   → supply-chain-osv.md → run scripts/run-osv-scan.sh
│
├─ "найди утечки секретов"
│   → crypto-secrets.md (secrets section)
│
├─ "проверь auth"
│   → auth-access-control.md
│
├─ "это безопасно?" (про конкретный сниппет)
│   → owasp-top-10-2025.md + matching specific reference
│
└─ "audit перед запуском" (готовность к проду)
    → ВСЁ + remediation-plan.md (prioritized checklist)
```

## When to open what

| Symptom / Task | Open |
|---|---|
| Полный audit неизвестного проекта | [owasp-top-10-2025.md](owasp-top-10-2025.md) + [supply-chain-osv.md](supply-chain-osv.md) first |
| Бэкенд API на Node/Python | + [owasp-api-top-10.md](owasp-api-top-10.md) |
| Есть LLM-фичи (агент, chatbot, RAG) | + [owasp-llm-top-10.md](owasp-llm-top-10.md) |
| Платежи (CloudPayments / YooKassa) | + [race-conditions.md](race-conditions.md) (idempotency) |
| Принимаем file upload или внешний URL | + [ssrf-deserialization.md](ssrf-deserialization.md) |
| Хешируем пароли / шифруем данные | + [crypto-secrets.md](crypto-secrets.md) (crypto section) |
| Любой web с UI | + [web-frontend.md](web-frontend.md) |
| Расширенный поиск injection-векторов | + [injection-patterns.md](injection-patterns.md) |
| Готовим отчёт после audit'а | + [remediation-plan.md](remediation-plan.md) + [../templates/audit-report.md.template](../templates/audit-report.md.template) |

## Quick patterns — fast lookup

| Signal in code | Likely vuln | Reference |
|---|---|---|
| `Math.random()` для токена/пароля | weak RNG | [crypto-secrets.md](crypto-secrets.md) |
| `MD5` / `SHA1` для пароля | broken crypto | [crypto-secrets.md](crypto-secrets.md) |
| `eval(req.body.x)`, `new Function(input)` | RCE | [ssrf-deserialization.md](ssrf-deserialization.md) |
| `pickle.loads(untrusted)` | RCE | [ssrf-deserialization.md](ssrf-deserialization.md) |
| `yaml.load` без SafeLoader | RCE | [ssrf-deserialization.md](ssrf-deserialization.md) |
| `req.query.x` в SQL без параметра | SQL injection | [injection-patterns.md](injection-patterns.md) |
| `exec`/`spawn`/`system` с shell:true и user-input | OS command injection | [injection-patterns.md](injection-patterns.md) |
| `innerHTML = req.body.x` | DOM XSS | [web-frontend.md](web-frontend.md) |
| `dangerouslySetInnerHTML` | React XSS | [web-frontend.md](web-frontend.md) |
| `Access-Control-Allow-Origin: *` + credentials | CORS leak | [web-frontend.md](web-frontend.md) |
| `unsafe-inline` / `unsafe-eval` в CSP | bypass | [web-frontend.md](web-frontend.md) |
| `req.params.userId` без authz check | IDOR / BOLA | [auth-access-control.md](auth-access-control.md) |
| JWT `alg: none` / `HS256 + asymm key` confusion | JWT bypass | [auth-access-control.md](auth-access-control.md) |
| Hardcoded `sk-...`, `AIza...`, `AKIA...` | leaked secret | [crypto-secrets.md](crypto-secrets.md) |
| `fetch(req.body.url)` server-side | SSRF | [ssrf-deserialization.md](ssrf-deserialization.md) |
| Webhook без HMAC verify | spoofed callback | [auth-access-control.md](auth-access-control.md) + worker-payments-verifier |
| `LLM.prompt = systemPrompt + user_input` без escape | prompt injection | [owasp-llm-top-10.md](owasp-llm-top-10.md) |
| Check-then-act без lock | TOCTOU | [race-conditions.md](race-conditions.md) |

## Tool quick-ref

| Need | Run |
|---|---|
| Cross-ecosystem CVE check | `bash scripts/run-osv-scan.sh` |
| Pattern-based static scan | `npx semgrep ci --config=auto` |
| Secrets scan | `npx gitleaks detect --redact` |
| Python static | `bandit -r .` |
| Containers + IaC | `trivy fs .` |
| Audit npm deps | `npm audit --json` |
| Audit Python deps | `pip-audit --format json` |
| Audit Rust deps | `cargo audit --json` |
| Audit Go deps | `govulncheck ./...` |

## Severity calibration (used across references)

| Level | Definition |
|---|---|
| 🔴 **Critical** | Deploy-blocker. Reachable RCE, leaked production secret, missing auth on data endpoint, unconstrained delete-from, dependency CVE Critical reachable from user input. |
| ⚠️ **High** | Must fix this PR. SQL injection in admin-only path (still bad), missing rate-limit on sensitive endpoint, weak Zod schema on user input, dep CVE High. |
| 🟡 **Medium** | Follow-up acceptable. Missing CSP header, weak password policy, hardcoded test secret, dep CVE Medium. |
| 🟢 **Low** | Note + defer. Outdated dep with no known CVE, missing security header (X-Frame-Options), informational disclosure. |

## Last verified

OWASP Top 10 → 2025 release; OSV.dev API → schema as of skill creation; native scanners → 2026 versions in their respective skills.
