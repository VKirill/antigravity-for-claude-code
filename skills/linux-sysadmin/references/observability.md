# Observability / Logs Reference (Ubuntu 24.04)

## journalctl (Systemd Journal)

```bash
# Service logs
journalctl -u myapp -n 100 --no-pager       # last 100 lines
journalctl -u myapp -f                       # follow (like tail -f)
journalctl -u myapp --since "1 hour ago"
journalctl -u myapp --since "2026-01-15 14:00" --until "2026-01-15 15:00"

# Priority filter (higher number = more verbose)
# emerg=0 alert=1 crit=2 err=3 warning=4 notice=5 info=6 debug=7
journalctl -p err --since "24h ago"          # errors and worse
journalctl -p warning -u nginx               # warnings for nginx

# Kernel messages
journalctl -k                                # kernel ring buffer
journalctl -k | grep -iE "oom|killed|segfault|panic"

# Multiple units
journalctl -u nginx -u php8.5-fpm --since "1h ago"

# Boot-scoped
journalctl -b                                # current boot
journalctl -b -1                             # previous boot
journalctl --list-boots

# JSON output (for scripts)
journalctl -u myapp -o json-pretty | jq '.MESSAGE'

# Disk usage and cleanup
journalctl --disk-usage
journalctl --vacuum-size=500M               # trim to 500MB
journalctl --vacuum-time=30d               # delete older than 30 days

# Persist journal across reboots
mkdir -p /var/log/journal
systemd-tmpfiles --create --prefix /var/log/journal
# or: in /etc/systemd/journald.conf: Storage=persistent
```

## logrotate

Manages rotation of log files written directly to disk (not systemd journal).

```bash
# Test a config (dry run)
logrotate -d /etc/logrotate.d/nginx

# Force rotation now (bypass timing)
logrotate -f /etc/logrotate.d/nginx

# All configs (cron does this daily)
logrotate /etc/logrotate.conf

# Verify last rotation
ls -lth /var/log/nginx/
```

Template — see `storage.md` for full logrotate config examples.

## System Metrics (CLI)

### Real-time overview

```bash
top -bn1 | head -20              # quick snapshot (non-interactive)
htop                             # interactive, color, tree view
btop                             # modern TUI, mouse support, graphs

# CPU
mpstat 1 5                       # per-CPU stats, 5 samples
sar -u 1 5                       # cpu: %user %system %idle

# Memory
free -h                          # RAM + swap
vmstat 1 5                       # virtual memory, swapping activity
sar -r 1 5                       # memory: kbmemused, kbcached, kbswpused

# Load average
uptime                           # 1/5/15 min load averages
sar -q 1 5                       # runqueue + load

# Disk I/O
iostat -x 1 5                    # extended per-device stats (await, util)
iotop -o                         # processes doing I/O now (requires root)
sar -b 1 5                       # block device summary

# Network
ss -tlnp                         # listening TCP sockets with PIDs
ss -s                            # socket summary (established, etc.)
ip -s link                       # interface stats (RX/TX bytes)
sar -n DEV 1 5                   # per-interface throughput
```

### Historical (sysstat / sar)

```bash
# CPU history today
sar -u -f /var/log/sysstat/sa$(date +%d)

# Memory history between times
sar -r -s 14:00 -e 15:00 -f /var/log/sysstat/sa$(date +%d)

# I/O history
sar -b -f /var/log/sysstat/sa$(date +%d)

# Previous day
sar -u -f /var/log/sysstat/sa14      # sa + DD of month

# Enable sysstat collection (2-min interval)
apt install -y sysstat
sed -i 's/ENABLED="false"/ENABLED="true"/' /etc/default/sysstat
systemctl enable --now sysstat
```

### atop (process-level history)

```bash
# Real-time
atop 5              # refresh every 5 seconds

# Historical (stored in /var/log/atop/)
atop -r /var/log/atop/atop_$(date +%Y%m%d)
# Then navigate: t (next interval), T (prev), b (jump to time)
# Views: g (generic), m (memory), d (disk), n (network), c (command)

# Jump to specific time period
atop -r /var/log/atop/atop_20260115 -b 14:00 -e 14:30

# Diagnose OOM: look for processes killed
atop -r FILE | grep -i kill
```

### vmstat / iostat / dstat

```bash
# vmstat — virtual memory, swapping
vmstat 2 10          # 2s interval, 10 samples
# Columns: r=runqueue b=blocked swpd si/so=swap in/out bi/bo=block in/out

# iostat — disk I/O
iostat -x 2 5
# Key columns: %util (saturation), await (ms/request), r/s w/s (ops/sec)

# dstat — combined overview (install: apt install dstat)
dstat -cdngy          # cpu disk net system memory
dstat --top-cpu       # top CPU process
dstat --top-io        # top I/O process
```

## Process Debugging

```bash
# Find process by port
ss -tlnp | grep :3000
lsof -i :3000

# Find process by name
pgrep -a node
pgrep -f "ecosystem.config"

# Open files by process
lsof -p PID
lsof -u appuser

# strace — system call trace
strace -p PID                    # attach to running process
strace -e trace=network -p PID   # network calls only
strace -e trace=file,open PID    # file operations
strace -tt -o /tmp/trace.txt cmd # timestamped, to file

# OOM debugging
dmesg -T | grep -iE "oom|killed|out of memory"
journalctl -k | grep -iE "oom|killed"
# dmesg shows: "oom-killer: task=myapp ... Killed process 12345"

# SysRq (emergency — SSH locked but console accessible)
echo s > /proc/sysrq-trigger    # sync filesystems
echo u > /proc/sysrq-trigger    # remount read-only
echo b > /proc/sysrq-trigger    # immediate reboot (last resort)
# Enable: echo 1 > /proc/sys/kernel/sysrq
```

## Netdata (if installed)

Netdata is a real-time metrics daemon with a web UI and 1-2 weeks of history.

```bash
# Install
curl -fsSL https://my-netdata.io/kickstart.sh | bash

# Service
systemctl status netdata
# Listens: 127.0.0.1:19999 (local only)

# API
curl -s http://127.0.0.1:19999/api/v1/info | jq .
curl -s "http://127.0.0.1:19999/api/v1/data?chart=system.cpu&after=-3600" | jq .

# Expose behind nginx (with auth)
# location /netdata/ {
#     proxy_pass http://127.0.0.1:19999/;
#     auth_basic "Netdata";
#     auth_basic_user_file /etc/nginx/htpasswd;
# }

# Config
/etc/netdata/netdata.conf
/etc/netdata/health.d/           # alert rules
/var/log/netdata/                # logs
```

## node_exporter + Prometheus Textfile

node_exporter exposes system metrics in Prometheus format.

```bash
# Install node_exporter (Ubuntu 24.04)
apt install -y prometheus-node-exporter
systemctl enable --now prometheus-node-exporter
# Listens: 9100/tcp (restrict with UFW or Angie auth)

# Check metrics
curl -s http://localhost:9100/metrics | grep node_memory_MemFree_bytes
curl -s http://localhost:9100/metrics | grep node_filesystem_avail_bytes

# Textfile collector (custom metrics)
# node_exporter reads .prom files from its textfile directory
# Default: /var/lib/prometheus/node-exporter/ (may vary by install method)
node_exporter --collector.textfile.directory /var/lib/node-exporter/textfile/

# Write a custom metric
cat > /var/lib/node-exporter/textfile/backup.prom << 'EOF'
# HELP backup_last_success_timestamp_seconds Unix time of last successful backup
# TYPE backup_last_success_timestamp_seconds gauge
backup_last_success_timestamp_seconds $(date +%s)
EOF
```

## Grafana Loki (cascade marker — out of scope)

Loki is a horizontally scalable log aggregation system from Grafana Labs, designed
to be cost-effective by indexing only metadata (labels), not log content. Pair with
Promtail (log shipper) on each host and Grafana for visualization. On a single-host
setup, journalctl + sysstat is usually sufficient. Use Loki when you have multiple
servers and want centralized log search with label-based filtering.
