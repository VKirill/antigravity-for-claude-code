# systemd Reference (Ubuntu 24.04)

## Unit File Templates

### Service (long-running daemon)

```ini
# /etc/systemd/system/myapp.service
[Unit]
Description=My Application
Documentation=https://docs.example.com
After=network-online.target postgresql.service redis-server.service
Wants=network-online.target
Requires=postgresql.service

[Service]
Type=simple
User=appuser
Group=appuser
WorkingDirectory=/opt/myapp
EnvironmentFile=-/opt/myapp/.env    # '-' = don't fail if missing
ExecStartPre=/opt/myapp/scripts/pre-start.sh
ExecStart=/usr/bin/node /opt/myapp/dist/index.js
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure
RestartSec=5s
StartLimitBurst=5
StartLimitIntervalSec=60s
TimeoutStartSec=30s
TimeoutStopSec=30s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=myapp

# Security hardening
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/opt/myapp/data /opt/myapp/logs
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes

[Install]
WantedBy=multi-user.target
```

After creating or editing:
```bash
systemctl daemon-reload
systemctl enable --now myapp
```

### Service Types

| Type | When to use |
|------|-------------|
| `simple` | Process stays in foreground (default) |
| `forking` | Process forks and parent exits (classic daemon) |
| `oneshot` | Short-lived process, systemd waits for it to exit |
| `notify` | Process sends `sd_notify()` when ready (`READY=1`) |
| `exec` | Like simple but waits until exec completes |

### Timer (replaces cron)

```ini
# /etc/systemd/system/backup.timer
[Unit]
Description=Daily database backup

[Timer]
OnCalendar=*-*-* 02:00:00   # daily at 2 AM
RandomizedDelaySec=900       # random delay up to 15 min
Persistent=true              # run immediately if missed

[Install]
WantedBy=timers.target
```

```ini
# /etc/systemd/system/backup.service  (paired with timer)
[Unit]
Description=Database backup job
After=postgresql.service

[Service]
Type=oneshot
User=postgres
ExecStart=/usr/local/bin/backup-db.sh
StandardOutput=journal
StandardError=journal
```

```bash
systemctl enable --now backup.timer
systemctl list-timers backup*
# To run immediately (outside timer):
systemctl start backup.service
```

**OnCalendar syntax examples:**
```
daily                  # same as *-*-* 00:00:00
weekly                 # Mon *-*-* 00:00:00
monthly                # *-*-01 00:00:00
*-*-* 02:30:00         # every day at 02:30
Mon,Wed,Fri 09:00:00   # specific weekdays
*-*-* *:00:00          # every hour
*-*-* *:0/15:00        # every 15 minutes
```

Validate: `systemd-analyze calendar "Mon,Wed *-*-* 02:00:00"`

### Socket Activation

```ini
# /etc/systemd/system/myapp.socket
[Unit]
Description=My App socket

[Socket]
ListenStream=3000
Accept=no

[Install]
WantedBy=sockets.target
```

```ini
# /etc/systemd/system/myapp.service
[Unit]
Requires=myapp.socket

[Service]
# Service is started only when first connection arrives
NonBlocking=yes
ExecStart=/usr/bin/node /opt/myapp/dist/index.js
```

### Slice (resource control)

```ini
# /etc/systemd/system/apps.slice
[Slice]
CPUWeight=80
MemoryHigh=2G
MemoryMax=3G
IOWeight=80
```

Assign a service to a slice: `Slice=apps.slice` in `[Service]`.

## Key Commands

```bash
# Basic lifecycle
systemctl start   myapp
systemctl stop    myapp
systemctl restart myapp       # drops connections
systemctl reload  myapp       # graceful (sends SIGHUP, if service supports it)
systemctl status  myapp

# Enable/disable autostart
systemctl enable  myapp       # create symlink → runs at boot
systemctl disable myapp
systemctl enable --now myapp  # enable + start immediately
systemctl is-enabled myapp
systemctl is-active  myapp

# Reload unit files after editing
systemctl daemon-reload

# List
systemctl list-units --type=service --state=running
systemctl list-units --failed
systemctl list-timers --all

# Dependencies
systemctl list-dependencies myapp
systemctl list-dependencies --reverse myapp   # what depends ON myapp
```

## journalctl Filters

```bash
# Service logs
journalctl -u myapp                        # all logs
journalctl -u myapp -n 100 --no-pager      # last 100 lines
journalctl -u myapp -f                     # follow (tail -f)
journalctl -u myapp --since "1 hour ago"
journalctl -u myapp --since "2026-01-15 14:00" --until "2026-01-15 15:00"

# Priority filters
journalctl -p err                          # only errors and above
journalctl -p warning --since "2h ago"    # warnings since 2 hours ago
# Priorities: emerg(0) alert(1) crit(2) err(3) warning(4) notice(5) info(6) debug(7)

# Multiple units
journalctl -u nginx -u myapp

# System-wide (all services)
journalctl --since "2h ago" -p err

# Kernel messages
journalctl -k                              # kernel ring buffer
journalctl -k | grep -iE "oom|killed"     # OOM events

# Boot logs
journalctl -b                             # current boot
journalctl -b -1                          # previous boot
journalctl --list-boots

# Output formats
journalctl -u myapp -o json-pretty        # JSON
journalctl -u myapp --no-pager            # no pager (for scripts)

# Size management
journalctl --disk-usage
journalctl --vacuum-size=500M             # shrink to 500MB
journalctl --vacuum-time=30d              # delete entries older than 30d
```

## Environment Files

```bash
# /opt/myapp/.env (mode 600, owned by appuser)
DATABASE_URL=postgres://user:pass@localhost/myapp
REDIS_URL=redis://localhost:6379
NODE_ENV=production
PORT=3000
```

Reference in unit file:
```ini
EnvironmentFile=/opt/myapp/.env
# Or with '-' to suppress error if missing:
EnvironmentFile=-/opt/myapp/.env
```

Override at runtime: `systemctl edit myapp` (creates drop-in):
```ini
[Service]
Environment="PORT=4000"
```

## Drop-in Overrides

Never edit package-installed unit files in `/lib/systemd/system/` — they are
overwritten on package upgrades. Use drop-ins instead:

```bash
systemctl edit myapp          # opens editor, creates drop-in
systemctl edit --full myapp   # edit full copy

# Drop-in location:
# /etc/systemd/system/myapp.service.d/override.conf
```

## Security Hardening Directives

```ini
[Service]
# Prevent privilege escalation
NoNewPrivileges=yes

# Protect filesystem
ProtectSystem=strict         # /usr /boot read-only
ProtectHome=yes              # /home /root /run/user not accessible
ReadWritePaths=/opt/myapp    # whitelist writable paths
PrivateTmp=yes               # private /tmp, /var/tmp

# Restrict system calls
SystemCallFilter=@system-service    # allow common service syscalls
SystemCallErrorNumber=EPERM

# Networking
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
IPAddressDeny=any
IPAddressAllow=localhost 192.168.0.0/16

# Capabilities
CapabilityBoundingSet=CAP_NET_BIND_SERVICE   # bind ports <1024
AmbientCapabilities=CAP_NET_BIND_SERVICE
```

## Diagnostics

```bash
# Why did a service fail to start?
systemctl status myapp
journalctl -u myapp -n 50 --no-pager

# Check unit file syntax
systemd-analyze verify /etc/systemd/system/myapp.service

# Measure boot time
systemd-analyze blame
systemd-analyze critical-chain

# Check if timer fired
journalctl -u backup.timer -n 20
journalctl -u backup.service -n 20

# Manually run a oneshot service
systemctl start backup.service

# Check resource usage
systemctl status myapp    # shows cgroup memory/CPU stats
systemd-cgtop            # top-like view for cgroups
```

## supervisord (cascade marker — out of scope)

supervisord is a Python-based process supervisor popular in older setups and
Docker containers. On Ubuntu 24.04 prefer systemd units for host services.
supervisord is acceptable inside containers where systemd is unavailable.
Key commands: `supervisorctl status`, `supervisorctl restart <name>`,
config at `/etc/supervisor/conf.d/`.
