# linux-sysadmin — Eval Cases

v3 format: **user-voice phrasing** (Russian/typos/incomplete welcome) + **Expected behavior** column (which sub-files / templates should load, not just "this skill activates").

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "у меня nginx 502 на проде" | Load `troubleshooting.md` "nginx/Angie 502" section; show upstream-check curl + pm2/docker checks |
| "сервер тормозит, load average 18" | Load `troubleshooting.md` "High load average" section; show top→vmstat→iotop escalation |
| "хочу UFW сбросить и поставить только 22/80/443" | Load `recommended-defaults.md` "UFW baseline" + warn re: SSH lockout via `wrong-vs-right.md` UFW pair |
| "certbot не обновил сертификат, истёк" | Load `troubleshooting.md` "SSL cert expired"; cite `recommended-defaults.md` "TLS certificate renewal" and `wrong-vs-right.md` cert hook pair |
| "почему мой systemd сервис не стартует, exit code 203" | Load `troubleshooting.md` "systemd service won't start" + `templates/systemd-service.template`; explain `203/EXEC` |
| "disk full на /var, что чистить" | Load `troubleshooting.md` "Disk full" + `scripts/disk-cleanup.sh`; cite logrotate baseline in `recommended-defaults.md` |
| "PM2 на Node 24 — ecosystem.config.js пример" | Load `recommended-defaults.md` PM2 section; show `wait_ready` + `kill_timeout` + `max_memory_restart` |
| "Angie reload vs restart — что выбрать" | Load `wrong-vs-right.md` reload-vs-restart pair + `references/angie.md` workflow |
| "fail2ban для SSH — как настроить thresholds" | Load `recommended-defaults.md` fail2ban table; show `[sshd] maxretry=3 findtime=600 bantime=3600` jail config |
| "бэкап PG и Redis с retention 7/4/12" | Load `recommended-defaults.md` "Backup retention" + `troubleshooting.md` "Backup 0-byte file" wrong-vs-right pair |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "Kubernetes deployment yaml" | (no skill) | k8s, not bare Ubuntu |
| "Terraform AWS module" | (no skill) | IaC for cloud, not server ops |
| "React component lazy loading" | `react` | App-layer concern |
| "Prisma migration deploy" | `prisma` | ORM, not OS |
| "BullMQ worker concurrency" | `bullmq` | Queue lib, not deploy |
| "Fastify schema validation" | `fastify` | HTTP framework |
| "Postgres query optimization with EXPLAIN" | `postgresql` | DB layer, not host (use sysadmin only for OS-level perf) |
| "Docker Swarm cluster setup" | (no skill) | Swarm is niche; we use docker-compose |
| "Windows server IIS config" | (no skill) | Wrong OS |
| "macOS launchctl service" | (no skill) | Wrong OS |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "Redis maxmemory-policy для очереди на этом сервере" | **redis** PRIMARY (load `redis` skill `recommended-defaults.md` policy matrix); **linux-sysadmin** SECONDARY for host memory split. Surface both. |
| "Postgres OOM-killed, как защититься" | **linux-sysadmin** PRIMARY (load `troubleshooting.md` OOM section + `recommended-defaults.md` memory split); cross-link `postgresql` for `shared_buffers` tuning. |
| "Node app падает с EMFILE: too many open files" | **linux-sysadmin** PRIMARY (load `troubleshooting.md` "Open file descriptor exhaustion" + LimitNOFILE drop-in); cross-link `nodejs` for app-level fd hygiene. |
| "Docker conntrack table full на хосте" | **linux-sysadmin** PRIMARY (load `troubleshooting.md` conntrack section); cross-link `docker` cascade marker. |
| "Angie ACME автообновление vs Certbot — что лучше" | **linux-sysadmin** PRIMARY (load `recommended-defaults.md` "TLS certificate renewal" + `references/tls-certificates.md`); recommend Angie built-in ACME if available. |

## How to verify (manual)

1. Open a fresh session with this skill in `~/.claude/skills/linux-sysadmin/`.
2. Paste each Positive prompt → confirm:
   - System reminder lists `linux-sysadmin` as active
   - Response references files matching "Expected behavior"
   - For destructive actions: `wrong-vs-right.md` safety patterns are cited
3. Paste each Negative prompt → confirm `linux-sysadmin` does NOT activate and the listed alternative is mentioned.
4. Edge cases: confirm the response calls out the primary + cross-link explicitly.

If a prompt routes wrong:
- Negative → Positive → tighten `description` (currently broad — "any server management task" is intentionally aggressive for ops mode)
- Positive → Negative → add the missing trigger term
- Edge routing only to one skill → enrich Related Skills cross-links

Run after any change to SKILL.md description or major reference restructure.
