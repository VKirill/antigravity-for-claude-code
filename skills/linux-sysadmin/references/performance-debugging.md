# Performance and Debugging Reference (Ubuntu 24.04)

## Diagnostic Priority Order

When something is slow or broken:
1. `top -bn1 | head -20` — immediate CPU/memory snapshot
2. `free -h` + `vmstat 1 3` — memory pressure + swapping
3. `df -h` + `iostat -x 1 5` — disk space + I/O saturation
4. `ss -tlnp` — what's listening; `ss -s` — socket stats
5. `journalctl -p err --since "1h ago"` — error events
6. `dmesg -T | grep -iE "oom|killed"` — kernel-level events
7. Service-specific logs (`pm2 logs`, `docker logs`, `journalctl -u svc`)

---

## CPU

```bash
# Snapshot
top -bn1 | head -20          # non-interactive
htop                         # interactive, F5=tree, F6=sort
btop                         # modern: graphs, mouse

# Per-CPU breakdown (spot single-core saturation)
mpstat -P ALL 1 5

# Who's using CPU
ps aux --sort=-%cpu | head -15
pidstat -u 2 5               # per-process CPU (sysstat)

# Load average vs core count
nproc                        # number of logical CPUs
uptime                       # load: 1/5/15 min
# load > nproc = queue forming (CPU-bound)
# load > 2*nproc = serious saturation

# Historical
sar -u -f /var/log/sysstat/sa$(date +%d)
sar -u -s 14:00 -e 15:00
```

---

## Memory

```bash
# Overview
free -h
# Buffers/cache are available — Linux reclaims them under pressure

# Detailed
cat /proc/meminfo | grep -E "MemTotal|MemFree|MemAvailable|SwapTotal|SwapFree|Dirty"

# Swap activity (si/so > 0 = swapping, performance impact)
vmstat 1 5
# si = swap in (reading from disk), so = swap out (writing to disk)

# Per-process memory
ps aux --sort=-%mem | head -15
pidstat -r 2 5               # per-process memory

# OOM events
dmesg -T | grep -iE "oom|killed|out of memory"
journalctl -k | grep -iE "oom|killed"
# dmesg output: "oom-killer invoked ... Killed process 12345 (node)"

# Overcommit settings (relevant for Redis)
cat /proc/sys/vm/overcommit_memory
# 0=heuristic 1=always allow 2=never allow
# Redis recommends: sysctl vm.overcommit_memory=1

# Add swap (if running out)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Swappiness (0=prefer RAM, 60=default, 10=server recommended)
sysctl vm.swappiness=10
echo "vm.swappiness=10" >> /etc/sysctl.d/99-performance.conf
```

---

## Disk I/O

```bash
# Disk usage
df -h                          # filesystem usage
du -xsh /* 2>/dev/null | sort -rh | head -10

# I/O stats (key: await=latency ms, %util=saturation)
iostat -x 1 5
# %util > 80% = disk is a bottleneck
# await > 20ms = slow (HDD) or concerning (SSD)

# Which process is doing I/O
iotop -o                       # requires root; -o = only show I/O processes
pidstat -d 2 5

# Block device info
lsblk -o NAME,SIZE,TYPE,MOUNTPOINT
cat /proc/diskstats            # raw kernel counters

# I/O scheduler (check for SSDs)
cat /sys/block/sda/queue/scheduler
# For SSDs: 'none' or 'mq-deadline'
# Set: echo mq-deadline > /sys/block/sda/queue/scheduler

# Historical I/O
sar -b -f /var/log/sysstat/sa$(date +%d)
```

---

## Network

```bash
# Listening sockets
ss -tlnp                       # TCP listening
ss -ulnp                       # UDP listening
ss -tlnp | grep :3000          # specific port

# Connection states
ss -s                          # summary: ESTABLISHED, TIME-WAIT, etc.
ss -tan state established | wc -l   # count established TCP

# Per-connection details
ss -tan state established '( dport = :80 or dport = :443 )'

# Interface stats
ip -s link show eth0           # RX/TX bytes, errors, drops
sar -n DEV 1 5                 # per-interface throughput over time

# DNS resolution check
dig example.com @8.8.8.8       # external resolver
resolvectl status              # systemd-resolved status
cat /etc/resolv.conf

# Test connectivity
curl -v -o /dev/null https://example.com    # verbose HTTP (timing in -w)
curl -w "@curl-format.txt" -o /dev/null -s https://example.com
# curl-format.txt: time_namelookup, time_connect, time_starttransfer, time_total

# TCP traceroute
traceroute -T -p 443 example.com   # TCP traceroute (better than ICMP through firewalls)
mtr example.com                    # continuous traceroute with stats
```

---

## Process Debugging

```bash
# strace — system call tracer
strace -p PID                              # attach to running process
strace -p PID -e trace=network            # network calls only
strace -p PID -e trace=openat,read,write  # file I/O
strace -tt -o /tmp/trace.txt command      # timestamped output to file
strace -c command                          # syscall count summary

# lsof — open files
lsof -p PID                               # all files for process
lsof -i :3000                             # process using port 3000
lsof -u appuser                           # all files for user
lsof +D /var/log                          # all processes using a directory

# pmap — memory map
pmap -x PID | tail -20                    # memory regions
pmap -x PID | sort -n -k3 | tail -20     # sorted by size

# gdb — attach to live process (carefully)
gdb -p PID                                # attach
# (gdb) thread apply all bt              # backtrace all threads
# (gdb) detach                           # detach without killing

# Core dumps
# Enable core dumps
ulimit -c unlimited
echo '/tmp/core.%e.%p' > /proc/sys/kernel/core_pattern
# Analyze
gdb /usr/bin/node /tmp/core.node.12345
```

---

## OOM Debugging

```bash
# Find recent OOM events
dmesg -T | grep -B5 "oom-killer"
journalctl -k | grep -B5 "oom-killer"

# OOM killer score for a process (higher = more likely to be killed)
cat /proc/PID/oom_score
cat /proc/PID/oom_adj            # legacy
cat /proc/PID/oom_score_adj      # -1000 (never kill) to +1000

# Protect a process from OOM killer
echo -1000 > /proc/PID/oom_score_adj     # never kill this pid
echo -1000 >> /etc/sysctl.d/99-oom.conf  # not persistent per-process

# Adjust: make a specific process less likely to be killed
echo -500 > /proc/$(pgrep postgres)/oom_score_adj

# Memory overcommit (controls whether OOM can happen)
# 0 = heuristic (default), 1 = always allow, 2 = strict limit
cat /proc/sys/vm/overcommit_memory
sysctl vm.overcommit_memory=2      # strict mode — prevent OOM by refusing allocations
```

---

## perf (Advanced)

```bash
# Install
apt install -y linux-tools-$(uname -r) linux-tools-common

# CPU profiling (press Ctrl+C to stop)
perf top                          # live top by symbol
perf record -g -p PID -- sleep 10 # record 10s of PID
perf report                        # view flame-graph style

# Count events for a command
perf stat node myapp.js

# System-wide 30s profile
perf record -a -g -- sleep 30
perf report --no-browser

# CPU cycles breakdown
perf stat -e cycles,instructions,cache-misses node myapp.js
```

---

## bpftrace (Advanced)

bpftrace requires a recent kernel (5.8+) and root.

```bash
# Install
apt install -y bpftrace

# One-liners
# CPU syscall latency distribution for a process
bpftrace -e 'tracepoint:raw_syscalls:sys_enter /pid == 1234/ { @start[tid] = nsecs; }
             tracepoint:raw_syscalls:sys_exit  /pid == 1234 && @start[tid]/ {
               @us[probe] = hist((nsecs - @start[tid]) / 1000); delete(@start[tid]);
             }'

# File opens by process name
bpftrace -e 'tracepoint:syscalls:sys_enter_openat { printf("%s %s\n", comm, str(args->filename)); }'

# TCP connections being made
bpftrace -e 'kprobe:tcp_connect { printf("%-6d %-20s\n", pid, comm); }'

# Slow disk I/O (>10ms)
bpftrace -e 'tracepoint:block:block_rq_insert { @start[args->sector] = nsecs; }
             tracepoint:block:block_rq_complete /@start[args->sector]/
             { $lat = (nsecs - @start[args->sector]) / 1000000;
               if ($lat > 10) { printf("disk I/O latency: %d ms\n", $lat); }
               delete(@start[args->sector]); }'
```

---

## SysRq (Emergency)

```bash
# Enable SysRq (if disabled)
echo 1 > /proc/sys/kernel/sysrq

# Via keyboard (Alt+SysRq+KEY) or:
echo KEY > /proc/sysrq-trigger

# Keys:
# s = sync all filesystems (before forced reboot)
# u = remount all filesystems read-only
# b = immediate reboot (no sync — use s+u first)
# f = trigger OOM killer manually
# m = dump memory info to console
# p = dump registers and task state
# t = dump task list (backtrace)
# k = kill all processes on current tty (SAK)
```

---

## PostgreSQL Performance

```bash
# Long-running queries
psql -U postgres -c "
SELECT pid, now() - query_start AS dur, state, left(query, 80)
FROM pg_stat_activity
WHERE state != 'idle' ORDER BY dur DESC LIMIT 10;"

# Kill a query
psql -U postgres -c "SELECT pg_terminate_backend(PID);"

# Top queries by total time (requires pg_stat_statements)
psql -U postgres -c "
SELECT query, calls, round(total_exec_time::numeric, 2) AS total_ms,
       round(mean_exec_time::numeric, 2) AS mean_ms
FROM pg_stat_statements
ORDER BY total_exec_time DESC LIMIT 20;"

# Table bloat
psql -U postgres -d mydb -c "
SELECT relname, n_dead_tup, n_live_tup
FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 10;"

# Run VACUUM
psql -U postgres -d mydb -c "VACUUM ANALYZE table_name;"
```
