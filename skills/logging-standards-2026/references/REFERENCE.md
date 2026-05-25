# References index — logging-standards-2026

## Decision tree

```
User asks about logging
│
├─ Starting fresh: "set up logging for this project"
│   → 1) structured-logging.md  2) correlation-tracing.md  3) stack-recipes-{node|python|frontend}.md  4) error-tracking.md
│
├─ "What should I log?" / "what's important?"
│   → what-to-log.md
│
├─ "I'm logging req.body — is that OK?" / "where's the line?"
│   → what-NEVER-to-log.md
│
├─ "Should this be INFO or DEBUG?"
│   → log-levels.md
│
├─ "How do I trace a request across services?"
│   → correlation-tracing.md
│
├─ "Logs cost too much / app is slow because of logging"
│   → performance-and-cost.md
│
├─ "Where do logs go after the app emits them?"
│   → log-aggregation.md
│
└─ "How do I track errors in production?"
    → error-tracking.md
```

## Quick map

| Task | Open |
|---|---|
| Add Pino to Node service | [stack-recipes-node.md](stack-recipes-node.md) + [../templates/pino-base-config.ts.template](../templates/pino-base-config.ts.template) |
| Add structlog to FastAPI / Django | [stack-recipes-python.md](stack-recipes-python.md) + [../templates/structlog-base-config.py.template](../templates/structlog-base-config.py.template) |
| Remove console.log from React/Next prod | [stack-recipes-frontend.md](stack-recipes-frontend.md) |
| Wire up Sentry | [error-tracking.md](error-tracking.md) + [../templates/sentry-init.template](../templates/sentry-init.template) |
| Propagate request_id | [correlation-tracing.md](correlation-tracing.md) |
| Decide log level for new code path | [log-levels.md](log-levels.md) |
| Redact secrets in logs | [what-NEVER-to-log.md](what-NEVER-to-log.md) |
| Audit existing logs for bad patterns | [what-NEVER-to-log.md](what-NEVER-to-log.md) + grep commands |
| Set up Grafana Loki | [log-aggregation.md](log-aggregation.md) |

## Universal mandatory fields

Every log entry, every stack, every environment:

```json
{
  "timestamp": "2026-05-16T12:34:56.789Z",
  "level": "info",
  "msg": "user.logged_in",
  "service": "api-gateway",
  "env": "production",
  "request_id": "req_abc123",
  "user_id": "user_xyz789",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736"
}
```

Optional but recommended: `tenant_id`, `session_id`, `span_id`, `duration_ms`, `error.type`, `error.stack`.
