# Recommended defaults — linux-sysadmin

Canonical values for Ubuntu 24.04 production servers running Angie/Nginx + PM2 + PostgreSQL 18 + Redis 8 + Docker 29 + UFW. **All other files in this skill cite this table — do not redefine inline.** Source: official systemd/nginx/Angie/UFW/certbot docs (Context7 + upstream), operational experience.

> Citation rule: every knob has a default + range + tune-up/tune-down condition + why.

## systemd service `Restart=` policy

Choose `Restart=` based on service type. `RestartSec=` controls the cooldown between attempts. `StartLimitBurst` + `StartLimitIntervalSec` prevent infinite crash-loops.

| Service type | `Restart=` | `RestartSec=` | `StartLimitBurst` / `IntervalSec` | Why |
|---|---|---|---|---|
| **Web app / API (Node, PHP-FPM)** | `on-failure` | **5s** | 5 / 60s | restart on crash but not clean exit; cooldown prevents tight loop |
| **Queue worker (BullMQ via PM2 or systemd)** | `on-failure` | **10s** | 5 / 120s | longer cooldown — likely Redis/DB transient |
| **Database (PostgreSQL, Redis)** | `on-failure` | **15s** | 3 / 300s | crash usually = corrupted state; fail loud after 3 attempts |
| **Cron-like one-shot** | `no` | — | — | systemd timer schedules next run; don't auto-restart |
| **Always-on (Angie, sshd)** | `always` | **5s** | 10 / 60s | even on clean exit (operator error), come back |

`Type=` rule of thumb: `simple` (default, exec stays foreground), `notify` (app calls `sd_notify(READY=1)` — pair with `NotifyAccess=main`), `forking` (legacy double-fork; avoid for new services).

Always set `TimeoutStopSec=30s` (or longer for queue workers — match `kill_timeout` in PM2 and `terminationGracePeriodSeconds` in k8s).

## UFW baseline

Default policy: **deny incoming, allow outgoing**. Open the minimum.

| Port | Proto | Use | Rate-limit |
|---|---|---|---|
| **2222** | tcp | SSH (non-standard port) | `ufw limit 2222/tcp` (6 conns / 30s) |
| **80** | tcp | HTTP — Angie/Nginx (HTTPS redirect + ACME challenge) | — |
| **443** | tcp | HTTPS — Angie/Nginx | — |

```bash
ufw default deny incoming
ufw default allow outgoing
ufw limit 2222/tcp comment 'SSH rate-limited'
ufw allow 80/tcp   comment 'HTTP'
ufw allow 443/tcp  comment 'HTTPS'
ufw logging on
ufw --force enable
```

Never open application ports (3000, 5432, 6379, 8080, 9090) — keep them on `127.0.0.1` behind Angie or use a private network.

For admin SSH lockdown: `ufw allow from <office-ip> to any port 2222 proto tcp` and drop the broad `limit` rule.

## Angie / Nginx tuning

The same directives work on both — Angie is an Nginx fork with 100% syntax compatibility.

| Knob | Default | Range | Tune-up when | Tune-down when | Why |
|---|---|---|---|---|---|
| `worker_processes` | **`auto`** | 1–N (cores) | leave `auto` — Angie/Nginx picks #cores | — | one worker per CPU is optimal for event-driven IO |
| `worker_connections` | **2048** | 1024–65535 | high concurrent connections | constrained `nofile` ulimit | per-worker; total = `worker_processes × worker_connections` |
| `worker_rlimit_nofile` | **65535** | 4096–1048576 | match `worker_connections × 2` | — | each connection needs one fd; raise OS limit to match |
| `keepalive_timeout` | **65s** | 15–120s | clients reuse conns heavily | tight memory | balances keep-alive savings vs idle conn memory |
| `keepalive_requests` | **1000** | 100–10000 | very high throughput | — | requests per keep-alive connection before close |
| `client_max_body_size` | **1m** | 1m–500m | file uploads | strict APIs | bounds memory; per-server/location |
| `proxy_read_timeout` | **60s** | 10–300s | long-running endpoints (reports, ML, SSE) | strict APIs | upstream read window after each chunk |
| `proxy_connect_timeout` | **10s** | 5–30s | flaky network to upstream | LAN to upstream | TCP connect to upstream |
| `proxy_send_timeout` | **60s** | 10–300s | large upload to upstream | — | inter-chunk send window |
| `gzip` | **`on`** | on/off | text-heavy responses | already-compressed (images, video) | bandwidth saving |
| `server_tokens` | **`off`** | on/off | always off in prod | — | hide version in `Server:` header |

### TLS defaults

```nginx
ssl_protocols       TLSv1.2 TLSv1.3;
ssl_ciphers         HIGH:!aNULL:!MD5;
ssl_prefer_server_ciphers off;
ssl_session_cache   shared:SSL:10m;
ssl_session_timeout 10m;
ssl_session_tickets off;
# HSTS — only after you're sure TLS works for all subdomains
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

### Angie-specific (over vanilla Nginx)

- **Built-in ACME** (`acme_client` + `acme` directives + `$acme_cert_*`) — no Certbot needed
- **REST API** on dedicated server block — runtime stats, upstream health, config view
- **HTTP/3** native (no `quic-module` build)
- **Prometheus metrics** export endpoint
- **Active health checks** for upstreams (vs Nginx OSS passive-only)
- **MQTT load balancing** support
- Config syntax 100% Nginx-compatible — switch the binary, keep configs

## PM2 `ecosystem.config.js`

```javascript
module.exports = {
  apps: [{
    name: 'my-app',
    script: 'dist/index.js',
    cwd: '/home/ubuntu/apps/my-app',

    instances: 1,                  // or 'max' for stateless CPU-bound
    exec_mode: 'fork',             // 'cluster' if instances > 1 AND stateless

    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 5000,
    max_memory_restart: '1G',

    kill_timeout: 10000,           // SIGTERM grace
    wait_ready: true,              // wait for process.send('ready')
    listen_timeout: 10000,

    env: { NODE_ENV: 'production' },

    out_file:   '/home/ubuntu/.pm2/logs/my-app-out.log',
    error_file: '/home/ubuntu/.pm2/logs/my-app-err.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
  }],
};
```

| Knob | Default | Range | When to change |
|---|---|---|---|
| `instances` | **1** | 1–`max` | stateful → 1; stateless API → `max` or core count |
| `exec_mode` | **`fork`** | `fork` / `cluster` | `cluster` requires stateless + `instances > 1` |
| `max_memory_restart` | **`1G`** | 256M–8G | memory leak insurance; size for your app |
| `kill_timeout` | **10000** ms | 5000–60000 | exceed p99 job duration for queue workers |
| `wait_ready` | **`true`** | true/false | true → zero-downtime reload waits for `process.send('ready')` |
| `max_restarts` | **10** | 5–50 | crash-loop budget before PM2 marks `errored` |
| `min_uptime` | **`10s`** | 5s–60s | survive boot for this long → counts as healthy |

After config: `pm2 start ecosystem.config.js`, then `pm2 save` + `pm2 startup ubuntu` for boot persistence.

## PostgreSQL 18 + Redis 8 on the same host — memory split

Rule of thumb on a dedicated app host with PG + Redis:

| Memory budget | PG `shared_buffers` | PG `effective_cache_size` | Redis `maxmemory` |
|---|---|---|---|
| **25%** of RAM | total RAM × 0.25 | total RAM × 0.75 | — |
| **40%** of RAM | — | — | total RAM × 0.40 |
| Leave **20%** for kernel + app processes + buffer cache for non-PG files |

Example, 16 GB host: PG `shared_buffers=4GB` + `effective_cache_size=12GB` (overlaps OS cache), Redis `maxmemory 6gb`, leaves 3.2 GB for Node/PHP/system.

For Redis policy per use case (cache vs queue vs primary) and per-knob tuning — see `redis` skill `references/recommended-defaults.md`. For PG tuning beyond memory split — see `postgresql` skill.

## TLS certificate renewal

### Certbot (current default)

`certbot --installer` auto-creates a systemd timer (`certbot.timer`) that runs `certbot renew` twice daily and reloads Angie on success.

```bash
systemctl list-timers certbot.timer
systemctl status certbot.timer
certbot renew --dry-run                # verify before relying on it
```

Reload hook (`/etc/letsencrypt/renewal-hooks/deploy/reload-angie.sh`):
```bash
#!/bin/bash
systemctl reload angie
```

### Angie built-in ACME (recommended migration)

```nginx
acme_client letsencrypt https://acme-v02.api.letsencrypt.org/directory;

server {
    listen 443 ssl;
    server_name app.example.com;
    acme letsencrypt;                                    # auto-renews
    ssl_certificate     $acme_cert_letsencrypt;
    ssl_certificate_key $acme_cert_letsencrypt_key;
}
```

No timer / no Certbot — Angie handles renewal in-process. Saves a cron, removes the renew-hook complexity. See `references/tls-certificates.md` for the full migration walkthrough.

## fail2ban jail thresholds

```ini
# /etc/fail2ban/jail.d/sshd.local
[sshd]
enabled  = true
port     = 2222
maxretry = 3
findtime = 600       # 10 minutes
bantime  = 3600      # 1 hour first ban; -1 for permanent
backend  = systemd
```

| Jail | maxretry | findtime | bantime | Notes |
|---|---|---|---|---|
| `sshd` | **3** | 600s (10min) | 3600s (1h) | standard SSH bruteforce defense |
| `nginx-http-auth` | **5** | 600s | 3600s | basic-auth bruteforce |
| `nginx-noscript` | **6** | 600s | 86400s (1d) | bots probing for `.php`/`.asp` on Node app |
| `nginx-badbots` | **2** | 600s | 86400s | known scraper UAs |

Always: `bantime.increment = true` + `bantime.factor = 2` so repeat offenders escalate. Whitelist your office IP via `ignoreip = 127.0.0.1/8 ::1 <office-cidr>`.

## logrotate — weekly, 4 rotations

Baseline `/etc/logrotate.d/<app>`:

```
/var/log/myapp/*.log {
    weekly
    rotate 4
    compress
    delaycompress
    missingok
    notifempty
    create 0640 myapp adm
    sharedscripts
    postrotate
        systemctl reload myapp.service > /dev/null 2>&1 || true
    endscript
}
```

| Knob | Default | When to change |
|---|---|---|
| `weekly` / `daily` / `hourly` | **`weekly`** | `daily` for chatty apps; `hourly` only if log volume forces it |
| `rotate` | **4** | 4 weeks = ~1 month retention; increase to 12 for compliance |
| `compress` | **on** | always on |
| `delaycompress` | **on** | compress 2nd-newest, not current — keeps last file uncompressed for tools |
| `copytruncate` | off | use when app holds fd open and can't reopen (legacy); prefer `postrotate` reload |
| `size 100M` | optional | rotate when file hits size, regardless of schedule |

PM2 logs separately: install `pm2-logrotate` module (`pm2 install pm2-logrotate`) — handles `~/.pm2/logs/`.

## Backup retention — 7/4/12 baseline

| Tier | Frequency | Retention | Storage |
|---|---|---|---|
| **Daily** | every day at 02:00 | **7 days** | local `/var/backups/<service>/` |
| **Weekly** | Sun at 02:30 | **4 weeks** | local + offsite (S3/B2/restic) |
| **Monthly** | 1st at 03:00 | **12 months** | offsite only |

Disk cleanup baseline (cron daily at 04:00):
```bash
find /var/backups -type f -name "*.dump" -mtime +7 ! -name "*-monthly-*" ! -name "*-weekly-*" -delete
find /var/backups -type f -name "*-weekly-*" -mtime +28 ! -name "*-monthly-*" -delete
find /var/backups -type f -name "*-monthly-*" -mtime +365 -delete
```

Always:
- Verify restore in staging quarterly (untested backup = no backup)
- Encrypt before offsite (`age` / `gpg` / restic native)
- Monitor backup script exit code — silent failure is the most common backup bug (see `troubleshooting.md` "Backup ran but 0-byte file")

## Citation rule

Other files in this skill MUST NOT redefine these values inline. Use:

> Defaults: see [recommended-defaults.md](recommended-defaults.md).

## Last verified

2026-05-15 against Ubuntu 24.04 LTS, Angie 1.11.3, systemd 255 (Context7 `/systemd/systemd`), nginx 1.28.x mainline docs, PM2 v6 docs, certbot 4.x docs, fail2ban 1.x defaults.
