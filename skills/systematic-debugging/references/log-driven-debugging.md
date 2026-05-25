# Log-driven debugging — when you can't attach a debugger

Production, async pipelines, distributed systems. You read the logs of past failures.

## Prerequisites

You need structured logs with enough fields. If your project doesn't have this — see `logging-standards-2026` skill to add it. Minimum required fields for debugging:

- `timestamp` (ISO 8601 with milliseconds)
- `level` (ERROR/WARN/INFO/DEBUG)
- `msg` (short, what happened)
- `service` (which microservice / process)
- `request_id` or `trace_id` (correlation across services)
- `user_id` (if applicable, for filtering)
- `error.stack` (for ERROR level)

Without these, logs are noise. Stop and improve logging first.

## The correlation-ID hunt

Bug reported by user. You have:
- User's email or ID
- Approximate time of incident

Goal: find the request → all logs in that request's chain → spot the failure.

```bash
# Step 1: find the request by user + time (assume JSON logs in /var/log/app/)
jq 'select(.user_id == "abc123" and .timestamp >= "2026-05-16T12:00:00Z" and .timestamp <= "2026-05-16T12:05:00Z") | .request_id' /var/log/app/*.json | sort -u

# Step 2: pull ALL logs for that request_id (across services)
jq 'select(.request_id == "req_xyz789")' /var/log/**/*.json | sort -t'"' -k4
```

Or in Grafana Loki:
```
{service=~".+"} | json | request_id="req_xyz789"
```

## The missing-event pattern

Scenario: payment was created but invoice was never sent.

Strategy: list what SHOULD happen in chronological order. Then find which event is missing.

| Expected event | Found in logs? | Time |
|---|---|---|
| `payment.created` | ✅ | 12:00:01 |
| `payment.charged` | ✅ | 12:00:03 |
| `invoice.generation_queued` | ✅ | 12:00:04 |
| `invoice.generated` | ❌ | — |
| `invoice.email_sent` | ❌ | — |

Investigation focuses on what's between `queued` and `generated` — likely a worker / queue issue. Look at logs of the invoice worker around 12:00:04:

```bash
jq 'select(.service == "invoice-worker" and .timestamp >= "2026-05-16T12:00:00Z" and .timestamp <= "2026-05-16T12:10:00Z")' /var/log/invoice-worker/*.json
```

Often reveals: worker errored, retried, hit max-retries, sent to DLQ — and that's why no `invoice.generated`.

## The "first time" pattern

When did this bug FIRST appear in logs? Bisect by time.

```bash
# Search logs for a specific error
grep -h "specific error message" /var/log/app/*.json | jq -r '.timestamp' | sort | head -5
```

Find the earliest. That timestamp = bug introduction time. Cross-reference with:
- Deploy timestamp (`/var/log/deploy.log`)
- Git commits merged that day (`git log --since="2026-05-15" --until="2026-05-16"`)
- Feature flag flips (audit log of flag changes)

Now you have a candidate commit / deploy / flag → see [bisection.md](bisection.md).

## Frequency / pattern analysis

How often does the bug happen?

```bash
# Errors per minute
jq -r 'select(.level == "ERROR") | .timestamp | sub(":[0-9]+Z$"; "Z")' /var/log/app/*.json | \
  sort | uniq -c | sort -rn | head -20

# Errors by user
jq -r 'select(.level == "ERROR") | .user_id' /var/log/app/*.json | \
  sort | uniq -c | sort -rn | head -20

# Errors by endpoint
jq -r 'select(.level == "ERROR") | .path' /var/log/app/*.json | \
  sort | uniq -c | sort -rn | head -20
```

Pattern reveals diagnosis:
- Errors spike at the top of the hour → cron job
- Errors only for one user → data-specific bug (their record has bad state)
- Errors only on one endpoint → that endpoint has the bug
- Errors evenly distributed → systemic (config / network / capacity)

## Distributed tracing

For microservices, span-level tracing (OpenTelemetry / Jaeger / Tempo) shows the call graph + timings.

```
[gateway 1ms] → [auth 5ms] → [orders-svc 200ms] → [payments-svc 2300ms ❌ TIMEOUT]
```

You can see exactly where the chain breaks. Especially valuable when:
- The error is reported by service A, but the cause is in service B downstream
- Latency budget blown by one slow span
- Retries cascade across services

If your project doesn't have tracing — adding OpenTelemetry takes ~1 hour and saves dozens later. See `logging-standards-2026` skill, `references/correlation-tracing.md`.

## Patterns: what specific log lines tell you

| Log signal | Likely cause |
|---|---|
| Many `Connection refused` to DB | DB down or restart; check DB logs at same time |
| `ECONNRESET` from external API | They restarted / killed connections; usually transient |
| `JavaScript heap out of memory` | Memory leak; capture heapdump next time |
| `ETIMEDOUT` clustered | Network slow or downstream slow; check tracing |
| `EMFILE: too many open files` | File descriptor leak; check `ulimit -n`; close streams |
| `UnhandledPromiseRejection` | Missed `.catch()`; promise rejection without handler |
| `Process exited with signal SIGTERM` then restart | OOM-killed (check dmesg) or PM2/orchestrator killed |
| `429 Too Many Requests` | Rate-limited by external API; backoff strategy missing |
| Stack trace ending in node_modules/<lib>/... | Library bug OR you're using the lib wrong; verify usage |

## Logs not enough — increase observability

If your logs are insufficient for diagnosis:

1. **Add structured fields** — every log line gets `service`, `request_id`, `user_id` if applicable
2. **Add boundary logs** — entry/exit of every major function in the suspected path, with input + output (redacted)
3. **Add timing logs** — `started job X` ... `completed job X (duration=1234ms)`
4. **Deploy + wait + read** — bug will recur, this time with more context
5. **Use feature-flagged verbose logging** — turn up to TRACE for one suspected user/tenant, leave others alone, for a window

Don't `console.log` everything — see `logging-standards-2026` for what to log responsibly.

## Reading slow-query / N+1 logs

Postgres `auto_explain` extension logs slow queries with plans. Read:

```
duration: 5234.123 ms  plan:
Seq Scan on orders  (cost=0.00..10000.00 rows=100000 width=...)
  Filter: (user_id = 42)
```

`Seq Scan` on a column you expected indexed → missing index, or query doesn't use it (cast / function on column / type mismatch).

For N+1: count similar queries by structure. If you see 1000 `SELECT * FROM orders WHERE id = $1` in 1 second → you're calling `findById` in a loop instead of a batch `findMany`.

```bash
# Group queries by their structure, count
psql -c "SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY calls DESC LIMIT 10;"
```

## Worked example

> User reports: "Refund didn't arrive on my card."

```bash
# 1. Find their refund attempt
jq 'select(.user_id == "user_8a93" and .msg | test("refund"))' /var/log/payments/*.json
# Returns: { msg: "refund.requested", request_id: "req_R5X9", amount: 250000, ... }

# 2. Trace request
jq 'select(.request_id == "req_R5X9")' /var/log/**/*.json | jq -s 'sort_by(.timestamp)'
# Returns chronological:
#   refund.requested
#   refund.validated
#   cloudpayments.api.call started
#   cloudpayments.api.call returned 200 {status: "ok"}
#   refund.recorded_local
#   <missing: cloudpayments.webhook.refund_completed>
#   refund.timeout_pending after 24h

# Hypothesis: webhook never arrived from CloudPayments OR webhook arrived but signature failed
jq 'select(.service == "webhook-handler" and .timestamp >= "2026-05-14")' /var/log/webhook/*.json | grep -i refund
# Find: { msg: "webhook.signature_invalid", path: "/api/cloudpayments/refund", body_hash: "..." }

# Root cause: signature validation rejected the webhook
# Investigation: CloudPayments sends signature in header "Content-HMAC", we look for "X-Signature"
# Fix at root: normalize header lookup; add regression test with both header names
```

This is the canonical log-driven flow: filter by user → trace by request_id → find missing/anomalous event → form hypothesis → confirm in logs → fix root.
