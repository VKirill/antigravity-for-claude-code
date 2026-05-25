# Angie Web Server — Complete Configuration Guide

Angie 1.11.3 — российский форк Nginx от бывших разработчиков Nginx (webserver-llc/angie).
Drop-in замена Nginx: все директивы Nginx работают. Плюс уникальные фичи.

## Unique Angie Features (vs Nginx)

| Feature | Description |
|---------|-------------|
| **Built-in ACME** | Automatic TLS certs without certbot |
| **REST API** | JSON status/metrics at `/status/` endpoint |
| **HTTP/3** | Client + proxy connections, QUIC support |
| **Docker integration** | Dynamic upstreams from container labels |
| **Prometheus metrics** | Native `/metrics` export |
| **Console Light** | Browser-based monitoring panel |
| **Multi-expression location** | Multiple match patterns in one location block |
| **Session binding** | Sticky sessions to same upstream server |
| **Slow-start** | Gradual traffic increase after server recovery |

## File Layout

```
/etc/angie/
├── angie.conf              # Main config (http/events/stream blocks)
├── http.d/                 # Direct HTTP configs (included via include)
│   └── default.conf
├── sites-available/        # Available virtual hosts
├── sites-enabled/          # Active virtual hosts (symlinks or direct)
├── stream.d/               # TCP/UDP stream configs
├── ssl/                    # Custom SSL certs
├── mime.types
├── fastcgi_params
└── modules/
```

**Logs:** `/var/log/angie/access.log`, `/var/log/angie/error.log`
**PID:** `/run/angie.pid`
**ACME storage:** `/var/lib/angie/acme/`

## Main Config Reference

Our actual `/etc/angie/angie.conf` structure:
```nginx
user www-data;
worker_processes auto;
worker_rlimit_nofile 65535;
pid /run/angie.pid;

events {
    worker_connections 8192;
    multi_accept on;
    use epoll;
}

http {
    # Basic
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 4096;
    server_tokens off;
    client_max_body_size 100m;

    include /etc/angie/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" $request_time';
    access_log /var/log/angie/access.log main;
    error_log /var/log/angie/error.log warn;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 4;
    gzip_min_length 1000;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml text/javascript image/svg+xml;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=general:10m rate=30r/s;
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    # Proxy defaults
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 60;
    proxy_send_timeout 60;
    proxy_read_timeout 60;

    # WebSocket
    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    # Includes
    include /etc/angie/http.d/*.conf;
    include /etc/angie/sites-enabled/*.conf;
}
```

## Reverse Proxy Template

Standard template for new services:
```nginx
upstream myapp_backend {
    server 127.0.0.1:PORT;
    keepalive 32;
}

server {
    listen 80;
    server_name domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name domain.com;

    # SSL — use either certbot or ACME variables
    ssl_certificate /etc/letsencrypt/live/domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    access_log /var/log/angie/domain.com.access.log main;
    error_log /var/log/angie/domain.com.error.log;

    location / {
        proxy_pass http://myapp_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
```

## Built-in ACME (автоматические SSL-сертификаты)

Angie может получать и обновлять сертификаты Let's Encrypt без certbot.

### HTTP validation (самый простой)
```nginx
http {
    resolver 127.0.0.53;
    acme_client letsencrypt https://acme-v02.api.letsencrypt.org/directory;

    server {
        listen 80;
        listen 443 ssl;
        server_name example.com www.example.com;

        acme letsencrypt;
        ssl_certificate     $acme_cert_letsencrypt;
        ssl_certificate_key $acme_cert_key_letsencrypt;

        # ... rest of config
    }
}
```

Port 80 must be open for HTTP ACME validation.

### DNS validation (wildcard support)
```nginx
acme_client letsencrypt https://acme-v02.api.letsencrypt.org/directory
    challenge=dns;

server {
    server_name example.com *.example.com;
    acme letsencrypt;
    ssl_certificate     $acme_cert_letsencrypt;
    ssl_certificate_key $acme_cert_key_letsencrypt;
}
```

Requires DNS setup:
```
_acme-challenge.example.com. 60 IN NS ns.example.com.
ns.example.com. 60 IN A <server-ip>
```

### ALPN validation (port 443 only)
```nginx
acme_client letsencrypt https://acme-v02.api.letsencrypt.org/directory
    challenge=alpn;
```

### Validation methods comparison

| Method | Port | Wildcard | Setup complexity |
|--------|------|----------|-----------------|
| HTTP | 80 | No | Lowest — just open port 80 |
| DNS | 53 | Yes | Medium — need NS records |
| ALPN | 443 | No | Low — TLS port only |

### Migrate from Certbot to ACME

Before:
```nginx
ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
```

After:
```nginx
acme letsencrypt;
ssl_certificate     $acme_cert_letsencrypt;
ssl_certificate_key $acme_cert_key_letsencrypt;
```

Then: `angie -t && systemctl reload angie`

Certificate storage: `/var/lib/angie/acme/<client_name>/`

### ACME variables
- `$acme_cert_<name>` — certificate PEM
- `$acme_cert_key_<name>` — private key PEM

## REST API

Angie provides a built-in JSON API for monitoring.

### Enable API
```nginx
server {
    listen 127.0.0.1:8080;

    location /status/ {
        api /status/;
        allow 127.0.0.1;
        deny all;
    }
}
```

### Available endpoints

| Endpoint | Data |
|----------|------|
| `/status/angie` | Version, build, uptime, config files |
| `/status/connections` | Active, idle, accepted, dropped |
| `/status/http/server_zones/<zone>` | Requests, responses, data transfer |
| `/status/http/upstreams/<upstream>` | Peer states, health, response times |
| `/status/http/caches/<cache>` | Hit/miss/stale/expired stats |
| `/status/http/limit_conns/<zone>` | Connection limit stats |
| `/status/http/limit_reqs/<zone>` | Rate limit stats |
| `/status/http/acme_clients/<client>` | ACME certificate status |
| `/status/slabs/<zone>` | Memory allocation |
| `/status/resolvers/<zone>` | DNS resolver stats |

### Query from command line
```bash
curl -s http://127.0.0.1:8080/status/ | jq .
curl -s http://127.0.0.1:8080/status/connections | jq .
curl -s http://127.0.0.1:8080/status/http/server_zones/ | jq .
```

### Prometheus metrics
```nginx
location /metrics {
    prometheus all;
    allow 127.0.0.1;
    deny all;
}
```

Exposes metrics in Prometheus text format for scraping.

## HTTP/3 (QUIC)

Angie supports HTTP/3 for both client connections and proxy connections.

### Enable HTTP/3 for clients
```nginx
server {
    listen 443 ssl;
    listen 443 quic;  # HTTP/3

    http3 on;
    add_header Alt-Svc 'h3=":443"; ma=86400' always;

    ssl_protocols TLSv1.2 TLSv1.3;
    # ... rest of SSL config
}
```

### Proxy via HTTP/3
```nginx
location / {
    proxy_pass https://backend;
    proxy_http_version 3;
}
```

## Docker Integration (dynamic upstreams)

Angie can auto-discover Docker containers and add them as upstream servers.

```nginx
upstream docker_app {
    zone docker_app 256k;
    docker_endpoint unix:/var/run/docker.sock;
    # Angie auto-discovers containers with matching labels
}
```

No reload needed when containers scale up/down.

## Multi-expression Location

Unique Angie feature — combine multiple patterns in one location:
```nginx
location /api /graphql /webhook {
    proxy_pass http://app_backend;
}
```

Instead of Nginx's:
```nginx
location ~ ^/(api|graphql|webhook) {
    proxy_pass http://app_backend;
}
```

## Operations Checklist

### Add new site
1. Create config in `/etc/angie/sites-available/domain.conf`
2. Symlink: `ln -s /etc/angie/sites-available/domain.conf /etc/angie/sites-enabled/`
3. Test: `angie -t`
4. Reload: `systemctl reload angie`
5. SSL: either add `acme` directive or run `certbot certonly --webroot -w /var/www/html -d domain`
6. Verify: `curl -I https://domain`

### Remove site
1. Remove symlink: `rm /etc/angie/sites-enabled/domain.conf`
2. Test & reload: `angie -t && systemctl reload angie`
3. Optionally revoke cert: `certbot revoke --cert-name domain`

### Debug upstream errors
```bash
tail -f /var/log/angie/error.log | grep upstream
# Look for: connect() failed, upstream timed out, no live upstreams
```

Common fixes:
- `connect() failed (111: Connection refused)` → app not running on expected port
- `upstream timed out` → increase `proxy_read_timeout`
- `no live upstreams` → all backends are down

### Performance tuning
- `worker_processes auto` — matches CPU cores
- `worker_connections 8192` — high for busy servers
- `keepalive 32` in upstream — reuse connections to backend
- `gzip_comp_level 4` — balance between CPU and compression
- `proxy_buffering on` — buffer responses from slow backends
