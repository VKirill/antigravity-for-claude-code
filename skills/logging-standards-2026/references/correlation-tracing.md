# Correlation tracing — request_id, AsyncLocalStorage, OpenTelemetry

A single user request triggers dozens of log lines across handlers, services, queries, external calls. Without a correlation ID, debugging a single user's issue means grep-ing time windows and guessing.

## The minimum: request_id

Every incoming request gets a UUID (or ULID). Every log line emitted while handling that request includes the ID. To query an entire request's chain:

```
grep '"request_id":"req_abc123"' logs/*.json | jq -s 'sort_by(.timestamp)'
```

Or in Grafana Loki:
```
{service=~".+"} | json | request_id="req_abc123"
```

## Node.js: AsyncLocalStorage

The right way. Set the ID once at middleware level, all downstream logs (even async) read it from "thread-local" storage.

```ts
// context.ts
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

type RequestContext = { request_id: string; user_id?: string };
export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.request_id;
}
export function getUserId(): string | undefined {
  return requestContext.getStore()?.user_id;
}

// middleware.ts (Express / Fastify / Hono — adapt)
export function correlationMiddleware(req, res, next) {
  const request_id = req.headers['x-request-id'] ?? randomUUID();
  res.setHeader('x-request-id', request_id);
  requestContext.run({ request_id }, () => next());
}
```

```ts
// logger.ts
import pino from 'pino';
import { requestContext } from './context.js';

export const logger = pino({
  mixin() {
    const ctx = requestContext.getStore();
    return ctx ? { request_id: ctx.request_id, user_id: ctx.user_id } : {};
  },
});
```

Now anywhere in code:
```ts
logger.info({ msg: 'order.created', order_id: id });
// Output includes request_id automatically:
// {"timestamp":"...","level":"info","msg":"order.created","order_id":"...","request_id":"req_abc"}
```

No more passing `requestId` through function signatures.

## Python: contextvars

Equivalent pattern:

```python
# context.py
import contextvars, uuid

request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar('request_id', default='')
user_id_var: contextvars.ContextVar[str] = contextvars.ContextVar('user_id', default='')

def get_request_id() -> str:
    return request_id_var.get()

# FastAPI middleware
from fastapi import Request

@app.middleware('http')
async def correlation_middleware(request: Request, call_next):
    rid = request.headers.get('x-request-id') or str(uuid.uuid4())
    token = request_id_var.set(rid)
    try:
        response = await call_next(request)
        response.headers['x-request-id'] = rid
        return response
    finally:
        request_id_var.reset(token)
```

```python
# logger.py — structlog
import structlog
from .context import request_id_var, user_id_var

def add_correlation(logger, method_name, event_dict):
    if rid := request_id_var.get():
        event_dict['request_id'] = rid
    if uid := user_id_var.get():
        event_dict['user_id'] = uid
    return event_dict

structlog.configure(
    processors=[
        add_correlation,
        # ... other processors
        structlog.processors.JSONRenderer(),
    ]
)
```

## Cross-service: propagate the header

When service A calls service B, pass `x-request-id`:

```ts
// In service A, when calling service B:
await fetch('https://service-b/api/...', {
  headers: {
    'x-request-id': getRequestId() ?? '',     // forward our request ID
    'authorization': '...',
  },
});
```

Service B's middleware reads `x-request-id` from incoming headers (already shown above), reuses it. Now both services' logs share the ID → traceable across boundaries.

Always also: respond with the request_id in the response header so the client knows what to put in a support ticket.

## OpenTelemetry: trace_id + span_id

OpenTelemetry is the standard. Adds two more IDs:

- `trace_id` — 128-bit hex; unique per top-level request (replaces / complements `request_id`)
- `span_id` — 64-bit hex; unique per operation within a trace

A trace contains a tree of spans:

```
trace_id: 4bf92f3577b34da6a3ce929d0e0e4736
├─ span_id: 00f067aa0ba902b7    span.name: POST /api/orders          (gateway)
│  ├─ span_id: 00f067aa0ba90201  span.name: db.insert                 (orders-svc)
│  ├─ span_id: 00f067aa0ba90202  span.name: external.cloudpayments    (orders-svc)
│  └─ span_id: 00f067aa0ba90203  span.name: queue.publish.invoice     (orders-svc)
```

Each span = one log line at start and end. Logs include `trace_id` + `span_id` → in Grafana/Tempo you can click a span and see all its logs.

### Wiring up (Node)

```ts
import { trace, context } from '@opentelemetry/api';

// In logger mixin:
mixin() {
  const span = trace.getActiveSpan();
  const ctx = requestContext.getStore();
  return {
    request_id: ctx?.request_id,
    user_id: ctx?.user_id,
    trace_id: span?.spanContext().traceId,
    span_id: span?.spanContext().spanId,
  };
}
```

### Wiring up (Python)

```python
from opentelemetry import trace

def add_trace_context(logger, method_name, event_dict):
    span = trace.get_current_span()
    if span and span.get_span_context().is_valid:
        ctx = span.get_span_context()
        event_dict['trace_id'] = format(ctx.trace_id, '032x')
        event_dict['span_id'] = format(ctx.span_id, '016x')
    return event_dict
```

### When OpenTelemetry is worth the effort

- You have >1 service (the value scales with service count)
- You need to answer "where is time being spent in this request" without code changes
- You want to correlate metrics + logs + traces in one tool (Tempo/Jaeger + Loki + Prometheus = "Grafana stack")

For single-service apps: `request_id` alone is fine; OpenTelemetry is over-engineering.

## Queue jobs: propagate context

When pushing a job to a queue, capture the originating request_id in the job payload:

```ts
await queue.add('send-email', {
  to: 'user@example.com',
  template: 'welcome',
  _correlation: { request_id: getRequestId(), trace_id: getTraceId() }
});

// Worker:
async function processJob(job) {
  return requestContext.run({ request_id: job.data._correlation.request_id }, async () => {
    logger.info({ msg: 'job.started', job_id: job.id });
    await sendEmail(job.data);
  });
}
```

Now the email-send logs share request_id with the original API call → full trace from request to email.

## Worked example

User reports "I clicked Save and nothing happened, here's the timestamp".

```
# Step 1: find request_id in nginx / access log near that timestamp
grep "2026-05-16T12:34" /var/log/nginx/access.log | grep "user@example.com" 
# → finds request with x-request-id: req_5x7q9

# Step 2: pull all logs for that request_id across services
{service=~".+"} | json | request_id="req_5x7q9" | sort by timestamp

# Output:
# gateway:  http.request  POST /api/profile
# auth-svc: auth.verified user_id=u_abc
# profile-svc: profile.update.started
# profile-svc: db.query  duration_ms=12
# profile-svc: external.call.started  target=avatar-service
# avatar-service: image.processing
# avatar-service: ERROR  image.upload_failed  s3 returned 403
# profile-svc: ERROR  profile.update.failed  reason="avatar-upload"
# gateway:  http.response  status=500  duration_ms=2340
```

Root cause: visible in 10 seconds. Without correlation IDs: 30 minutes of grep-by-timestamp guessing.

## Anti-patterns

| Pattern | Why bad |
|---|---|
| Pass `requestId` as function param everywhere | Pollutes every signature; misses async boundaries |
| Generate new request_id per log call | Defeats correlation entirely |
| Use timestamp as correlation | Two concurrent requests overlap |
| Use user_id as correlation | One user makes many requests; can't separate |
| Skip propagation across services | Logs in service B are orphaned; bug ends at boundary |
| Log request_id to stdout but not include in structured fields | Hard to query; index the field |

## Quick checklist

- [ ] Middleware sets request_id on incoming request
- [ ] AsyncLocalStorage / contextvars wires it into all async code
- [ ] Logger auto-injects request_id into every log (mixin / processor)
- [ ] Outgoing HTTP calls forward `x-request-id` header
- [ ] Outgoing queue jobs include `_correlation.request_id`
- [ ] Response includes `x-request-id` header (for user support)
- [ ] Documented in onboarding: "to debug user X's issue, get request_id and query Loki"
