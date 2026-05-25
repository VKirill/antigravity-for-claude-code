# Log aggregation — where logs go in production

Application emits to stdout. Stdout is captured by orchestrator (PM2 / systemd / Docker). Captured logs are shipped to an aggregator. Aggregator indexes for search.

## Recommended stack 2026

```
App stdout → PM2/systemd → Promtail (or Vector) → Grafana Loki → Grafana UI
                                                                ↓
                                                          (or CloudWatch / Datadog / ELK)
```

For Kirill's Ubuntu setup with PM2: PM2 writes logs to files; Promtail reads files; ships to Loki.

## PM2 setup

```bash
# Make sure logs are JSON (your Pino/structlog config emits JSON to stdout already)
pm2 start ecosystem.config.cjs

# Logs land here:
ls ~/.pm2/logs/
# api-out-0.log         (stdout)
# api-error-0.log       (stderr)

# Auto-rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7              # keep 7 rotations
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'   # daily at midnight
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
```

## Grafana Loki + Promtail

### Loki (storage)

```yaml
# docker-compose.yml
services:
  loki:
    image: grafana/loki:latest
    ports: ["3100:3100"]
    volumes:
      - ./loki-config.yml:/etc/loki/local-config.yaml
      - loki-data:/loki
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports: ["3001:3000"]
    volumes:
      - grafana-data:/var/lib/grafana
    restart: unless-stopped

volumes:
  loki-data:
  grafana-data:
```

```yaml
# loki-config.yml — minimal
auth_enabled: false
server:
  http_listen_port: 3100
common:
  ring:
    instance_addr: 127.0.0.1
    kvstore: {store: inmemory}
  replication_factor: 1
  path_prefix: /loki
schema_config:
  configs:
    - from: 2024-01-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index: {prefix: index_, period: 24h}
storage_config:
  filesystem:
    chunks_directory: /loki/chunks
limits_config:
  retention_period: 30d   # keep 30 days
compactor:
  retention_enabled: true
  delete_request_store: filesystem
```

### Promtail (shipper)

```yaml
# promtail-config.yml
server:
  http_listen_port: 9080
positions:
  filename: /tmp/positions.yaml
clients:
  - url: http://localhost:3100/loki/api/v1/push
scrape_configs:
  - job_name: pm2-logs
    static_configs:
      - targets: [localhost]
        labels:
          job: pm2
          host: ubuntu-prod
          __path__: /home/ubuntu/.pm2/logs/*.log
    pipeline_stages:
      - json:
          expressions:
            level: level
            service: service
            request_id: request_id
            msg: msg
      - labels:
          level:
          service:
      # Don't promote high-cardinality fields to labels (request_id, user_id) —
      # they explode index size. Keep them only in log body.
```

Run promtail:
```bash
promtail -config.file=promtail-config.yml &
```

### Grafana datasource

UI at `http://your-host:3001`. Login `admin/admin`, change password. Add datasource: Loki, URL `http://loki:3100`.

### Querying

LogQL examples:

```
# All errors in last hour
{job="pm2", level="error"}

# Errors in specific service
{job="pm2", service="api", level="error"}

# By request_id (extracted from JSON, not a label — uses log search)
{job="pm2"} | json | request_id="req_abc123"

# Rate of errors per service
sum by (service) (rate({job="pm2", level="error"}[5m]))

# Slow responses
{job="pm2"} | json | http_status >= 500 OR duration_ms > 1000
```

## Label discipline (Loki cost)

Loki cost = unique label combinations × ingestion volume. High-cardinality labels (request_id, user_id) explode cost.

Rules:
- **Labels:** bounded sets — service, level, env, host, region. ~10-50 unique combinations per label.
- **Log body fields (JSON):** unbounded — request_id, user_id, trace_id. Extracted on query, not indexed as label.

```yaml
# ✅ Good labels
job: pm2
service: api | api | api | ...  (small set)
level: info | warn | error | ...
host: ubuntu-prod | ubuntu-staging | ...

# ❌ Bad labels (explode cost)
request_id: req_abc123 | req_xyz456 | req_qpw789 | ...   (millions)
user_id: u_001 | u_002 | u_003 | ...                     (millions)
```

If you must filter by request_id frequently, query with `| json | request_id="..."` — slower but doesn't explode storage.

## Alternative aggregators

| Aggregator | Notes |
|---|---|
| **CloudWatch Logs** | AWS-native; pricey at scale; built-in Lambda |
| **Datadog Logs** | Strong correlation with metrics/traces; expensive |
| **Elastic (ELK)** | Full-text search great; ops heavy |
| **Splunk** | Enterprise; expensive |
| **Better Stack (Logtail)** | Cloud-hosted, simple, mid-tier pricing |
| **OpenObserve** | Self-hosted, modern, less mature |
| **VictoriaLogs** | Self-hosted, fast, simpler than ELK |

For Kirill: Loki (self-hosted) is the right default.

## journalctl path (if not PM2)

```bash
# Capture stdout from systemd unit
journalctl -u my-service.service -f                 # follow
journalctl -u my-service.service --since="1h ago"   # last hour
journalctl -u my-service.service -o json | jq '.MESSAGE | fromjson'   # parse JSON message
```

Promtail can scrape journald:

```yaml
scrape_configs:
  - job_name: systemd
    journal:
      max_age: 12h
      labels: {job: systemd}
    relabel_configs:
      - source_labels: ['__journal__systemd_unit']
        target_label: unit
```

## Docker container logs

```yaml
# docker-compose.yml — already configured for json-file driver by default
services:
  myapp:
    image: ...
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "5"
```

Promtail with docker discovery:

```yaml
scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 10s
```

## Retention + cost

| Retention | Use case |
|---|---|
| 7 days | Casual debugging; cheapest |
| 30 days | Standard for small apps |
| 90 days | Incident investigation across quarters |
| 1 year | Compliance / regulatory |
| 7 years | Specific compliance (financial, healthcare) |

Cost-vs-retention is a sliding scale. Default to 30 days; bump as needed by compliance.

For long retention: tier the storage — hot for last 7 days (fast queries), cold archive in S3 for older (slow queries, cheap storage). Loki supports this natively.

## Disk usage discipline

Log volume × retention = disk usage. Calculate:

```
50 MB/day × 30 days = 1.5 GB per service per month
× 10 services = 15 GB/month
× compression (Loki is ~10:1) ≈ 1.5 GB on disk
```

If you're emitting GB/day from one service → step back, your log volume is too high. Sample noisy events.

## Alerts via Loki + Grafana

```yaml
# Alert rule in Grafana
- alert: high_error_rate
  expr: sum by (service) (rate({job="pm2", level="error"}[5m])) > 1
  for: 5m
  annotations:
    summary: 'Service {{$labels.service}} > 1 err/s for 5 min'
```

Pipe to PagerDuty / Slack / Telegram via Grafana notification channels.

## Worked setup for Kirill's stack

Given:
- Ubuntu 24.04
- PM2 manages selfystudio-bot, selfystudio-worker, selfystudio-api, ai-pipeline, vechkasov-pro, etc.
- All logs already structured JSON (after applying this skill)

Steps:

1. Install Loki + Grafana via `docker-compose` on `127.0.0.1` (don't expose to public)
2. Install `pm2-logrotate` (already done in your CLAUDE.md memory)
3. Install Promtail; configure to read `/home/ubuntu/.pm2/logs/*.log`
4. Open Grafana on `127.0.0.1:3001`, route via Angie with basic-auth for remote access
5. Dashboard: errors-by-service panel, request-rate panel, p95-latency panel
6. Alerts: > 5 errors/min in any single service for 5 minutes → telegram bot

This replaces blind `tail -f ~/.pm2/logs/*.log` with searchable, alerting-aware logs.

## Don'ts

- ❌ Exposing Loki HTTP port publicly without auth
- ❌ Indexing high-cardinality fields as labels
- ❌ Retaining indefinitely (cost blow-up)
- ❌ Mixing logs from prod + staging in same Loki without `env` label
- ❌ Ignoring disk-full alerts for log volume
