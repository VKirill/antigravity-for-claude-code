# Troubleshooting — linux-sysadmin

Symptom-indexed. Find what the user sees → diagnose with bash one-liners → identify the cause → apply paste-runnable fix. Required for `risk: high-stakes` skills per skill-evaluation v3.

---

## Disk full → nginx/Angie fails / PM2 OOM / services crash

**Symptoms**
- `df -h` shows root or `/var` at 100%
- nginx/Angie error log: `pwritev() failed (28: No space left on device)`
- PM2 logs: random restarts; `npm install` fails; `psql` can't create temp files
- `journalctl` stops writing new entries

**Diagnose**
```bash
df -h /
du -xsh /var/log/* 2>/dev/null | sort -rh | head -20
du -xsh /var/cache/* /var/lib/* /tmp 2>/dev/null | sort -rh | head -20
du -xsh /home/* 2>/dev/null | sort -rh | head -10
journalctl --disk-usage
docker system df 2>/dev/null
pm2 logs --lines 0       # show log file paths
ls -lhS ~/.pm2/logs/ | head
```

**Common causes**
- ❌ PM2/Angie logs grow unbounded (no logrotate)
- ❌ `journald` keeps everything (no `SystemMaxUse`)
- ❌ Docker dangling images/volumes accumulate
- ❌ APT cache (`/var/cache/apt/archives`) not cleaned
- ❌ Postgres WAL stuck (replica disconnected with replication slot)

**Fix**
```bash
# Journal
journalctl --vacuum-time=7d
# /etc/systemd/journald.conf:
# SystemMaxUse=500M
systemctl restart systemd-journald

# PM2 logs
pm2 flush
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7

# Docker
docker system prune -a --volumes -f

# APT
apt-get clean
apt-get autoremove --purge -y

# Verify
df -h /
```

See `recommended-defaults.md` for the logrotate weekly-×4 baseline.

---

## OOM-killer killed Postgres / Redis / Node

**Symptoms**
- `journalctl -k | grep -i "killed process"` shows recent kills
- Service systemd status: `Main process exited, code=killed, status=9/KILL`
- App users see sudden disconnects; can't reconnect for 30–60s

**Diagnose**
```bash
journalctl -k --since "2 hours ago" | grep -iE "killed process|out of memory|oom"
dmesg | tail -100 | grep -iE "oom|killed"
free -h
swapon --show
ps aux --sort=-%mem | head -10
systemctl status postgresql@18-main redis-server angie
```

**Common causes**
- ❌ No swap, RAM oversubscribed
- ❌ Postgres `shared_buffers` + Redis `maxmemory` + app RSS > total RAM
- ❌ Memory leak in Node app (no `max_memory_restart` set)
- ❌ Heavy `pg_dump` / `BGSAVE` fork doubled memory under pressure

**Fix**
```bash
# Add swap (4 GB example)
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Cap Node via PM2
# in ecosystem.config.js:
# max_memory_restart: '1G',

# Tune kernel
echo 'vm.swappiness = 10' >> /etc/sysctl.d/99-tuning.conf
echo 'vm.overcommit_memory = 1' >> /etc/sysctl.d/99-tuning.conf
sysctl -p /etc/sysctl.d/99-tuning.conf
```

Re-balance: PG `shared_buffers` ≤ 25% RAM, Redis `maxmemory` ≤ 40% RAM, leave 20% headroom. See `recommended-defaults.md` "PostgreSQL + Redis on the same host".

---

## nginx/Angie 502 Bad Gateway (upstream exited)

**Symptoms**
- Browser: `502 Bad Gateway`
- Angie error log: `connect() failed (111: Connection refused) while connecting to upstream`
- Or: `recv() failed (104: Connection reset by peer)`

**Diagnose**
```bash
tail -50 /var/log/angie/error.log
pm2 status                                      # is the Node app running?
ss -tlnp | grep -E "9090|3000|8080"             # is upstream port listening?
systemctl status php8.5-fpm                     # if PHP upstream
curl -i http://127.0.0.1:9090/healthz           # bypass Angie
docker ps --filter status=exited | head         # crashed container?
```

**Common causes**
- ❌ Upstream process exited (PM2 stopped, container crashed)
- ❌ Upstream listening on wrong host (e.g., `0.0.0.0` vs `127.0.0.1` mismatch in `proxy_pass`)
- ❌ Upstream still booting (slow start, Angie connects before ready)
- ❌ `proxy_pass` to a hostname that doesn't resolve at boot (DNS race)
- ❌ Connection limit reached on upstream

**Fix**
```bash
# Restart upstream
pm2 restart my-app
# or
docker compose up -d --force-recreate my-service

# Verify
curl -i http://127.0.0.1:9090/healthz
systemctl reload angie

# If config bug (wrong upstream block) — test first
angie -t
systemctl reload angie
```

---

## nginx/Angie 504 Gateway Timeout

**Symptoms**
- Browser: `504 Gateway Timeout` after ~60s
- Error log: `upstream timed out (110: Connection timed out) while reading response header`
- Curl: `curl: (28) Operation timed out`

**Common causes**
- ❌ Upstream genuinely slow (DB query, external API)
- ❌ `proxy_read_timeout` too short for long endpoints (reports, SSE, file uploads)
- ❌ Database locked / Redis blocked / external service down

**Fix**
```nginx
location /reports/ {
    proxy_pass http://backend;
    proxy_read_timeout    300s;        # long-running endpoint
    proxy_connect_timeout 10s;
    proxy_send_timeout    300s;
}

location /sse/ {
    proxy_pass http://backend;
    proxy_http_version    1.1;
    proxy_set_header      Connection "";
    proxy_buffering       off;          # required for SSE/long-poll
    proxy_read_timeout    3600s;        # 1 hour
}
```

```bash
angie -t && systemctl reload angie
```

Root-cause the slow upstream separately — see `postgresql` skill for `pg_stat_activity` long-query diagnosis.

---

## SSL cert expired / OCSP stapling broken

**Symptoms**
- Browser: `NET::ERR_CERT_DATE_INVALID` or `OCSP_RESPONSE_HAS_NO_SIGNER`
- `curl https://example.com` → `SSL certificate problem: certificate has expired`
- Monitoring alerts on cert expiry

**Diagnose**
```bash
# Check cert expiry
echo | openssl s_client -servername example.com -connect example.com:443 2>/dev/null | openssl x509 -noout -dates -subject -issuer

# Check OCSP stapling status
echo | openssl s_client -servername example.com -connect example.com:443 -status 2>&1 | grep -A 10 "OCSP response"

# Certbot view
certbot certificates
systemctl list-timers certbot.timer
systemctl status certbot.timer
journalctl -u certbot.timer --since "7 days ago"
```

**Common causes**
- ❌ Renewal hook didn't reload Angie (cert is new but Angie still serves old)
- ❌ Certbot blocked: ACME challenge port 80 closed in UFW or new vhost
- ❌ Rate-limited by Let's Encrypt (too many failed renewals)
- ❌ Wrong domain in cert (added a subdomain without re-running certbot)

**Fix**
```bash
# Force renew (only if real expiry imminent)
certbot renew --force-renewal --deploy-hook 'systemctl reload angie'

# Or manual
certbot certonly --webroot -w /var/www/html -d example.com -d www.example.com
systemctl reload angie

# Verify
echo | openssl s_client -servername example.com -connect example.com:443 2>/dev/null | openssl x509 -noout -dates
```

For Angie built-in ACME — `acme_client` block handles renewal automatically; check `angie -T | grep acme` for config presence.

---

## UFW blocks legitimate traffic after rule edit

**Symptoms**
- Site/SSH suddenly unreachable after `ufw` change
- `ufw status` looks correct but connections refused
- Other users still connect (firewall is client-specific OR rule order issue)

**Diagnose**
```bash
ufw status numbered
ufw status verbose
tail -200 /var/log/ufw.log | grep -i block
# Check effective iptables
iptables -L -n -v | head -40
ss -tln                                    # is service even listening?
```

**Common causes**
- ❌ Rule order — UFW evaluates top-down; deny rule shadows allow
- ❌ Deleted "allow 2222" before adding new SSH rule → locked yourself out
- ❌ IPv6 not configured; rules only apply to IPv4
- ❌ `ufw default deny incoming` activated without matching allow

**Fix**
```bash
# DON'T run ufw reset over SSH unless you have console access

# Add the rule back (move-to-front via delete + add)
ufw insert 1 allow 2222/tcp
ufw insert 2 allow 80/tcp
ufw insert 3 allow 443/tcp

# Verify before logout
ufw status numbered
ss -tln | grep -E ":80|:443|:2222"

# Always: open a second SSH session BEFORE editing UFW
# So if rule kills the session, second one stays
```

---

## systemd service won't start (exit code, journalctl trace)

**Symptoms**
- `systemctl start svc` → `Job for svc.service failed`
- `systemctl status svc` shows `Active: failed (Result: exit-code)` with code 1/127/203
- `systemctl enable svc` succeeds but service never runs

**Diagnose**
```bash
systemctl status myservice -l
journalctl -u myservice -n 100 --no-pager
journalctl -u myservice --since "10 minutes ago"

# Show unit file effective config
systemctl cat myservice
systemd-analyze verify /etc/systemd/system/myservice.service

# Test the ExecStart command manually as the service user
sudo -u myuser bash -c 'cd /opt/myapp && node dist/index.js'
```

**Common causes**
- ❌ `ExecStart` path doesn't exist or wrong user permissions (`code=exited, status=203/EXEC`)
- ❌ Missing `EnvironmentFile=` → app fails on undefined env
- ❌ `WorkingDirectory=` not readable by `User=`
- ❌ Port already in use by another process
- ❌ Reached `StartLimitBurst` — `systemctl reset-failed myservice` then start

**Fix**
```bash
# Show the failure
journalctl -u myservice -n 50

# Fix unit file, then:
systemctl daemon-reload                # required after editing unit file
systemctl reset-failed myservice       # clear start-limit counters
systemctl start myservice
systemctl status myservice

# If config valid but app dies on start:
sudo -u myuser /bin/bash -c '<paste ExecStart line>'
# Read the actual error
```

---

## Cron job silently fails (no env, no PATH)

**Symptoms**
- Job listed in `crontab -l` but no output / no side effects
- Manual run works; cron run doesn't
- No errors in `/var/log/syslog`

**Diagnose**
```bash
grep CRON /var/log/syslog | tail -20
crontab -l
# Cron runs with minimal PATH; check what your script assumes
env -i /bin/bash -c 'echo $PATH; which node; which psql'   # cron-like env
```

**Common causes**
- ❌ Cron's PATH is `/usr/bin:/bin` — no `node`, no `pg_dump`, no `/usr/local/bin`
- ❌ Script uses relative paths, no `cd` first
- ❌ Output not captured → silent failure
- ❌ User mismatch — script reads files owned by another user
- ❌ `~/.bashrc` env vars not loaded (cron doesn't source it)

**Fix**
```cron
# /etc/cron.d/myjob — system cron with explicit env
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
MAILTO=ops@example.com

0 2 * * *  myuser  /opt/myapp/scripts/backup.sh >> /var/log/myapp-backup.log 2>&1
```

Or via systemd timer (preferred):
```ini
# /etc/systemd/system/backup.service
[Service]
Type=oneshot
User=myuser
EnvironmentFile=/etc/default/backup
ExecStart=/opt/myapp/scripts/backup.sh
```
```ini
# /etc/systemd/system/backup.timer
[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true
[Install]
WantedBy=timers.target
```

```bash
systemctl daemon-reload && systemctl enable --now backup.timer
systemctl list-timers backup.timer
journalctl -u backup.service -n 50
```

---

## Backup script ran but produced 0-byte file

**Symptoms**
- Backup file exists with current timestamp but size is 0 or suspiciously small
- Restore from this backup fails
- `journalctl -u backup` shows exit code 0 (script "succeeded")

**Common causes**
- ❌ `pg_dump | gzip > file.gz` — if `pg_dump` fails, `gzip` writes empty output and the shell sees exit 0 (last command in pipeline)
- ❌ Permissions issue — script ran as wrong user
- ❌ Lock not acquired — silent skip
- ❌ Disk full mid-write
- ❌ Network timeout to remote backup target

**Fix**
```bash
#!/usr/bin/env bash
set -euo pipefail            # fail on any error
# Critical: catch failures in pipelines
set -o pipefail

DEST=/var/backups/postgresql/db_$(date +%Y%m%d_%H%M).dump
pg_dump -U postgres -Fc mydb > "$DEST"

# Verify size > 1 MB
SIZE=$(stat -c %s "$DEST")
if [ "$SIZE" -lt 1048576 ]; then
  echo "ERROR: backup too small ($SIZE bytes)" >&2
  rm -f "$DEST"
  exit 1
fi

# Verify backup is parseable
pg_restore -l "$DEST" > /dev/null || { echo "ERROR: backup unreadable" >&2; exit 1; }

echo "Backup OK: $DEST ($SIZE bytes)"
```

Always: monitor `journalctl -u backup.service` exit code (`OnFailure=` sends alert).

---

## High load average — what's the cause

**Symptoms**
- `uptime` load avg > number of CPU cores
- Site sluggish, intermittent timeouts
- Top consumers not obvious

**Diagnose (top to bottom: CPU → IO → memory → network)**
```bash
# Load + per-CPU
uptime
nproc
top -bn1 | head -30                       # CPU + memory snapshot
htop                                       # interactive

# Per-process CPU
ps -eo pid,user,pcpu,pmem,comm --sort=-pcpu | head -15

# IO wait (load high but CPU low → IO bound)
vmstat 1 5                                 # 'wa' column = IO wait %
iostat -xz 1 5                             # per-device IO stats

# Top IO processes
iotop -aoP -d 5                            # apt install iotop

# Memory pressure / swap
free -h
vmstat 1 3 | head                          # si/so columns = swap in/out

# Network
ss -s
nethogs                                    # per-process bandwidth (apt install nethogs)

# Per-process syscalls / hung in kernel
ps -eo pid,stat,wchan,comm | grep -vE "^\s*PID|R |S " | head
```

**Common patterns**
- CPU = 100%, `wa` low → CPU-bound (find process via `top`)
- CPU low, `wa` > 30% → IO-bound (find disk via `iotop`)
- High `si`/`so` in vmstat → swap thrashing (add RAM or cap services)
- Load high, all metrics low → kernel lock contention (check `dmesg`)

---

## Open file descriptor exhaustion

**Symptoms**
- App logs: `EMFILE: too many open files` / `Too many open files`
- nginx/Angie error log: `accept() failed (24: Too many open files)`
- New connections rejected

**Diagnose**
```bash
# Check global
sysctl fs.file-nr             # current / peak / max
sysctl fs.file-max

# Per-process limit
cat /proc/$(pgrep -n nginx)/limits | grep "Max open files"

# Who's using fds
lsof -nP 2>/dev/null | awk '{print $1}' | sort | uniq -c | sort -rn | head
ls /proc/$(pgrep -n node)/fd | wc -l
```

**Fix**
```bash
# Raise system limit
echo 'fs.file-max = 2097152' >> /etc/sysctl.d/99-fdlimit.conf
sysctl -p /etc/sysctl.d/99-fdlimit.conf

# Per-user limits — /etc/security/limits.d/99-app.conf
# ubuntu soft nofile 65535
# ubuntu hard nofile 65535

# Systemd service — drop-in
mkdir -p /etc/systemd/system/myservice.service.d
cat > /etc/systemd/system/myservice.service.d/limits.conf <<'EOF'
[Service]
LimitNOFILE=65535
EOF
systemctl daemon-reload
systemctl restart myservice

# Verify
cat /proc/$(pgrep myservice)/limits | grep "Max open files"
```

---

## Conntrack table full (NAT overflow)

**Symptoms**
- `dmesg`: `nf_conntrack: table full, dropping packet`
- Random connection drops on Docker host or NAT box
- `iptables -L` slow

**Diagnose**
```bash
cat /proc/sys/net/netfilter/nf_conntrack_count
cat /proc/sys/net/netfilter/nf_conntrack_max
conntrack -L | wc -l                       # apt install conntrack
dmesg | grep -i conntrack
```

**Fix**
```bash
echo 'net.netfilter.nf_conntrack_max = 1048576' >> /etc/sysctl.d/99-conntrack.conf
echo 'net.netfilter.nf_conntrack_buckets = 262144' >> /etc/sysctl.d/99-conntrack.conf
echo 'net.netfilter.nf_conntrack_tcp_timeout_established = 86400' >> /etc/sysctl.d/99-conntrack.conf
sysctl -p /etc/sysctl.d/99-conntrack.conf
```

---

## DNS resolver down (systemd-resolved misconfig)

**Symptoms**
- `curl example.com` → `Could not resolve host`
- `ping 1.1.1.1` works but `ping example.com` doesn't
- Apps can't reach external APIs

**Diagnose**
```bash
systemctl status systemd-resolved
resolvectl status
cat /etc/resolv.conf                       # should symlink to /run/systemd/resolve/stub-resolv.conf
nslookup example.com 1.1.1.1               # direct
ss -ulnp | grep :53                        # systemd-resolved listening?
```

**Fix**
```bash
# Reset to stub resolver
ln -sf /run/systemd/resolve/stub-resolv.conf /etc/resolv.conf
systemctl restart systemd-resolved
resolvectl status

# If still broken — set explicit upstream
resolvectl dns eth0 1.1.1.1 8.8.8.8
# Persist in /etc/systemd/resolved.conf:
# DNS=1.1.1.1 8.8.8.8
# FallbackDNS=9.9.9.9
systemctl restart systemd-resolved
```

---

## More symptoms?

Capture: `uname -a`, `uptime`, `free -h`, `df -h`, `journalctl -p err -n 100`, relevant service `systemctl status -l`. File an issue with that data; we extend this file when patterns repeat.
