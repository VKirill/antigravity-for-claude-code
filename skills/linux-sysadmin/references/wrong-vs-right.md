# Wrong vs Right — linux-sysadmin

Preventive code pairs for `risk: high-stakes` server operations. Each block: ❌ wrong / ✅ right / **Why it matters**.

---

## 1. File permissions — `chmod 777` vs proper grant

**❌ Wrong — blast-radius fix for permission denied:**
```bash
chmod -R 777 /var/www/myapp        # "now it works"
```

**✅ Right — narrow grant matching owner + service:**
```bash
chown -R myapp:www-data /var/www/myapp
find /var/www/myapp -type d -exec chmod 0750 {} \;
find /var/www/myapp -type f -exec chmod 0640 {} \;
# writable directories (uploads, cache) — opt-in only:
chmod 0770 /var/www/myapp/storage/uploads /var/www/myapp/storage/cache
```

**Why it matters:** `777` makes every file world-writable — any process on the box (including a compromised one) can modify your code. Setting `chmod -R 777` on a docroot has caused more breaches than any single bug. Always: owner = user, group = service group (`www-data`, `nginx`), world = nothing.

---

## 2. Service reload — `restart` vs `reload`

**❌ Wrong — restart for config change:**
```bash
vim /etc/angie/sites-enabled/app.conf
systemctl restart angie            # drops every in-flight connection
```

**✅ Right — test, then reload:**
```bash
cp /etc/angie/sites-enabled/app.conf{,.bak.$(date +%s)}
vim /etc/angie/sites-enabled/app.conf
angie -t                           # MANDATORY before reload
systemctl reload angie             # graceful — old workers finish current requests
curl -I https://app.example.com/healthz
```

**Why it matters:** `restart` kills the master and all workers — in-flight requests are aborted. `reload` sends SIGHUP, master re-reads config and starts new workers; old workers drain. Always `-t` first — invalid config + reload still serves old config; invalid config + restart leaves the service stopped.

---

## 3. UFW rule editing over SSH

**❌ Wrong — single session, default deny applied:**
```bash
ssh user@host
sudo ufw default deny incoming
# session frozen — locked out
```

**✅ Right — second session as safety net + explicit allow first:**
```bash
# Terminal A (already open)
ssh user@host
# Terminal B — keep open as fallback
ssh user@host

# In Terminal A:
sudo ufw allow 2222/tcp comment 'SSH'
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw --force enable
# Verify Terminal B still works BEFORE closing
sudo ufw status numbered
```

**Why it matters:** UFW evaluates rules including `default deny` immediately. If you don't have `allow 2222` first, your SSH session survives (existing connection) but no new SSH connections work — including the one you'd need to fix it. Always allow the SSH port before default-deny.

---

## 4. Cron with implicit PATH

**❌ Wrong — relies on user shell env:**
```cron
0 2 * * * /opt/myapp/backup.sh
```
```bash
# backup.sh
pg_dump mydb | gzip > /var/backups/db_$(date +%F).sql.gz
```

**✅ Right — explicit PATH, strict shell, pipefail:**
```cron
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
MAILTO=ops@example.com
0 2 * * * myuser /opt/myapp/backup.sh >> /var/log/myapp-backup.log 2>&1
```
```bash
#!/usr/bin/env bash
set -euo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
pg_dump -U postgres -Fc mydb > "/var/backups/db_$(date +%F).dump"
```

**Why it matters:** cron runs with PATH=`/usr/bin:/bin`. `node`, `psql`, `aws`, anything in `/usr/local/bin` is missing. `pg_dump | gzip > file` succeeds even when `pg_dump` fails because the pipeline's last exit is gzip's (zero). `set -o pipefail` propagates the failure. Always redirect stdout AND stderr (`>> log 2>&1`) — otherwise silent failures.

Better: replace cron with systemd timer + `OnFailure=alert.service`.

---

## 5. SSL cert renewal — hook missing

**❌ Wrong — renewed cert but Angie still serves old:**
```bash
certbot renew                      # cert files updated on disk
# Angie still has old cert in memory until reload
```

**✅ Right — deploy hook reloads Angie automatically:**
```bash
# /etc/letsencrypt/renewal-hooks/deploy/reload-angie.sh
#!/bin/bash
systemctl reload angie
```
```bash
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-angie.sh
certbot renew --dry-run            # verify hook fires
```

Or migrate to Angie built-in ACME — no hook needed:
```nginx
acme_client letsencrypt https://acme-v02.api.letsencrypt.org/directory;
server {
    listen 443 ssl;
    acme letsencrypt;
    ssl_certificate     $acme_cert_letsencrypt;
    ssl_certificate_key $acme_cert_letsencrypt_key;
}
```

**Why it matters:** Certbot's systemd timer renews silently. If your reload hook is missing, the cert is renewed on disk but the running Angie process keeps the expired cert in memory until you restart it manually (months later, after browser errors). Always: hook exists, `certbot renew --dry-run` shows it firing, monitor cert expiry independently.

---

## 6. systemd service editing — `vi /etc/systemd/...` without `daemon-reload`

**❌ Wrong — edit unit file, restart, nothing changed:**
```bash
vim /etc/systemd/system/myapp.service     # changed ExecStart
systemctl restart myapp                    # still runs old command
```

**✅ Right — daemon-reload before restart:**
```bash
cp /etc/systemd/system/myapp.service{,.bak.$(date +%s)}
vim /etc/systemd/system/myapp.service
systemd-analyze verify /etc/systemd/system/myapp.service
systemctl daemon-reload                    # required after unit file edit
systemctl restart myapp
systemctl status myapp -l
```

**Why it matters:** systemd caches parsed unit files. `daemon-reload` re-reads them. Without it, `restart` re-applies the OLD config from cache — silent and confusing. The bug surfaces only after the next system reboot when systemd reads the file fresh and "suddenly" the change appears. Always: edit → `verify` → `daemon-reload` → `restart` → `status`.

---

## 7. Disk cleanup — `rm -rf` vs targeted cleanup

**❌ Wrong — broad cleanup of `/var`:**
```bash
df -h    # /var at 95%
rm -rf /var/log/*                  # delete ALL logs, breaks auth.log, journalctl, etc.
```

**✅ Right — targeted vacuum + rotation:**
```bash
# Identify
du -xsh /var/log/* | sort -rh | head -10
journalctl --disk-usage

# Vacuum journal (keeps last 7 days)
journalctl --vacuum-time=7d
# Or by size
journalctl --vacuum-size=500M

# Rotate / truncate (do NOT delete active log files — apps hold fd open)
truncate -s 0 /var/log/myapp/*.log     # zero-out, preserves inode
# Better: install logrotate config (see recommended-defaults.md)

# Docker
docker system prune -a --volumes -f

# APT
apt-get clean
apt-get autoremove --purge -y
```

**Why it matters:** `rm /var/log/*.log` while a service holds the file open: file is unlinked but disk space is NOT reclaimed until the service closes the fd. The app keeps writing to a deleted inode. `truncate -s 0` keeps the inode, frees space, and the app's writes continue cleanly. For long-term: logrotate `copytruncate` or `postrotate` reload — see `recommended-defaults.md`.

---

## When to add a new pair

Add when:
- A junior or LLM is likely to write the ❌ version (it appears to work)
- The wrong version causes downtime, data loss, or security exposure
- The fix is non-obvious from man pages

Keep each side under 15 lines. If you need more, the example is doing too much — split.
