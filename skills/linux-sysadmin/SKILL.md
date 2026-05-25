---
name: linux-sysadmin
description: "Linux sysadmin for Ubuntu 24.04 production — Angie (Nginx fork), PM2, PostgreSQL 18, Redis 8, Docker 29, PHP 8.5, UFW. Use when: server health, nginx, angie, reverse proxy, SSL, certbot, ACME, firewall, ufw, fail2ban, backup, disk space, OOM, load average, pm2, ecosystem.config.js, docker, journalctl, logrotate, systemd, systemctl, cron, sysctl, SIGTERM, fd exhaustion, conntrack. Also: site down, 502, 504, disk full, service crash, OOM-killed, SSL expired. SKIP: app code (→ app skill), Kubernetes, cloud-managed (ECS/GKE), non-Ubuntu."
stacks:
  - sysadmin
tags:
  - sysadmin
  - linux
  - devops
category: devops
color: green
displayName: Linux SysAdmin
risk: high-stakes
---

<!-- versions:start -->

## 🎯 Version Requirements (May 2026)

**Primary pins:**
- Ubuntu: `24.04 LTS`
- Angie: `1.11.x (Nginx fork, production default)`
- nginx: `1.28.x (mainline) / 1.26.x (stable)`
- Docker Engine: `29.x`
- PostgreSQL: `18.x`
- Redis: `8.x`
- PHP: `8.5.x (Active)`
- Node.js: `24.x (Active LTS)`

> Source of truth: [STACK_VERSIONS.md](../../STACK_VERSIONS.md) — verified 2026-05-16

<!-- versions:end -->

## Usage

Loaded automatically when its description matches the active task. Read only the section you need.

## Use this skill when

- Managing Ubuntu 24.04 production servers (this stack)
- Configuring or troubleshooting Angie (Nginx fork) as a reverse proxy
- Managing SSL/TLS via Certbot OR Angie's built-in ACME
- Configuring UFW firewall, fail2ban, SSH hardening
- Managing services via PM2 (Node.js) or systemd (everything else)
- Diagnosing: 502/504, disk full, OOM, slow load, connection refused, service crash, cron silent fail, fd exhaustion
- Tuning PostgreSQL/Redis at the OS host level (memory split, persistence, sysctl)
- Setting up backups, logrotate, cron/timer jobs

## Do not use this skill when

- Target OS is not Ubuntu/Debian Linux (other distros, macOS, Windows)
- Task is purely application code — use the matching app skill (`fastify`, `nodejs`, `nextjs`, etc.)
- Infrastructure is Kubernetes or cloud-managed (ECS, GKE, App Runner)
- Task is DB query tuning (use `postgresql`), Redis command semantics (use `redis`), or queue logic (use `bullmq`)

## Purpose

This skill owns the **OS layer** of a Vechkasov production server: Ubuntu 24.04 with Angie 1.11.3 reverse-proxying PM2-managed Node 24 apps and PHP 8.5-FPM, backed by PostgreSQL 18 and Redis 8, fronted by UFW and fail2ban, with Certbot or Angie built-in ACME for TLS. It covers safe edits to system config, service lifecycle, observability (journalctl + PM2 logs), backup baselines, and incident response when the box (not the app) is misbehaving.

This skill does NOT cover: application logic (use the app skill), Kubernetes (different paradigm), cloud-managed services. For Redis or Postgres command-level questions, defer to `redis` / `postgresql`. This skill handles the OS host they run on.

## Operating Contract

1. **Test before reload**: `angie -t` before `systemctl reload angie` — always
2. **Backup before edit**: `cp file file.bak.$(date +%s)` for any config in `/etc/`
3. **Reload over restart**: `systemctl reload` preserves connections; `restart` drops them
4. **Two SSH sessions** when editing UFW or sshd — fallback in case primary breaks
5. **Confirm destructive ops**: delete, drop, reset firewall — ask first
6. **`daemon-reload` after unit file edits** — systemd caches; reload forces re-parse
7. **Verify after changes**: status, curl, journalctl tail

See [wrong-vs-right.md](references/wrong-vs-right.md) for the seven preventive pairs (chmod 777, reload vs restart, UFW lockout, cron PATH, cert hook, daemon-reload, rm -rf vs truncate).

## Server Stack

| Component | Version | Config | Service |
|---|---|---|---|
| **Angie** | 1.11.3 | `/etc/angie/` | `angie.service` |
| **PostgreSQL** | 18 | `/etc/postgresql/18/main/` | `postgresql@18-main.service` |
| **Redis** | 8 | `/etc/redis/redis.conf` | `redis-server.service` |
| **PHP-FPM** | 8.5 | `/etc/php/8.5/fpm/` | `php8.5-fpm.service` |
| **Node.js / PM2** | Node 24, PM2 v6 | `ecosystem.config.js` per project | `pm2-ubuntu.service` |
| **Docker** | 29 | `/etc/docker/daemon.json` | `docker.service` |
| **UFW** | active | `/etc/ufw/` | ports 2222/80/443 |
| **SSH** | port 2222 | `/etc/ssh/sshd_config` | `sshd.service` |
| **Certbot** | 4.x | `/etc/letsencrypt/` | `certbot.timer` |

## Diagnostic Playbook

Top-down escalation when something is wrong:

1. Service running? → `systemctl status SVC` / `pm2 status` / `docker ps`
2. Port listening? → `ss -tlnp | grep :PORT`
3. Logs say what? → `journalctl -u SVC -n 50` / `pm2 logs APP` / `docker logs CTR`
4. Resources OK? → `free -h` / `df -h` / `top -bn1 | head -20`
5. Network OK? → `curl -I localhost:PORT` / `ufw status`
6. Dependencies OK? → `pg_isready` / `redis-cli ping`
7. Config valid? → `angie -t` / `docker compose config` / `systemd-analyze verify`
8. Permissions OK? → `ls -la` / `namei -l PATH` / `cat /proc/$PID/limits`

For symptom-indexed deep dives → [troubleshooting.md](references/troubleshooting.md).

## Capabilities

- **Angie / Nginx** — config syntax, reverse proxy, TLS, ACME, REST API, HTTP/3 → [angie.md](references/angie.md), [nginx.md](references/nginx.md)
- **systemd** — unit files (`ExecStart`, `Restart=`, `WantedBy=multi-user.target`), timers, `daemon-reload`, drop-ins → [systemd.md](references/systemd.md)
- **Services** — PostgreSQL 18, Redis 8 host-level ops, PHP-FPM, PM2 ecosystem → [services.md](references/services.md)
- **Firewall** — UFW baseline, rate limit, fail2ban jails → [firewall.md](references/firewall.md)
- **Security hardening** — SSH config, kernel sysctl, fail2ban, audit → [security.md](references/security.md), [security-hardening.md](references/security-hardening.md)
- **TLS certificates** — Certbot + reload hooks, Angie built-in ACME, OCSP → [tls-certificates.md](references/tls-certificates.md)
- **Storage** — disk usage, logrotate, backups, journal vacuum → [storage.md](references/storage.md)
- **Containers** — Docker Engine 29, compose, daemon.json → [containers.md](references/containers.md)
- **Observability** — journalctl, PM2 logs, Prometheus exporter (Angie native) → [observability.md](references/observability.md)
- **Performance debugging** — top/vmstat/iostat/iotop/conntrack, OOM analysis → [performance-debugging.md](references/performance-debugging.md)
- **Recommended defaults** — systemd Restart= policy per service, UFW baseline, Angie/Nginx tuning, PM2 ecosystem, PG/Redis memory split, fail2ban thresholds, logrotate weekly×4, backup 7/4/12 → [recommended-defaults.md](references/recommended-defaults.md)
- **Troubleshooting** — symptom-indexed (502/504, OOM, disk full, cert expiry, UFW lockout, systemd start failure, cron silent fail, 0-byte backup, load average, fd exhaustion, conntrack, DNS) → [troubleshooting.md](references/troubleshooting.md)
- **Wrong vs Right** — 7 preventive pairs (chmod 777, restart vs reload, UFW lockout, cron PATH, cert hook, daemon-reload, rm vs truncate) → [wrong-vs-right.md](references/wrong-vs-right.md)

## Behavioral Traits

- Tests every Angie config with `angie -t` before reloading
- Backs up any `/etc/` file before editing: `cp file file.bak.$(date +%s)`
- Prefers `reload` over `restart` for graceful behavior
- Opens a second SSH session before editing UFW or sshd
- Runs `systemctl daemon-reload` after editing unit files
- Vacuums journal weekly: `journalctl --vacuum-time=7d` (or via `journald.conf` `SystemMaxUse`)
- Verifies backups with `pg_restore -l` (catches 0-byte files; see `wrong-vs-right.md` #4)
- Adds `set -euo pipefail` to every shell script
- Uses systemd timers (not cron) when service-style ergonomics matter (env, logging via journalctl, `OnFailure=`)
- Cites `recommended-defaults.md` for tuning values — no inline magic numbers
- Defers Redis/Postgres command-level questions to the respective skill

## Important Constraints

- NEVER run `chmod -R 777` — define proper owner/group and use 0640/0750 (see `wrong-vs-right.md`)
- NEVER `restart` a public-facing service for a config change — `reload` if it supports it
- NEVER `ufw default deny incoming` without first ensuring SSH allow exists (lockout risk)
- NEVER edit a systemd unit file and `restart` without `daemon-reload`
- NEVER `rm` log files an active service holds open — use `truncate -s 0` or logrotate
- NEVER skip `angie -t` before `systemctl reload angie`
- NEVER expose application ports (3000, 5432, 6379, 9090) publicly — bind to 127.0.0.1 behind Angie
- NEVER edit `/etc/letsencrypt/` files directly — manage via `certbot` or Angie ACME
- ALWAYS verify after deploy: `systemctl status`, `curl /healthz`, `journalctl -u SVC -n 50`
- ALWAYS document a rollback path before destructive changes
- ALWAYS test cron/timer scripts with cron-like env: `env -i /bin/bash -c '<script>'`
- ALWAYS monitor backup exit code AND output size — 0-byte files are silent failures

## Output Format

Three sections in every operational response:

- **Status**: `OK` / `WARNING` / `CRITICAL`
- **What was done**: bulleted actions taken
- **Current state**: verification command output (status, curl, tail logs)
- **Rollback**: how to undo, if applicable

## Related Skills

### Runtime
- ✓ `nodejs` — Node 24 host (PM2 process management, ecosystem.config.js, graceful SIGTERM); OS-layer here, app-layer there

### Backing stores
- ✓ `postgresql` — DB tuning beyond memory split; `pg_dump`/`pg_restore`; query analysis
- ✓ `redis` — Redis command semantics, `maxmemory-policy` matrix, ACL design

### Queue
- ✓ `bullmq` — BullMQ workers run on this host via PM2 / systemd

### Web frameworks (proxied by Angie)
- ✓ `fastify`, ✓ `hono`, ✓ `nextjs`, ✓ `nuxt`, ✓ `astro` — apps behind Angie

### Container & IaC
- `docker` — Docker Engine 29 on this host; daemon.json, UFW/iptables interaction [cascade marker]
- `terraform` — provisions the servers this skill manages [cascade marker]

### Cloud platform (when this server lives on managed infra)
- ✓ `yandex-cloud` — when the Ubuntu host is a Yandex Cloud Compute VM. Adjacent surfaces: Managed PostgreSQL/Redis (replace self-hosted), Object Storage (replace `/var/www/uploads`), VPC + security groups (replace UFW for inter-host filtering), ALB (replace Angie for L7), Lockbox (replace env files), Cloud Logging (replace journalctl scraping). Canonical docs source: https://github.com/yandex-cloud/docs

### Code discipline
- ✓ `karpathy-guidelines`

## API Reference

Domain-specific references (Pattern 2) — load only what's relevant:

| Topic | File |
|---|---|
| Angie config, ACME, REST API, HTTP/3 | [references/angie.md](references/angie.md) |
| Vanilla Nginx config (when Angie features don't apply) | [references/nginx.md](references/nginx.md) |
| systemd unit files, timers, drop-ins, `daemon-reload` semantics | [references/systemd.md](references/systemd.md) |
| Services — PostgreSQL 18, Redis 8 host-level, PHP-FPM, PM2 | [references/services.md](references/services.md) |
| Firewall — UFW baseline, rate-limit, IP allowlist | [references/firewall.md](references/firewall.md) |
| Security — SSH config, fail2ban, audit | [references/security.md](references/security.md) |
| Security hardening — kernel sysctl, AppArmor, CIS baseline | [references/security-hardening.md](references/security-hardening.md) |
| TLS — Certbot timer + hooks, Angie ACME, OCSP stapling | [references/tls-certificates.md](references/tls-certificates.md) |
| Storage — disk usage, logrotate, backups, journal vacuum | [references/storage.md](references/storage.md) |
| Containers — Docker Engine 29, compose, daemon.json | [references/containers.md](references/containers.md) |
| Observability — journalctl, PM2 logs, Prometheus exporter | [references/observability.md](references/observability.md) |
| Performance debugging — top/vmstat/iostat/iotop, OOM analysis, conntrack | [references/performance-debugging.md](references/performance-debugging.md) |
| Full stack integration recipes (Angie + PM2 + PG + Redis + UFW) | [references/REFERENCE.md](references/REFERENCE.md) |
| **Recommended defaults** — systemd Restart=, UFW baseline, Angie tuning, PM2, PG/Redis memory split, fail2ban, logrotate, backup 7/4/12 | [references/recommended-defaults.md](references/recommended-defaults.md) |
| **Troubleshooting** — symptom-indexed: 502/504, OOM, disk full, cert expiry, UFW lockout, systemd start failure, cron silent fail, 0-byte backup, load avg, fd exhaustion, conntrack, DNS | [references/troubleshooting.md](references/troubleshooting.md) |
| **Wrong vs Right** — 7 preventive pairs (chmod 777, restart vs reload, UFW lockout, cron PATH, cert hook, daemon-reload, rm vs truncate) | [references/wrong-vs-right.md](references/wrong-vs-right.md) |
| Eval cases | [references/eval-cases.md](references/eval-cases.md) |

### Templates

| Template | File |
|---|---|
| systemd service unit with hardening defaults | [templates/systemd-service.template](templates/systemd-service.template) |
| Angie / Nginx site with reverse proxy + TLS | [templates/nginx-site.conf.template](templates/nginx-site.conf.template) |
| Angie upstream block (keepalive + health) | [templates/angie-upstream.conf.template](templates/angie-upstream.conf.template) |
| UFW baseline script (deny incoming, 22/80/443) | [templates/ufw-baseline.sh.template](templates/ufw-baseline.sh.template) |
| Certbot renew deploy hook | [templates/certbot-renew-hook.sh.template](templates/certbot-renew-hook.sh.template) |
| logrotate config — weekly × 4 | [templates/logrotate.conf.template](templates/logrotate.conf.template) |

### Scripts

| Script | File |
|---|---|
| `disk-cleanup.sh` — vacuum journal, Docker prune, APT clean | [scripts/disk-cleanup.sh](scripts/disk-cleanup.sh) |
| `health-check.sh` — service status + memory + disk + ports summary | [scripts/health-check.sh](scripts/health-check.sh) |

### Checklists

| Checklist | File |
|---|---|
| Server hardening baseline | [checklists/server-hardening.md](checklists/server-hardening.md) |
| Pre-deploy verification | [checklists/pre-deploy.md](checklists/pre-deploy.md) |
| Incident response | [checklists/incident-response.md](checklists/incident-response.md) |

**How to use**: 502/504 / OOM / disk full → `troubleshooting.md`. Tuning a knob → `recommended-defaults.md`. Writing a new unit file or proxy block → relevant template. Hardening a fresh host → `checklists/server-hardening.md`.
