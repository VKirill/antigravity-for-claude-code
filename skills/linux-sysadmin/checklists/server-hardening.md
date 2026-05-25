# Server Hardening Checklist

Run through this checklist when provisioning a new Ubuntu 24.04 server or
auditing an existing one. Each item links to the command(s) needed.

## SSH

- [ ] **Non-default port**: `grep "^Port" /etc/ssh/sshd_config` → should be `2222` (not 22)
- [ ] **Root login disabled**: `grep "^PermitRootLogin" /etc/ssh/sshd_config` → `no`
- [ ] **Password auth disabled**: `grep "^PasswordAuthentication" /etc/ssh/sshd_config` → `no`
- [ ] **AllowUsers set**: `grep "^AllowUsers" /etc/ssh/sshd_config` → specific users listed
- [ ] **MaxAuthTries ≤ 3**: `grep "^MaxAuthTries" /etc/ssh/sshd_config` → `3`
- [ ] **Test**: `sshd -t` (no errors)

## Firewall (UFW)

- [ ] **UFW enabled**: `ufw status` → `Status: active`
- [ ] **Default deny incoming**: `ufw status verbose | grep "Default:"` → `deny (incoming)`
- [ ] **Only required ports open**: `ufw status verbose` → only 2222, 80, 443
- [ ] **No unexpected open ports**: `ss -tulnp | grep -v "127.0.0.1\|::1"` → review
- [ ] **Docker bypass handled**: if Docker is in use, verify containers bind to `127.0.0.1`

## fail2ban

- [ ] **Active**: `systemctl is-active fail2ban` → `active`
- [ ] **SSH jail enabled**: `fail2ban-client status sshd` → active + no errors
- [ ] **Web jail enabled**: `fail2ban-client status nginx-limit-req` (or angie-limit-req)
- [ ] **Your IP whitelisted**: `grep "ignoreip" /etc/fail2ban/jail.local` → your IP/subnet listed

## Updates

- [ ] **unattended-upgrades active**: `systemctl is-active unattended-upgrades` → `active`
- [ ] **Security upgrades configured**: `cat /etc/apt/apt.conf.d/50unattended-upgrades | grep "security"`
- [ ] **Pending security updates**: `apt list --upgradable 2>/dev/null | grep -i security` → ideally empty
- [ ] **Last upgrade run**: `tail -20 /var/log/unattended-upgrades/unattended-upgrades.log`

## AppArmor

- [ ] **Active**: `systemctl is-active apparmor` → `active`
- [ ] **Profiles loaded**: `aa-status | head -5` → shows enforce mode profiles
- [ ] **No profiles disabled**: `ls /etc/apparmor.d/disable/` → should be empty or only intentional

## Kernel Hardening

- [ ] **ASLR enabled**: `sysctl kernel.randomize_va_space` → `2`
- [ ] **SYN cookies**: `sysctl net.ipv4.tcp_syncookies` → `1`
- [ ] **ICMP redirects blocked**: `sysctl net.ipv4.conf.all.accept_redirects` → `0`
- [ ] **Sysctl file applied**: `ls /etc/sysctl.d/99-security.conf` exists

## File System

- [ ] **World-writable files**: `find / -xdev -perm -0002 -type f -not -path "/tmp/*" -not -path "/proc/*" 2>/dev/null | wc -l` → should be 0
- [ ] **SUID/SGID baseline documented**: `find / -xdev \( -perm -4000 -o -perm -2000 \) -type f 2>/dev/null | sort` → reviewed
- [ ] **Secrets perms**: `find /home /opt /root -name ".env" -o -name "*.key" 2>/dev/null | xargs ls -la` → mode 600
- [ ] **Log dirs writable by service only**: `ls -la /var/log/angie /var/log/postgresql`

## SSL / TLS

- [ ] **All certs valid and not expiring**: `certbot certificates` → check expiry dates
- [ ] **HSTS headers set**: `curl -sI https://domain | grep Strict-Transport-Security`
- [ ] **TLS 1.0/1.1 disabled**: `nmap --script ssl-enum-ciphers -p 443 domain | grep TLSv1.0` → empty
- [ ] **OCSP stapling enabled**: `grep ssl_stapling /etc/angie/sites-enabled/*.conf` → `on`

## Services

- [ ] **Only needed services running**: `systemctl list-units --type=service --state=running`
- [ ] **No unexpected listeners**: `ss -tulnp | grep -v "127.0.0.1\|::1"`
- [ ] **Service accounts use nologin**: `grep -v nologin /etc/passwd | grep -v "^root\|^ubuntu"` → review
- [ ] **PM2 runs as non-root**: `pm2 list` → ensure started as `ubuntu` not `root`
- [ ] **Docker containers not running as root unnecessarily**: `docker inspect $(docker ps -q) --format '{{.Name}} user={{.Config.User}}'` → review

## Logs and Monitoring

- [ ] **logrotate configured** for all services: `ls /etc/logrotate.d/`
- [ ] **Journal size limited**: `journalctl --disk-usage` → reasonable size
- [ ] **No critical errors in journals**: `journalctl -p err --since "24h ago" --no-pager` → review
- [ ] **fail2ban log**: `tail -20 /var/log/fail2ban.log` → normal activity only

## Audit

- [ ] **auditd active** (if required): `systemctl is-active auditd`
- [ ] **Audit rules loaded**: `auditctl -l` → rules present
- [ ] **No unusual sudo usage**: `grep sudo /var/log/auth.log | tail -20`
