# Firewall Reference — UFW + nftables + fail2ban (Ubuntu 24.04)

## UFW (Uncomplicated Firewall)

UFW is the standard firewall management tool on Ubuntu. It wraps iptables/nftables.

### Baseline setup

```bash
# Default policies
ufw default deny incoming
ufw default allow outgoing

# Core ports
ufw allow 80/tcp           # HTTP
ufw allow 443/tcp          # HTTPS
ufw allow 443/udp          # HTTP/3 (QUIC) — only if using HTTP/3
ufw limit 2222/tcp         # SSH with rate limit (6 attempts / 30s)

# Enable (non-interactive)
ufw --force enable

# Verify
ufw status verbose
```

### Common rules

```bash
# Allow specific port
ufw allow 8080/tcp

# Allow port range
ufw allow 60000:61000/udp  # mosh

# Allow from specific IP only
ufw allow from 203.0.113.10 to any port 2222

# Allow from subnet
ufw allow from 10.0.0.0/8 to any port 5432   # PostgreSQL internal only

# Deny specific IP
ufw deny from 192.0.2.5

# Allow app profile (nginx full = 80+443)
ufw allow 'Nginx Full'
ufw app list                   # show available profiles

# Named interface
ufw allow in on eth0 to any port 80
```

### Manage rules

```bash
# View with numbers
ufw status numbered

# Delete by number
ufw delete 3

# Delete by specification
ufw delete allow 8080/tcp

# Disable UFW (allows all traffic — dangerous)
ufw disable

# Reset to defaults (removes all rules)
ufw --force reset
```

### UFW and Docker

Docker bypasses UFW by writing iptables rules directly. Fix:

```bash
# /etc/docker/daemon.json
{
  "iptables": false
}
```

Or use the `ufw-docker` tool:
```bash
curl -fsSL https://raw.githubusercontent.com/chaifeng/ufw-docker/master/ufw-docker \
  -o /usr/local/bin/ufw-docker && chmod +x /usr/local/bin/ufw-docker
ufw-docker install
```

Without this fix, `ufw deny 5432` will NOT block Docker-exposed PostgreSQL ports.

### Logging

```bash
ufw logging on                 # enable (low level by default)
ufw logging medium             # more detail (new, invalid, blocked)
tail -f /var/log/ufw.log
```

---

## nftables / iptables Direct Rules

On Ubuntu 24.04, `nftables` is the kernel backend. `iptables` commands are
translated via `iptables-nft` compatibility layer.

### View current rules

```bash
# nftables (native)
nft list ruleset

# iptables compat view
iptables -L -n -v
iptables -L -n -v --line-numbers
ip6tables -L -n -v             # IPv6

# UFW-managed chains
iptables -L ufw-user-input -n -v
```

### nftables basic ruleset

For advanced use (when UFW is insufficient). Save to `/etc/nftables.conf`:

```
#!/usr/sbin/nft -f
flush ruleset

table inet filter {
    chain input {
        type filter hook input priority 0; policy drop;

        # Allow established and related
        ct state established,related accept

        # Loopback
        iifname lo accept

        # ICMP (ping)
        ip  protocol icmp  accept
        ip6 nexthdr  icmpv6 accept

        # SSH (rate limited)
        tcp dport 2222 ct state new limit rate 5/minute accept

        # Web
        tcp dport { 80, 443 } accept
        udp dport 443 accept   # QUIC

        # Log and drop everything else
        log prefix "nft-drop: " flags all
        drop
    }

    chain forward {
        type filter hook forward priority 0; policy drop;
    }

    chain output {
        type filter hook output priority 0; policy accept;
    }
}
```

Apply:
```bash
nft -f /etc/nftables.conf          # load
systemctl enable --now nftables    # persist across reboots
nft list ruleset                   # verify
```

### NAT / Port Forwarding

```bash
# nftables NAT (forward port 8080 on host to container port 80)
nft add table ip nat
nft 'add chain ip nat prerouting { type nat hook prerouting priority -100; }'
nft 'add chain ip nat postrouting { type nat hook postrouting priority 100; }'
nft add rule ip nat prerouting tcp dport 8080 dnat to 172.17.0.2:80
nft add rule ip nat postrouting oifname eth0 masquerade

# Enable IP forwarding (for NAT / VPN)
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.d/99-forwarding.conf
sysctl -p /etc/sysctl.d/99-forwarding.conf
```

---

## fail2ban

fail2ban monitors log files and bans IPs that show brute-force patterns.

### Install

```bash
apt install -y fail2ban
systemctl enable --now fail2ban
```

### Main configuration

```ini
# /etc/fail2ban/jail.local  (do not edit jail.conf — it gets overwritten)
[DEFAULT]
bantime  = 3600       # 1 hour
findtime = 600        # 10 minutes window
maxretry = 5          # attempts before ban
banaction = ufw       # use UFW to ban (on UFW-enabled systems)

[sshd]
enabled  = true
port     = 2222
filter   = sshd
logpath  = /var/log/auth.log
maxretry = 3
bantime  = 86400      # 24 hours for SSH

[nginx-http-auth]
enabled  = true
port     = http,https
filter   = nginx-http-auth
logpath  = /var/log/nginx/error.log

[nginx-limit-req]
enabled  = true
port     = http,https
filter   = nginx-limit-req
logpath  = /var/log/nginx/error.log
maxretry = 10

[angie-http-auth]
enabled  = true
port     = http,https
filter   = nginx-http-auth       # Angie uses same format as nginx
logpath  = /var/log/angie/error.log

[angie-limit-req]
enabled  = true
port     = http,https
filter   = nginx-limit-req
logpath  = /var/log/angie/error.log
maxretry = 10
```

Apply changes: `systemctl restart fail2ban`

### Operations

```bash
# Status
fail2ban-client status                      # all jails
fail2ban-client status sshd                 # specific jail

# Unban an IP
fail2ban-client set sshd unbanip 203.0.113.5

# Reload config without restart
fail2ban-client reload

# Test a filter against a log
fail2ban-regex /var/log/auth.log /etc/fail2ban/filter.d/sshd.conf

# View banned IPs
fail2ban-client banned
iptables -n -L f2b-sshd               # or via iptables
```

### Custom filter for Angie/nginx app

```ini
# /etc/fail2ban/filter.d/myapp-bruteforce.conf
[Definition]
failregex = ^<HOST>.*"POST /api/auth/login HTTP.*" 401
ignoreregex =
```

```ini
# /etc/fail2ban/jail.local addition
[myapp-bruteforce]
enabled  = true
port     = http,https
filter   = myapp-bruteforce
logpath  = /var/log/angie/access.log
maxretry = 10
findtime = 300
bantime  = 7200
```

### Whitelist your own IP

```ini
[DEFAULT]
ignoreip = 127.0.0.1/8 ::1 203.0.113.0/24   # never ban these
```

---

## WireGuard VPN (mention)

WireGuard is a modern, fast VPN built into the Linux kernel (5.6+).
On Ubuntu 24.04: `apt install -y wireguard`. Config at `/etc/wireguard/wg0.conf`.
Useful for securing admin access: restrict PostgreSQL/Redis to VPN subnet,
only expose 80/443 publicly.

```bash
# Basic setup (server)
wg genkey | tee /etc/wireguard/private.key | wg pubkey > /etc/wireguard/public.key
# Then configure /etc/wireguard/wg0.conf
systemctl enable --now wg-quick@wg0
wg show              # current status
```

Full WireGuard setup is out of scope for this skill — it's a separate domain.
