# Security Hardening Reference (Ubuntu 24.04)

## SSH Hardening

```bash
# Edit sshd config
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak.$(date +%s)
```

Key settings in `/etc/ssh/sshd_config`:
```
Port 2222
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
MaxAuthTries 3
MaxSessions 5
ClientAliveInterval 300
ClientAliveCountMax 2
UseDNS no
X11Forwarding no
PrintMotd no
AllowUsers ubuntu deploy
# Do not use 'AllowUsers *' — be explicit
```

```bash
# Test config before reload
sshd -t
systemctl reload sshd

# Verify key-only auth is working (from another terminal first!)
ssh -p 2222 -i ~/.ssh/id_ed25519 ubuntu@server
```

### SSH key management

```bash
# Generate Ed25519 key (preferred over RSA for new keys)
ssh-keygen -t ed25519 -C "user@host-$(date +%Y%m%d)" -f ~/.ssh/id_ed25519

# Add to server
ssh-copy-id -i ~/.ssh/id_ed25519.pub -p 2222 ubuntu@server
# or manually:
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys

# Audit authorized keys
cat ~/.ssh/authorized_keys    # who has access?
```

---

## unattended-upgrades (Auto Security Patches)

```bash
apt install -y unattended-upgrades update-notifier-common

# Enable automatic security upgrades
dpkg-reconfigure -plow unattended-upgrades
# or manually:
```

`/etc/apt/apt.conf.d/50unattended-upgrades`:
```
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-New-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";   // manual reboots for kernel
Unattended-Upgrade::Mail "admin@example.com";
Unattended-Upgrade::MailReport "on-change";
```

`/etc/apt/apt.conf.d/20auto-upgrades`:
```
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
```

```bash
# Test
unattended-upgrade --dry-run --debug

# Status
systemctl status unattended-upgrades
tail -50 /var/log/unattended-upgrades/unattended-upgrades.log

# Check pending security updates
apt list --upgradable 2>/dev/null | grep -i security
```

---

## AppArmor (Ubuntu's MAC system)

Ubuntu 24.04 uses AppArmor (not SELinux). AppArmor confines processes using
profiles. Do NOT disable it — configure profiles instead.

```bash
# Status
systemctl status apparmor
aa-status                           # active profiles + confined processes
apparmor_status                     # same, alternate command

# Profile modes
# enforce — violations are blocked + logged
# complain — violations are logged only (useful for tuning)

# Check a process
cat /proc/$(pgrep nginx)/attr/current   # shows apparmor profile

# Common profiles (Ubuntu ships many by default)
ls /etc/apparmor.d/
# usr.sbin.nginx, usr.sbin.mysqld, etc.

# Switch profile to complain mode (for debugging)
aa-complain /etc/apparmor.d/usr.sbin.nginx

# Switch back to enforce
aa-enforce /etc/apparmor.d/usr.sbin.nginx

# Reload a profile after editing
apparmor_parser -r /etc/apparmor.d/usr.sbin.nginx

# View violations in journal
journalctl | grep apparmor | tail -20
grep apparmor /var/log/syslog | tail -20

# Generate profile for a binary (start in complain mode, then convert)
aa-genprof /usr/local/bin/myapp
# Run the app, trigger all code paths, then:
aa-logprof    # build profile from complain-mode logs
```

### Writing a basic AppArmor profile

```
# /etc/apparmor.d/usr.local.bin.myapp
#include <tunables/global>

/usr/local/bin/myapp {
    #include <abstractions/base>
    #include <abstractions/nameservice>

    /usr/local/bin/myapp mr,
    /opt/myapp/** rw,
    /opt/myapp/data/** rw,
    /var/log/myapp/** w,
    /tmp/** rw,
    /etc/myapp.conf r,

    network inet stream,
    network inet6 stream,

    # Deny everything else (implicit)
}
```

```bash
apparmor_parser -r /etc/apparmor.d/usr.local.bin.myapp
aa-status | grep myapp
```

---

## auditd (System Auditing)

auditd records security-relevant events (file access, privileged commands, auth).

```bash
apt install -y auditd audispd-plugins
systemctl enable --now auditd
auditctl -l    # list current rules
auditctl -s    # status
```

### Common audit rules

```bash
# /etc/audit/rules.d/99-custom.rules

# Watch SSH config changes
-w /etc/ssh/sshd_config -p wa -k sshd_config

# Watch for privilege escalation
-w /usr/bin/sudo -p x -k sudo_exec
-w /bin/su -p x -k su_exec

# Watch /etc directory for writes
-w /etc -p wa -k etc_changes

# Watch for unauthorized crontab changes
-w /var/spool/cron/crontabs -p wa -k cron_changes

# Monitor setuid/setgid usage
-a always,exit -F arch=b64 -S execve -F euid=0 -F uid!=0 -k privilege_escalation

# Detect user/group changes
-w /etc/passwd  -p wa -k user_changes
-w /etc/shadow  -p wa -k user_changes
-w /etc/group   -p wa -k user_changes
-w /etc/sudoers -p wa -k sudoers_changes
```

```bash
# Apply rules
augenrules --load
systemctl restart auditd

# Query logs
ausearch -k sshd_config           # events matching key
ausearch -k privilege_escalation --start today
ausearch -ua 1000 --start recent  # events for UID 1000
aureport --summary                 # high-level report
aureport --failed                  # failed attempts
```

---

## Kernel Hardening (sysctl)

`/etc/sysctl.d/99-security.conf`:
```
# Network protection
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_source_route = 0

# Kernel hardening
kernel.randomize_va_space = 2      # ASLR: full randomization
kernel.dmesg_restrict = 1          # restrict dmesg to root
kernel.kptr_restrict = 2           # hide kernel pointers
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
kernel.yama.ptrace_scope = 1       # restrict ptrace

# Memory
vm.swappiness = 10                 # prefer RAM over swap
```

```bash
# Apply
sysctl -p /etc/sysctl.d/99-security.conf
sysctl --system    # apply all /etc/sysctl.d/*.conf
```

---

## Security Audit Commands

```bash
# World-writable files (should be empty outside /tmp /proc)
find / -xdev -type f -perm -0002 \
  -not -path "/tmp/*" -not -path "/proc/*" -not -path "/sys/*" 2>/dev/null | head -20

# SUID/SGID binaries (document baseline, alert on new ones)
find / -xdev \( -perm -4000 -o -perm -2000 \) -type f 2>/dev/null | sort

# Users with login shells
grep -v '/nologin\|/false\|/sync' /etc/passwd | cut -d: -f1,7

# SSH authorized keys across all users
for user in $(cut -d: -f1 /etc/passwd); do
  home=$(getent passwd "$user" | cut -d: -f6)
  key_file="$home/.ssh/authorized_keys"
  [ -f "$key_file" ] && echo "=== $user ===" && cat "$key_file"
done

# Open ports (external-facing — excludes loopback)
ss -tulnp | grep -v "127.0.0.1\|::1"

# Failed logins (last 24h)
journalctl --since "24h ago" | grep "Failed password\|authentication failure" | wc -l

# Top attacking IPs
grep "Failed password" /var/log/auth.log | awk '{print $(NF-3)}' | sort | uniq -c | sort -rn | head -10

# Sudo usage
grep sudo /var/log/auth.log | tail -50

# Angie/nginx HSTS check
for conf in /etc/angie/sites-enabled/*.conf; do
  domain=$(grep -m1 server_name "$conf" | awk '{print $2}' | tr -d ';')
  hsts=$(grep -c "Strict-Transport-Security" "$conf")
  echo "$domain HSTS=$hsts"
done

# Packages with known CVEs (if ubuntu-advantage-tools installed)
pro security-status 2>/dev/null || apt list --upgradable 2>/dev/null | grep -ci security
```

---

## fail2ban (see also firewall.md for full config)

```bash
# Quick status
fail2ban-client status
fail2ban-client status sshd

# Unban
fail2ban-client set sshd unbanip IP

# Manual ban (e.g., active attacker)
fail2ban-client set sshd banip 203.0.113.5
```

---

## Security Hardening Checklist

- [ ] SSH: key-only auth (`PasswordAuthentication no`)
- [ ] SSH: non-default port (2222) + rate-limit via UFW (`ufw limit 2222/tcp`)
- [ ] SSH: `PermitRootLogin no`
- [ ] SSH: `AllowUsers` set to specific users only
- [ ] UFW: enabled, default deny incoming, only 80/443/2222 open
- [ ] fail2ban: active for sshd (and nginx/angie for web)
- [ ] unattended-upgrades: enabled for security patches
- [ ] AppArmor: enabled, no profiles in `disabled/` for running services
- [ ] Kernel sysctl: TCP syncookies, ASLR, dmesg_restrict applied
- [ ] No world-writable files outside /tmp
- [ ] SUID/SGID baseline documented and monitored
- [ ] All service accounts: `nologin` shell, minimal sudo
- [ ] Secrets: `.env` files mode 600, not in git
- [ ] auditd: running with rules for privilege escalation + config changes
- [ ] Logs: logrotate configured, journal size limited
