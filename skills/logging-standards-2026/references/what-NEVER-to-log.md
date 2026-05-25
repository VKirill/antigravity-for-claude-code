# What NEVER to log

A leaked log is a leaked secret. Logs travel further than you think — aggregators, replicas, backups, support tickets, AI training datasets. The "I'll redact it later" approach has never worked once.

## The forbidden list

### Authentication / credentials

- ❌ Password (plaintext OR hashed — even the hash gives offline brute-force surface)
- ❌ Password-reset tokens, magic-link tokens, OTP codes
- ❌ JWT (the entire token)
- ❌ Session cookies / session IDs (with rare logged-with-context exceptions; usually no)
- ❌ API keys (`sk-...`, `AIza...`, `AKIA...`, `ghp_...`)
- ❌ OAuth client secrets
- ❌ Authorization header value (`Bearer ...`)
- ❌ Webhook signature secrets

### Personally identifiable information (PII)

Default-deny unless required for auditable event and consciously logged with consent:

- ❌ Full names alongside other identifiers (combination amplifies privacy harm)
- ❌ Email addresses (unless it's specifically the audit subject AND user has consent)
- ❌ Phone numbers
- ❌ Home / billing addresses
- ❌ Birth dates
- ❌ Government ID numbers (SSN, passport, СНИЛС, ИНН)
- ❌ Driver's license numbers
- ❌ Geolocation more precise than city/region

### Financial data

- ❌ Credit card PAN (Primary Account Number) — explicitly PCI-DSS forbidden
- ❌ CVV (you should never even receive this server-side)
- ❌ Full bank account numbers
- ❌ Card expiry

### Request internals (default-deny)

- ❌ Raw `req.body` — log specific allowed fields by name, never the whole object
- ❌ Raw `req.headers` — log specific allowed headers (User-Agent, accepted languages); never the whole thing
- ❌ Cookies dict
- ❌ Query strings that contain tokens (`?token=...`, `?session=...`)
- ❌ Full URL when it contains tokens in path/query

### Medical / health (HIPAA-adjacent)

If you handle health data: presumed deny on diagnosis, condition, prescription, provider names.

### Children's data

Under-13 user data is special-protected (COPPA, GDPR-K). Default-deny on logging.

## Redaction patterns

### Pino redact config (Node)

```ts
const logger = pino({
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.token',
      'req.body.creditCard',
      '*.password',
      '*.token',
      '*.apiKey',
      '*.api_key',
      '*.secret',
      'authorization',
      'cookie',
    ],
    censor: '[REDACTED]',
  },
});
```

### structlog redact processor (Python)

```python
import structlog
import re

SENSITIVE = re.compile(
    r'(password|token|api[_-]?key|secret|authorization|cookie|credit[_-]?card|cvv)',
    re.IGNORECASE
)

def redact_sensitive(logger, method_name, event_dict):
    for key in list(event_dict.keys()):
        if SENSITIVE.search(key):
            event_dict[key] = '[REDACTED]'
    return event_dict

structlog.configure(
    processors=[
        redact_sensitive,
        # ... other processors
        structlog.processors.JSONRenderer(),
    ]
)
```

### Value-pattern redaction (defence in depth)

Even with key-based redaction, secrets sometimes appear in values (e.g., included in a stack trace, error message). Regex-based value redaction:

```python
PATTERNS = [
    (re.compile(r'AKIA[0-9A-Z]{16}'), '[AWS_KEY]'),
    (re.compile(r'sk-[a-zA-Z0-9-_]{20,}'), '[OPENAI/STRIPE_KEY]'),
    (re.compile(r'sk-ant-[a-zA-Z0-9-_]{20,}'), '[ANTHROPIC_KEY]'),
    (re.compile(r'AIza[0-9A-Za-z\-_]{35}'), '[GOOGLE_KEY]'),
    (re.compile(r'ghp_[a-zA-Z0-9]{36}'), '[GITHUB_PAT]'),
    (re.compile(r'xox[baprs]-[a-zA-Z0-9-]+'), '[SLACK_TOKEN]'),
    (re.compile(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+'), '[JWT]'),
    (re.compile(r'\b\d{13,19}\b'), '[POSSIBLE_CARD]'),  # crude, false-positive on UUIDs maybe; tune
    (re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}'), '[EMAIL]'),
]

def value_redact(text: str) -> str:
    for pat, repl in PATTERNS:
        text = pat.sub(repl, text)
    return text
```

Run on `event_dict` values before serialization.

## Audit existing logs

If your project already has logging, scan for leaks:

```bash
# Find suspicious logging calls
grep -rnE "logger\.|console\.|print\(|log\." src/ -A1 | \
  grep -iE "password|token|jwt|secret|api[_-]?key|credit[_-]?card|cvv|authorization|cookie|req\.body[^.]"

# Find specific patterns leaking into logs
grep -rnE "logger\.info\(.+req\.body\)|console\.log\(.+req\.body\)" src/
grep -rnE "logger.+req\.headers" src/ | grep -v "req\.headers\.\['user-agent'\]"

# Find process.env or os.environ in log calls
grep -rnE "log.+process\.env" src/ --include='*.ts' --include='*.js'
grep -rnE "log.+os\.environ" src/ --include='*.py'
```

Anything that hits → review + redact + add to test that asserts it's not in output.

## Anti-patterns

### "I'll redact it later"

You won't. Log lines spread to backups, replicas, support tickets, AI training corpora. Once it's emitted, assume it's out forever.

### Custom one-off redaction per call site

```ts
// ❌
logger.info({ user: { id: u.id, password: '***' } });  // brittle; new field next time → leak
```

Configure redaction once, at the logger setup. Centralized.

### Logging "for debugging" temporarily

```ts
// ❌
if (env === 'staging') logger.info({ body: req.body });  // staging has prod data via replica → leak
```

Don't gate redaction on env. Redact in all envs at the logger.

### Trusting the framework

Some frameworks have request loggers that helpfully log the full body / headers / cookies by default. Audit your specific framework's logger config — they don't all default to safe.

| Framework / lib | Default body logging? |
|---|---|
| Express morgan | Defaults log path/status; can be configured to log body — usually off |
| Fastify | Pino default — doesn't log body; check serializers |
| Django LOGGING dict | depends on what user added; audit |
| FastAPI uvicorn | logs request line only by default; uvicorn `access_log` |
| Next.js | Server logs request entry; no body by default |
| Pino HTTP serializer | logs req/res — be careful, default serializer can include unredacted fields |

### Logging the diff after a fix

```ts
// ❌ Found a bug where password was logged; "fixed":
logger.info({ user: { ...u, password: undefined } });
```

`undefined` still serializes in some loggers; safer to never include it in the first place. Use allowlist of fields, not denylist.

## The error-path leak

Most leaks happen in error paths because developers add `logger.error(err)` and the error contains the leaky input.

```ts
// ❌
try { processOrder(req.body); } catch (e) { logger.error(e); }
// e.message may include req.body fields verbatim
```

Fix: serializer for `Error` that strips known-sensitive substrings + a value-pattern redactor (above).

## Verification

Add a test that runs your logger against known-bad inputs and asserts the output is clean:

```ts
test('logger redacts password', () => {
  const out = captureLog(() =>
    logger.info({ user: { id: 1, password: 'shh' } })
  );
  expect(out).not.toContain('shh');
  expect(out).toContain('[REDACTED]');
});

test('logger redacts authorization header', () => {
  const out = captureLog(() =>
    logger.info({ req: { headers: { authorization: 'Bearer secret' } } })
  );
  expect(out).not.toContain('Bearer secret');
});
```

If these tests fail in PR → fail the build. This is your safety net.

## Final rule

**If the field could become evidence in a breach disclosure — don't log it.** When unsure: don't log, ask, log later if necessary.
