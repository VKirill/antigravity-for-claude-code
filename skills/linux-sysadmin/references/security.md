# Security Hardening Reference

## SSH Hardening

`/etc/ssh/sshd_config`:
```
Port 2222
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
AllowUsers deploy admin ubuntu
```

After changes: `sshd -t && systemctl reload sshd`

## Fail2ban

### Install & Configure
```ini
# /etc/fail2ban/jail.local
[sshd]
enabled = true
port = 2222
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600
```

### Commands
```bash
fail2ban-client status                # All jails
fail2ban-client status sshd           # SSH jail details
fail2ban-client set sshd unbanip IP   # Unban IP
```

## UFW Firewall

### Standard rules
```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 80/tcp
ufw allow 443/tcp
ufw limit 2222/tcp           # SSH with rate limit
ufw enable
```

### Management
```bash
ufw status verbose
ufw status numbered
ufw delete RULE_NUMBER
ufw allow from IP to any port 2222   # Allow specific IP
ufw deny from IP                      # Block IP
```

## Kernel Hardening

`/etc/sysctl.d/99-security.conf`:
```
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
kernel.randomize_va_space = 2
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
```

Apply: `sysctl -p /etc/sysctl.d/99-security.conf`

## System Limits

`/etc/security/limits.conf`:
```
* soft nofile 65536
* hard nofile 65536
* soft nproc 65536
* hard nproc 65536
```

## Security Audit Checklist

- [ ] SSH: key-only auth, non-default port (2222)
- [ ] UFW: enabled, minimal rules (80/443/2222)
- [ ] Fail2ban: active for SSH
- [ ] Unattended upgrades: security patches auto-installed
- [ ] No world-writable files in /etc
- [ ] SUID/SGID audit: no unexpected binaries
- [ ] Log rotation: configured for all services
- [ ] Kernel hardening: sysctl applied
- [ ] Services: only needed ones running
- [ ] Docker: no containers running as root unnecessarily

## Security Audit Commands

```bash
# World-writable files
find / -xdev -type f -perm -0002 -not -path "/tmp/*" -not -path "/proc/*" 2>/dev/null | head -20

# SUID/SGID binaries
find / -xdev \( -perm -4000 -o -perm -2000 \) -type f 2>/dev/null | head -20

# Users with login shell
grep -v '/nologin\|/false' /etc/passwd | cut -d: -f1,7

# Failed logins (last 24h)
journalctl --since "24h ago" | grep -c "Failed password"

# Top attacking IPs
grep "Failed password" /var/log/auth.log | awk '{print $11}' | sort | uniq -c | sort -rn | head -10

# Listening ports (external)
ss -tulnp | grep -v "127.0.0.1\|::1"

# Angie security headers check
for conf in /etc/angie/sites-enabled/*; do
  domain=$(grep server_name "$conf" 2>/dev/null | head -1 | awk '{print $2}' | tr -d ';')
  has_hsts=$(grep -c "Strict-Transport-Security" "$conf" 2>/dev/null)
  echo "$domain: HSTS=$has_hsts"
done
```

## Log Rotation

```
/var/log/myapp/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        systemctl reload myapp > /dev/null 2>&1 || true
    endscript
}
```
