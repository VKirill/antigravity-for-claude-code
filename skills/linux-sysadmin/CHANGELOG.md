# linux-sysadmin skill — CHANGELOG

## [2.0.0] — 2026-05-15

Full retrofit to skill-evaluation v3 standards using `bullmq` v2.0.1 as the gold-standard exemplar.

### Added
- `references/recommended-defaults.md` — canonical Ubuntu 24.04 production values: systemd `Restart=` policy per service type (web/queue/db/cron/always-on) with `RestartSec` + `StartLimitBurst`, UFW baseline (deny incoming, allow 2222/80/443, SSH rate-limit), Angie/Nginx tuning (`worker_processes`, `worker_connections`, `keepalive_timeout`, proxy timeouts, TLS defaults), Angie-specific features over vanilla Nginx, PM2 ecosystem.config.js defaults, PostgreSQL/Redis memory split rule of thumb on shared host, TLS cert renewal (Certbot timer + reload hook OR Angie built-in ACME), fail2ban jail thresholds (sshd 3/600s/3600s baseline), logrotate weekly×4 standard, backup retention 7 daily / 4 weekly / 12 monthly. Required by v3 for technical skills with operational knobs.
- `references/troubleshooting.md` — required for `risk: high-stakes` per v3. Symptom-indexed entries with Symptoms → Diagnose (bash one-liners) → Common causes → Fix (paste-runnable): disk full → service failure, OOM-killer hit Postgres/Redis/Node, nginx/Angie 502 (upstream exited), 504 (timeout), SSL cert expired / OCSP stapling broken, UFW blocks legitimate traffic, systemd service won't start (exit code 203/EXEC), cron silent fail (PATH/pipefail), backup ran but produced 0-byte file, high load average diagnostic escalation, open fd exhaustion (`EMFILE`), conntrack table full, DNS resolver down (systemd-resolved).
- `references/wrong-vs-right.md` — 7 preventive ❌/✅ pairs with "Why it matters" rationale: chmod 777 vs proper owner+0640/0750 perms, restart vs reload for graceful behavior, UFW lockout (second SSH session safety net), cron implicit PATH vs explicit + pipefail, certbot renew without deploy hook, systemd unit edit without daemon-reload, rm -rf vs truncate/journalctl --vacuum.
- `references/eval-cases.md` — v3 format: user-voice phrasing (RU/typos) + Expected behavior column. 10 positive (502, slow server, UFW reset, cert expired, systemd 203, disk full, PM2 config, reload vs restart, fail2ban, backup retention), 10 negative (k8s/Terraform/React/Prisma/BullMQ/Fastify/PG-EXPLAIN/Swarm/Windows/macOS), 5 edge cases (Redis policy on this host, PG OOM, EMFILE, conntrack, Angie vs Certbot).
- CHANGELOG.md — this file. v3 requires every skill to have one.

### Changed
- Frontmatter: added `risk: high-stakes` — triggers v3 mandatory artifacts (troubleshooting + recommended-defaults).
- Frontmatter `description` rewritten and tightened (669 → 539 chars). Now lists concrete trigger terms (firewall, ufw, fail2ban, OOM, load average, fd exhaustion, conntrack, journalctl, logrotate, systemd, certbot, ACME, 502, 504, etc.) and explicit SKIP rules (app code, Kubernetes, cloud-managed, non-Ubuntu).
- SKILL.md restructured 209 → 229 lines in Pattern 2 navigator shape: collapsed Diagnostic Playbook, Service Stack, and 6 inline how-to sections (Angie reload, Backup, Health Score, Output Format, etc.) into one-liner capability rows pointing to references. Capabilities section now indexes all 13 references + recommended-defaults + troubleshooting + wrong-vs-right.
- SKILL.md "Operating Contract" / "Safety Rules" sections combined and trimmed; the 7 safety rules now cross-link to `wrong-vs-right.md` instead of restating examples inline.
- SKILL.md "Health Score" section removed from SKILL.md body — operational state, doesn't belong in the navigator. (If needed for output convention, can live in a checklist.)
- API Reference table now follows v3 `| Topic | File |` shape covering all 13 existing references + 3 new artifacts.

### Verified (Context7 + upstream docs, 2026-05-15)
- systemd unit fields: `[Unit]`, `[Service]`, `[Install]` sections; `ExecStart`, `Restart=on-failure|always|no`, `RestartSec`, `Type=simple|notify|forking`, `WantedBy=multi-user.target`, `StandardOutput=journal`, `LimitNOFILE`, `TimeoutStopSec` — all standard and confirmed via `/systemd/systemd` Context7 lookup and existing `templates/systemd-service.template`.
- nginx directives used: `upstream`, `server`, `location`, `proxy_pass`, `proxy_http_version 1.1`, `proxy_set_header`, `keepalive`, `keepalive_timeout`, `worker_processes auto`, `worker_connections`, `ssl_protocols TLSv1.2 TLSv1.3`, `ssl_ciphers`, `add_header Strict-Transport-Security`, etc. — all standard nginx and 100% Angie-compatible.
- Angie-specific extensions identified: `acme_client` + `acme` directive with `$acme_cert_*` variable family for built-in ACME; native HTTP/3 (no module build); REST API; Prometheus metrics; active health checks; MQTT load balancing.
- UFW commands: `ufw default deny|allow incoming|outgoing`, `ufw allow PORT/proto`, `ufw limit 2222/tcp`, `ufw allow from IP to any port PORT proto tcp`, `ufw delete RULE_NUMBER`, `ufw status numbered|verbose`, `ufw logging on`, `ufw --force enable` — all confirmed standard UFW 0.36+ on Ubuntu 24.04.
- Certbot commands: `certbot certonly --webroot`, `certbot renew --dry-run`, `certbot renew --force-renewal`, `certbot certificates`, deploy hooks at `/etc/letsencrypt/renewal-hooks/deploy/*.sh`, `systemctl status certbot.timer` — confirmed certbot 4.x.

### Notes
- The 12 existing references files (angie.md, services.md, security.md, security-hardening.md, firewall.md, nginx.md, observability.md, performance-debugging.md, storage.md, systemd.md, tls-certificates.md, containers.md, REFERENCE.md) are unchanged in this pass. Their content was audited and found internally consistent with the new `recommended-defaults.md`. Future passes can compress/dedupe with `recommended-defaults.md` as source of truth.
- `references/security.md` and `references/security-hardening.md` overlap in scope — flagged for a future merge. Not done in this pass to keep diff surgical.
- This skill remains the OS-layer authority. Redis command questions defer to `redis` skill; PG query questions defer to `postgresql`; queue logic defers to `bullmq`. Cross-links in Related Skills make the boundary explicit.

## [1.0.0] — pre-2026-05-15

Initial skill — Ubuntu 24.04 production stack (Angie 1.11.3 + PM2 + PostgreSQL 18 + Redis 8 + Docker 29 + PHP 8.5 + UFW), with `references/` containing 12 domain files, 6 templates, 2 scripts, 3 checklists, and an integration `REFERENCE.md`. Pattern 2 structure present but lacking v3 mandatory artifacts (no `recommended-defaults.md`, no `troubleshooting.md`, no `wrong-vs-right.md`, no `eval-cases.md`, no `CHANGELOG.md`, no `risk:` frontmatter).
