# Structured logging

JSON in prod. Pretty console in dev. Never both, never unstructured.

## Why JSON

- **Searchable** — Grafana Loki, Elasticsearch, CloudWatch can index fields
- **Filterable** — `level = "error" AND user_id = "abc"` is one query
- **Aggregatable** — count errors by `error.type` in one query
- **Composable** — same record fits any downstream tool without parsing

Unstructured (`"User abc logged in from 1.2.3.4"`) requires regex to extract anything. Regex breaks when message wording changes. JSON doesn't.

## Mandatory fields

Every log entry, every service:

```json
{
  "timestamp": "2026-05-16T12:34:56.789Z",  // ISO 8601 with milliseconds, UTC
  "level": "info",                            // lowercase or uppercase, be consistent
  "msg": "user.logged_in",                    // short event name, dot-namespaced
  "service": "api-gateway",                   // which service emitted this
  "env": "production",                        // dev|staging|production
  "request_id": "req_abc123"                  // correlation; see correlation-tracing.md
}
```

## Field naming conventions

- **snake_case** for fields (most JSON aggregators handle this best)
- **dot notation** for event names: `user.logged_in`, `order.created`, `payment.charged`
- **Consistent units in field names**: `duration_ms` (not just `duration`), `size_bytes`, `temperature_celsius`
- **No spaces** in keys
- **Boolean fields named for the true case**: `is_admin: true`, not `admin_flag: 1`
- **Errors as object, not string**: `{ "error": { "type": "...", "message": "...", "stack": "..." } }`

## Recommended optional fields

| Field | When to add |
|---|---|
| `user_id` | Whenever a user is identified |
| `tenant_id` | Multi-tenant SaaS |
| `session_id` | When useful for tracing |
| `trace_id` / `span_id` | When OpenTelemetry is wired up |
| `duration_ms` | For any timed operation |
| `http.method` / `http.path` / `http.status` | Request/response logs |
| `error.type` / `error.message` / `error.stack` | Error logs |
| `git_sha` / `version` | Optional, useful for "which deploy was this on" |

## Schema discipline

Define a schema for common event types. Example:

```yaml
# events.yaml — internal documentation
user.logged_in:
  required: [timestamp, level, msg, service, env, request_id, user_id, ip]
  optional: [user_agent, session_id]
  level: info

payment.charged:
  required: [timestamp, level, msg, service, env, request_id, user_id, amount, currency, provider, transaction_id]
  optional: [card_brand_last4]
  level: info

http.request:
  required: [timestamp, level, msg, service, env, request_id, http.method, http.path]
  optional: [user_id, http.query]
  level: info

http.response:
  required: [timestamp, level, msg, service, env, request_id, http.method, http.path, http.status, duration_ms]
  level: info  # warn if duration > 500
```

This pays off when:
- Two services use same field names for same things
- Alerting rules can rely on consistent field shape
- New developer asks "what fields go in a payment log?" — point to doc

## Pretty vs JSON

Dev:
```
12:34:56.789 INFO  [api] user.logged_in user_id=abc123 ip=1.2.3.4
```

Prod:
```
{"timestamp":"2026-05-16T12:34:56.789Z","level":"info","msg":"user.logged_in","service":"api","env":"production","user_id":"abc123","request_id":"req_xyz","ip":"1.2.3.4"}
```

Switching is one config flag:

```ts
// Pino
const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,  // default JSON output
});
```

```py
# structlog
import structlog, sys
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt='iso'),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer() if not sys.stderr.isatty()
            else structlog.dev.ConsoleRenderer(),
    ]
)
```

## Error serialization

Errors should serialize to a consistent shape:

```json
{
  "level": "error",
  "msg": "order.create_failed",
  "error": {
    "type": "ValidationError",
    "message": "amount must be positive",
    "stack": "Error: amount must be positive\n  at validate (orders.ts:42:9)\n  at create (orders.ts:78:5)",
    "code": "VALIDATION_FAILED"
  }
}
```

### Pino default error serializer

Pino auto-extracts `type`, `message`, `stack`, `code` when you log `{ err: error }` (note: `err` not `error` as the key by default).

```ts
log.error({ err: e, msg: 'order.create_failed', orderId: id });
```

### Python: use structlog's exception processor

```python
import structlog

structlog.configure(
    processors=[
        structlog.processors.dict_tracebacks,  # extracts stack to dict
        # ... other processors
    ]
)

logger = structlog.get_logger()
try:
    process_order(...)
except Exception:
    logger.exception('order.create_failed', order_id=oid)  # auto-captures exc_info
```

## Avoiding common mistakes

### Don't log the same data both ways

❌
```ts
log.info('User abc logged in from 1.2.3.4', { user_id: 'abc', ip: '1.2.3.4' });
```

The string AND the fields. The string repeats — wasted space, easy to drift. Pick fields only:

✅
```ts
log.info({ msg: 'user.logged_in', user_id: 'abc', ip: '1.2.3.4' });
```

### Don't stringify objects you wanted as fields

❌
```ts
log.info({ msg: 'request', user: JSON.stringify(user) });
```

Now `user` is one big string field, unsearchable. Pass as object:

✅
```ts
log.info({ msg: 'request', user: { id: user.id, role: user.role } });
```

### Don't use `msg` for variable data

❌
```ts
log.info({ msg: `Charged ${amount} for user ${userId}` });
```

`msg` becomes high-cardinality string; can't filter by event type. Use fields:

✅
```ts
log.info({ msg: 'payment.charged', amount, user_id: userId });
```

### Consistency across services

If service A logs `user_id` and service B logs `userId`, your queries get harder. Agree on convention (recommend snake_case) and enforce in code review.

## Validating structured logs

Pipe your logs through `jq` to catch malformed entries:

```bash
tail -f app.log | jq -c '.' > /dev/null
# If jq errors, your JSON is broken somewhere
```

For pipeline-tests:

```bash
# Every line should be valid JSON
all_valid() {
  while IFS= read -r line; do
    echo "$line" | jq -e '.' > /dev/null || { echo "INVALID: $line"; return 1; }
  done < "$1"
}
all_valid app.log
```

## Migration from unstructured

If your project has `console.log('User logged in: ' + userId)` everywhere:

1. Install logger (Pino / structlog)
2. Configure at app entry — JSON in prod, pretty in dev, redaction on
3. Find/replace `console.log` → `logger.info`; `console.error` → `logger.error`
4. Convert string-concat messages to `{ msg: ..., field: ... }` form (iterate gradually)
5. Add middleware that injects `request_id` (see [correlation-tracing.md](correlation-tracing.md))
6. Verify in staging — `jq -c '.'` over a sample of logs should succeed

Don't try to do it all in one PR — it's mechanical but high-volume; break into chunks per module.
