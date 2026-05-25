# Service Management Reference

Detailed configuration and administration for all services on our stack.

## systemd

### Unit file template
```ini
[Unit]
Description=My Service
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=appuser
Group=appgroup
WorkingDirectory=/opt/myapp
ExecStart=/usr/bin/node /opt/myapp/server.js
Restart=on-failure
RestartSec=5
StartLimitBurst=5
StartLimitIntervalSec=60
StandardOutput=journal
StandardError=journal
SyslogIdentifier=myapp
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/opt/myapp/data
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
```

### Key commands
```bash
systemctl start|stop|restart|reload SERVICE
systemctl enable|disable SERVICE
systemctl status SERVICE
journalctl -u SERVICE -n 100 --no-pager
journalctl -u SERVICE --since "1 hour ago"
systemctl list-units --failed
systemctl list-timers --all
```

Unit file locations (priority order):
1. `/etc/systemd/system/` — custom
2. `/run/systemd/system/` — runtime
3. `/lib/systemd/system/` — package-installed

## PM2 (Node.js 24 Process Manager)

### Commands
```bash
pm2 status                    # List all
pm2 logs APP --lines 100     # View logs
pm2 restart APP               # Restart (brief downtime)
pm2 reload APP                # Zero-downtime (cluster mode)
pm2 stop APP                  # Stop
pm2 delete APP                # Remove from list
pm2 save                      # Persist list for reboot
pm2 startup                   # Generate boot script
pm2 monit                     # Real-time dashboard
```

### Ecosystem config
```javascript
module.exports = {
  apps: [{
    name: 'myapp',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    max_memory_restart: '500M',
    error_file: './logs/error.log',
    out_file: './logs/out.log'
  }]
}
```

### Node.js 24 notes
- `node --experimental-strip-types app.ts` — built-in TS strip, без ts-node/tsx
- `npm ci --omit=dev` вместо deprecated `--only=production`
- Built-in `node --test` test runner стабилен; для PM2 — без изменений

### Monitoring
```bash
pm2 jlist  # JSON output for parsing
# Parse: name, status, restart_time, monit.cpu, monit.memory
```

Important: `pm2 save` after any change. `pm2 reload` for cluster mode only.

## PostgreSQL 18

PostgreSQL 18 is the current major (released 2026). Highlights: async I/O subsystem,
skip-scan B-tree lookups, `uuidv7()`, virtual generated columns by default, OAuth auth,
`OLD`/`NEW` in `RETURNING`, temporal `PRIMARY KEY` / `UNIQUE` / `FOREIGN KEY` constraints,
and planner statistics preserved across `pg_upgrade`.

### Install on Ubuntu 24.04 (PGDG APT)

```bash
sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh   # adds PGDG repo
sudo apt update
sudo apt install -y postgresql-18 postgresql-client-18 postgresql-contrib-18
systemctl status postgresql@18-main
```

The PGDG script auto-detects the Ubuntu release and imports the signing key. The Ubuntu
24.04 default repo carries an older major — always use PGDG for 18.

### Status & Connections
```bash
pg_isready                    # Quick health check
sudo -u postgres psql -c "SELECT version();"
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"
```

### Database sizes
```sql
SELECT datname, pg_size_pretty(pg_database_size(datname))
FROM pg_database WHERE datistemplate = false
ORDER BY pg_database_size(datname) DESC;
```

### Active queries
```sql
SELECT pid, now() - query_start AS duration, query, state
FROM pg_stat_activity WHERE state != 'idle'
ORDER BY duration DESC;
```

### Kill long query
```sql
SELECT pg_terminate_backend(PID);
```

### Maintenance
```bash
sudo -u postgres psql -c "VACUUM ANALYZE;"
```

### Backup / Restore
```bash
# Custom format (recommended — supports parallel restore, selective restore)
pg_dump -U postgres -Fc DATABASE > backup.dump
pg_restore -U postgres -d DATABASE -j 4 --clean --if-exists backup.dump

# Directory format (parallel dump and restore)
pg_dump -U postgres -Fd -j 4 -f /var/backups/postgresql/DATABASE.d DATABASE

# Plain SQL (portable across majors)
pg_dumpall -U postgres > all.sql
```

### pg_upgrade (17 → 18)
```bash
# PG18 preserves planner statistics — no immediate full ANALYZE storm
sudo -u postgres pg_upgrade \
  --old-bindir=/usr/lib/postgresql/17/bin \
  --new-bindir=/usr/lib/postgresql/18/bin \
  --old-datadir=/var/lib/postgresql/17/main \
  --new-datadir=/var/lib/postgresql/18/main \
  --link --jobs=4
```

### Config files
- `/etc/postgresql/18/main/postgresql.conf` — server settings
- `/etc/postgresql/18/main/pg_hba.conf` — authentication rules

### Tuning (example for 8GB RAM server — adjust to your hardware)
```
# Rule of thumb: shared_buffers = 25% RAM, effective_cache_size = 75% RAM
shared_buffers = 2GB                # 25% of 8GB
effective_cache_size = 6GB          # 75% of 8GB
work_mem = 64MB                     # RAM / max_connections / 2
maintenance_work_mem = 512MB        # For vacuum, index creation
wal_buffers = 64MB
max_connections = 100
random_page_cost = 1.1              # SSD (use 4.0 for HDD)
effective_io_concurrency = 200      # SSD (use 2 for HDD)

# PG18: async I/O subsystem
io_method = 'worker'                # 'worker' | 'io_uring' (Linux 5.1+) | 'sync'
io_workers = 3                      # background I/O workers when io_method=worker
```

### PG18 new observability views
- `pg_stat_io` — per-backend-type I/O statistics
- `pg_stat_checkpointer` — split out of `pg_stat_bgwriter`
- `pg_stat_subscription_stats` — logical replication observability

## Redis 8

Redis 8 (OSS) merges previously-separate modules — RedisJSON, RediSearch,
RedisTimeSeries, RedisBloom — into the core, and introduces Vector Sets as a
first-class data type for AI / similarity-search workloads. ACL category names
changed; verify after upgrade.

### Status
```bash
redis-cli ping
redis-cli info server
redis-cli info memory
redis-cli info clients
redis-cli module list           # search, json, timeseries, bloom — все built-in
```

### Memory analysis
```bash
redis-cli info memory | grep used_memory_human
redis-cli memory doctor
redis-cli --bigkeys
redis-cli --memkeys
redis-cli dbsize
```

### Vector Sets (new in Redis 8)
```bash
redis-cli vset.add my_index vec_a 0.10 0.25 0.78
redis-cli vset.sim my_index vec_a count 10
redis-cli vset.info my_index
```

### JSON / Search (built-in, no module load)
```bash
redis-cli json.set user:1 $ '{"name":"Alice","age":30}'
redis-cli json.get user:1 $.name
redis-cli ft.create idx ON JSON PREFIX 1 user: SCHEMA $.name AS name TEXT
```

### Persistence
```bash
redis-cli lastsave           # Last RDB save
redis-cli bgsave             # Manual save
redis-cli config get save
redis-cli config get appendonly
```

### Keyspace notifications
```bash
redis-cli config set notify-keyspace-events KEA
# Redis 8.2 adds OVERWRITTEN and TYPE_CHANGED event types
```

### ACL migration note (Redis 7 → 8)
A user with `+@all -@write` no longer auto-grants `JSON.SET`, `FT.CREATE`, etc.
Explicitly grant per-module categories:
```bash
redis-cli acl setuser app on >pass +@all -@write +@json +@search +@bloom +@timeseries
```

### Tuning (`/etc/redis/redis.conf`)
```
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
appendonly yes
appendfsync everysec
```

## Docker Engine 29

Docker Engine 29 raises the minimum API version to 1.44 (Moby v25). Older clients
(< v25, e.g. Docker CLI 1.43) get `client version 1.43 is too old`. The containerd
image store is the default for **new** installs (existing setups are not migrated
automatically). Go import path moved from `github.com/docker/docker` to
`github.com/moby/moby`.

### Status
```bash
docker version                        # check Engine + API version
docker info | grep -E "Server Version|Storage Driver"
docker ps -a                          # All containers
docker stats --no-stream              # Resources
docker logs --tail 100 -t CONTAINER   # Logs
docker system df                      # Disk usage
```

### Compose v2 (always `docker compose`, not `docker-compose`)
```bash
docker compose up -d                  # Start
docker compose down                   # Stop
docker compose pull                   # Update images
docker compose logs --tail 50 SVC     # Service logs
docker compose config                 # Validate + print resolved config
docker compose ps --format json       # Machine-readable status
```

`docker-compose` (Python v1) was removed long ago; only the v2 plugin is supported.
Use `docker compose` (space, not hyphen) in all scripts.

### Cleanup
```bash
docker container prune -f             # Stopped containers
docker image prune -f                 # Dangling images
docker network prune -f               # Unused networks
docker buildx prune -f                # Build cache
# NEVER auto-delete volumes — ask user first
docker volume ls -f dangling=true     # Show dangling volumes
```

### Engine 29 gotchas
- Tooling that parses `docker version --format json` may break: top-level keys
  changed in the JSON output. Update parsers or pin to a version field explicitly.
- Old Portainer / Ansible `docker_compose_v2` versions may fail with
  `KeyError: 'ApiVersion'` — update those clients.
- If you must keep the old overlay2 graph driver on a fresh install, set
  `"features": { "containerd-snapshotter": false }` in `/etc/docker/daemon.json`
  before starting the daemon.

## PHP 8.5 (with PHP-FPM)

PHP 8.5 is the current Active branch (security through end of 2029). Ships
Zend Engine 4.5, larger default JIT buffer (64 MB), the new `uri` extension,
the `lexbor` HTML parser, pipe operator and improved error reporting.

### Install on Ubuntu 24.04 (Ondrej PPA)
```bash
sudo apt install -y software-properties-common
sudo add-apt-repository -y ppa:ondrej/php
sudo apt update
sudo apt install -y php8.5-fpm php8.5-cli \
    php8.5-pgsql php8.5-redis php8.5-mbstring php8.5-xml \
    php8.5-curl php8.5-zip php8.5-intl php8.5-bcmath php8.5-gd \
    php8.5-opcache
sudo systemctl enable --now php8.5-fpm
```

### Paths
- FPM config:  `/etc/php/8.5/fpm/php.ini`
- CLI config:  `/etc/php/8.5/cli/php.ini`
- Pool config: `/etc/php/8.5/fpm/pool.d/www.conf`
- Socket:      `/run/php/php8.5-fpm.sock`
- Logs:        `/var/log/php8.5-fpm.log`

### Angie + PHP-FPM (FastCGI)
```nginx
server {
    listen 443 ssl;
    server_name app.example.com;
    root /var/www/app/public;
    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.5-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_index index.php;
        fastcgi_read_timeout 60;
    }
}
```

### Pool tuning (`/etc/php/8.5/fpm/pool.d/www.conf`)
```
pm = dynamic
pm.max_children = 20
pm.start_servers = 4
pm.min_spare_servers = 2
pm.max_spare_servers = 6
pm.max_requests = 500
request_terminate_timeout = 60s
```

### OPcache + JIT (`php.ini`)
```
opcache.enable = 1
opcache.memory_consumption = 256
opcache.interned_strings_buffer = 16
opcache.max_accelerated_files = 20000
opcache.validate_timestamps = 0          ; production: disable mtime checks
opcache.jit_buffer_size = 64M            ; PHP 8.5 default
opcache.jit = tracing
```

### Operations
```bash
systemctl status php8.5-fpm
systemctl reload php8.5-fpm              # graceful — preserves child workers
php-fpm8.5 -t                            # config test
php -v                                    # CLI version
php -i | grep -E "opcache|jit"
```

## Postfix (Transactional Email Relay)

On a production server, Postfix is typically configured in **relay mode** — it
accepts outgoing mail from local apps and forwards to an external SMTP relay
(Mailgun, AWS SES, SendGrid). Never run a full inbound MX on your app server.

### Install

```bash
apt install -y postfix mailutils   # mailutils provides 'mail' command for testing
# During setup: select "Internet with smarthost" or configure manually
```

### Relay-only configuration

`/etc/postfix/main.cf`:
```
myhostname = server.example.com
mydomain = example.com
myorigin = $mydomain
inet_interfaces = loopback-only      # only accept local submissions
inet_protocols = ipv4
relayhost = [smtp.mailgun.org]:587   # your SMTP relay
smtp_sasl_auth_enable = yes
smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd
smtp_sasl_security_options = noanonymous
smtp_tls_security_level = encrypt
smtp_tls_note_starttls_offer = yes
smtp_use_tls = yes
```

`/etc/postfix/sasl_passwd`:
```
[smtp.mailgun.org]:587  postmaster@mg.example.com:YOUR_SMTP_PASSWORD
```

```bash
postmap /etc/postfix/sasl_passwd        # compile to hash
chmod 600 /etc/postfix/sasl_passwd /etc/postfix/sasl_passwd.db
systemctl restart postfix

# Test
echo "Test body" | mail -s "Test subject" admin@example.com
tail -50 /var/log/mail.log
```

### Sendmail-compatible command

Most apps use sendmail-compatible interface. Postfix provides `/usr/sbin/sendmail`
as an alias. In app configs, set `sendmail_path = /usr/sbin/sendmail -t -i`.

### Operations

```bash
systemctl status postfix
postfix check                           # config check
postqueue -p                            # view mail queue
postqueue -f                            # flush queue (retry all deferred)
postsuper -d ALL deferred               # delete all deferred mail
postconf inet_interfaces                # check a config value
tail -f /var/log/mail.log               # watch mail flow
```

---

## Cron

Traditional cron (crond) for scheduled tasks. For new services, prefer systemd
timers (see `systemd.md`). Cron is fine for simple one-off scripts.

### User crontabs

```bash
crontab -e           # edit current user's crontab
crontab -l           # list current
crontab -u ubuntu -l # list for another user (root only)
```

Crontab format: `minute hour day month weekday command`
```
# m  h  dom  mon  dow  command
  0  2  *    *    *    /usr/local/bin/backup-db.sh >> /var/log/backup.log 2>&1
  */15 * * * *         /usr/local/bin/healthcheck.sh
  0  0  *    *    0    /usr/local/bin/weekly-cleanup.sh
```

### System crontabs

```bash
# /etc/cron.d/ — package-installed cron jobs
ls /etc/cron.d/

# System crontab /etc/crontab (also has user field):
# m  h  dom  mon  dow  user  command
  0  2  *    *    *    root  /usr/local/bin/backup.sh
```

```bash
# Directory-based (drop scripts in):
/etc/cron.daily/        # run once per day
/etc/cron.weekly/       # run once per week
/etc/cron.monthly/      # run once per month
```

### Cron logs

```bash
grep CRON /var/log/syslog | tail -30
journalctl -u cron -n 50 --no-pager
```

### Common gotchas

- Cron runs in a minimal environment — always use absolute paths in scripts
- Add `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin` at the top of crontab
- Redirect stdout and stderr: `>> /var/log/myjob.log 2>&1`
- Test script manually before adding to cron: `sudo -u ubuntu /usr/local/bin/myscript.sh`

---

## Backup Verification

```bash
# PostgreSQL dump integrity
pg_restore -l backup.dump > /dev/null 2>&1 && echo "OK" || echo "CORRUPT"

# Gzip integrity
gzip -t backup.sql.gz 2>&1 && echo "OK" || echo "CORRUPT"

# Tar integrity
tar tzf backup.tar.gz > /dev/null 2>&1 && echo "OK" || echo "CORRUPT"

# Zero-size check (failed backups)
find /var/backups -type f -size 0 \( -name "*.gz" -o -name "*.dump" \)
```
