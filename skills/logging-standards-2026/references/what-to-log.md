# What to log

The default rule: **log boundary events, not internals.** A log line should answer "what just happened that someone might need to debug, audit, or alert on?"

## Categories — log all of these

### 1. Auditable events (highest value)

Things that have legal / compliance / security implications. Always logged at INFO+ with user/tenant context.

| Event | Level | Required fields |
|---|---|---|
| login.success | INFO | user_id, ip, user_agent |
| login.failed | WARN | username (NOT password), ip, reason |
| password.changed | INFO | user_id, by_admin?, ip |
| 2fa.enabled / disabled | INFO | user_id, ip |
| account.created | INFO | user_id, source |
| account.deleted | INFO | user_id, by_admin?, reason |
| role.changed | INFO | user_id, from_role, to_role, by_user_id |
| payment.charged | INFO | user_id, amount, currency, provider, transaction_id |
| payment.refunded | INFO | original_tx_id, amount, refund_tx_id, reason |
| payment.failed | WARN | user_id, amount, currency, provider, error_code |
| admin.action | INFO | admin_user_id, target_resource, action, before_state, after_state |
| data.exported | INFO | user_id, resource, row_count, format |
| permission.denied | WARN | user_id, attempted_resource, required_role |

Why mandatory: incident-response, fraud-investigation, compliance audit.

### 2. Request boundaries

Every incoming HTTP request and its response. Auto-instrumented at middleware level; developer doesn't manually call.

```json
{ "level": "info", "msg": "http.request", "method": "POST", "path": "/api/orders", "request_id": "..." }
{ "level": "info", "msg": "http.response", "status": 200, "duration_ms": 47, "request_id": "..." }
```

For slow responses (>500ms or your SLO threshold): same line but with `level: "warn"`.

### 3. External API / service calls

Every outbound call to a third-party service.

```json
{ "level": "info", "msg": "external.call.started", "target": "cloudpayments", "operation": "charge", "request_id": "..." }
{ "level": "info", "msg": "external.call.completed", "target": "cloudpayments", "duration_ms": 230, "status_code": 200, "request_id": "..." }
```

Failures at WARN/ERROR. Critical for debugging "we waited 5 seconds, who's slow?".

### 4. Background jobs / queue workers

```json
{ "level": "info", "msg": "job.started", "job_id": "job_abc", "queue": "emails", "attempt": 1 }
{ "level": "info", "msg": "job.completed", "job_id": "job_abc", "duration_ms": 1230 }
{ "level": "error", "msg": "job.failed", "job_id": "job_abc", "attempt": 3, "error": {...} }
{ "level": "warn", "msg": "job.retry_scheduled", "job_id": "job_abc", "next_attempt_at": "...", "backoff_ms": 5000 }
```

### 5. Errors with full context

Always log at ERROR with stack + relevant context fields (user, request_id, params that triggered).

```json
{
  "level": "error",
  "msg": "order.create_failed",
  "error": {
    "type": "ValidationError",
    "message": "amount must be positive",
    "stack": "Error: ...\n  at create (orders.ts:42)\n  ..."
  },
  "user_id": "user_xyz",
  "request_id": "req_abc",
  "input": { "amount": -50 }     /* sanitized, no card numbers */
}
```

### 6. Slow operations (anything over SLO)

Database queries > 1s, external API calls > 2s, full request > 500ms, job > 30s. Threshold per-operation; log at WARN.

### 7. Configuration / startup

```json
{ "level": "info", "msg": "service.started", "version": "1.2.3", "git_sha": "...", "node": "24.x", "port": 3000 }
{ "level": "info", "msg": "config.loaded", "log_level": "info", "feature_flags": { "X": true } }
```

### 8. Graceful shutdown signals

```json
{ "level": "info", "msg": "service.shutdown.received_signal", "signal": "SIGTERM" }
{ "level": "info", "msg": "service.shutdown.draining_connections", "active_connections": 12 }
{ "level": "info", "msg": "service.shutdown.complete" }
```

### 9. Rate limit / abuse triggers

```json
{ "level": "warn", "msg": "rate_limit.exceeded", "user_id": "...", "endpoint": "/login", "count_in_window": 6, "window_seconds": 900 }
```

### 10. Security events (audit-worthy)

```json
{ "level": "warn", "msg": "auth.webhook.signature_invalid", "source": "cloudpayments", "expected_hash_prefix": "abc...", "received_hash_prefix": "xyz..." }
{ "level": "warn", "msg": "csrf.token_mismatch", "user_id": "...", "ip": "..." }
{ "level": "error", "msg": "ssrf.blocked", "target_url_redacted": "internal-host:8080", "user_id": "..." }
```

## What NOT to add to logs (signal/noise discipline)

| Anti-pattern | Why |
|---|---|
| Logging inside tight loops without sampling | Floods storage, slows hot path |
| Logging "function X called" with no context | Useless noise |
| Logging full payload of every request | Volume + secrets risk |
| Logging on cache hits (which are most calls) | High volume, low signal |
| `logger.info('here')` / `'reached point 2'` | Debug-only, never commit |
| Comments-as-logs: `logger.info('processing user data')` | Says nothing about WHAT processed; log structured events |

## The "would I look at this in an incident?" test

For every log statement you write, ask: **6 months from now, during an incident, would I want to see this line?**

- Yes → keep, structure it with searchable fields
- No → delete

## Cardinality discipline

Log field values should have **bounded cardinality** where possible. Examples:

| Field | Cardinality | OK? |
|---|---|---|
| `level` (info/warn/error/...) | 6 | ✅ |
| `method` (GET/POST/...) | ~10 | ✅ |
| `path` (route templates `/api/users/:id`) | ~50 | ✅ |
| `path` (raw URL with IDs `/api/users/12345`) | unbounded | ❌ — use route template |
| `status` | ~30 | ✅ |
| `user_id` | unbounded | OK if needed; expensive to index |
| `query_param.token` | unbounded + secret | ❌ never |

High-cardinality fields are fine in the LOG body, expensive when indexed for search. Plan accordingly with your aggregator.

## Worked example — adding logging to a new endpoint

Before:
```ts
app.post('/api/refunds', async (req, res) => {
  const refund = await processRefund(req.body);
  res.json(refund);
});
```

After (logging-standards-2026 applied):
```ts
app.post('/api/refunds', async (req, res) => {
  const log = logger.child({ request_id: req.requestId, user_id: req.user?.id });
  log.info({ msg: 'refund.requested', amount: req.body.amount, payment_id: req.body.payment_id });

  try {
    const refund = await processRefund(req.body);
    log.info({ msg: 'refund.completed', refund_id: refund.id, duration_ms: refund.duration });
    res.json(refund);
  } catch (err) {
    log.error({ msg: 'refund.failed', err, payment_id: req.body.payment_id });
    res.status(500).json({ error: 'refund_failed' });
  }
});
```

Notes:
- No `req.body` raw logged — only specific fields (amount, payment_id)
- Logger has `request_id` and `user_id` baked in via `child()` — no manual passing
- Three log events for one request: request → result (success or fail) — that's the boundary pattern
- Error path logs the error object; logger config auto-extracts stack
