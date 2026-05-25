# Python logging recipes — structlog or loguru

Two good choices in 2026:

- **structlog** — composable processors, no magic, integrates cleanly with stdlib `logging`. Recommended for FastAPI / Django.
- **loguru** — single import, ergonomic API, less composable. Good for scripts and small services.

Both wrap the stdlib `logging` module ultimately.

## structlog setup (recommended for web apps)

See [../templates/structlog-base-config.py.template](../templates/structlog-base-config.py.template) for the full template.

```python
# logger.py
import logging
import os
import sys
import structlog
import contextvars

# Correlation context
request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar('request_id', default='')
user_id_var: contextvars.ContextVar[str] = contextvars.ContextVar('user_id', default='')

def add_correlation(logger, method_name, event_dict):
    if rid := request_id_var.get():
        event_dict['request_id'] = rid
    if uid := user_id_var.get():
        event_dict['user_id'] = uid
    return event_dict

def add_service(logger, method_name, event_dict):
    event_dict['service'] = os.environ.get('SERVICE_NAME', 'unknown')
    event_dict['env'] = os.environ.get('APP_ENV', 'development')
    return event_dict

# Redaction
import re
SENSITIVE = re.compile(r'(password|token|api[_-]?key|secret|authorization|cookie|credit[_-]?card|cvv)', re.I)

def redact_sensitive(logger, method_name, event_dict):
    for key in list(event_dict.keys()):
        if SENSITIVE.search(key):
            event_dict[key] = '[REDACTED]'
    return event_dict

# Configure
is_dev = os.environ.get('APP_ENV', 'development') == 'development'

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        add_correlation,
        add_service,
        redact_sensitive,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt='iso', utc=True),
        structlog.processors.dict_tracebacks,  # for exception(...)
        structlog.dev.ConsoleRenderer() if is_dev else structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(os.environ.get('LOG_LEVEL', 'INFO').upper())
    ),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()
```

## FastAPI middleware

```python
# middleware.py
import uuid
from fastapi import FastAPI, Request
from .logger import logger, request_id_var, user_id_var

app = FastAPI()

@app.middleware('http')
async def correlation_middleware(request: Request, call_next):
    rid = request.headers.get('x-request-id') or str(uuid.uuid4())
    token = request_id_var.set(rid)
    log = logger.bind(http_method=request.method, http_path=request.url.path)
    log.info('http.request')
    try:
        response = await call_next(request)
        response.headers['x-request-id'] = rid
        log.info('http.response', http_status=response.status_code)
        return response
    finally:
        request_id_var.reset(token)
```

## Django LOGGING dict

```python
# settings.py
import os

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'json': {'()': 'pythonjsonlogger.jsonlogger.JsonFormatter',
                 'fmt': '%(asctime)s %(levelname)s %(name)s %(message)s'},
        'console': {'format': '%(asctime)s [%(levelname)s] %(name)s: %(message)s'},
    },
    'handlers': {
        'default': {
            'class': 'logging.StreamHandler',
            'formatter': 'json' if os.environ.get('APP_ENV') == 'production' else 'console',
        },
    },
    'root': {
        'handlers': ['default'],
        'level': os.environ.get('LOG_LEVEL', 'INFO'),
    },
    'loggers': {
        # Django's internal noise — quieten in prod
        'django.db.backends': {'level': 'INFO'},
        'django.security': {'level': 'INFO'},
        'urllib3': {'level': 'WARNING'},
        'asyncio': {'level': 'WARNING'},
    },
}
```

For structured logs in Django, add structlog on top (see structlog setup above + bind logger middleware).

## loguru setup (smaller projects)

```python
from loguru import logger
import sys, os

# Remove default handler
logger.remove()

# Configure
is_dev = os.environ.get('APP_ENV') == 'development'

if is_dev:
    logger.add(sys.stderr, level='DEBUG', colorize=True,
               format='<green>{time:HH:mm:ss}</green> <level>{level:<8}</level> {message}')
else:
    logger.add(sys.stderr, level='INFO', serialize=True)  # serialize=True → JSON

# Add request context via .bind()
@app.middleware('http')
async def add_context(request, call_next):
    rid = request.headers.get('x-request-id', str(uuid.uuid4()))
    with logger.contextualize(request_id=rid):
        return await call_next(request)
```

Loguru pro: single import, intuitive API. Loguru con: harder to plug custom processors / less standard.

## Exception logging

structlog:
```python
try:
    process_order(...)
except Exception:
    logger.exception('order.create_failed', order_id=oid)
    # `exception()` auto-captures traceback into event dict
```

loguru:
```python
try:
    process_order(...)
except Exception:
    logger.exception('order.create_failed order_id={}', oid)
```

stdlib:
```python
import logging
logger = logging.getLogger(__name__)

try:
    process_order(...)
except Exception:
    logger.exception('order.create_failed: order_id=%s', oid)
    # exception() includes exc_info=True automatically
```

## Quieting noisy libraries

Some libs spam INFO by default. Suppress in your config:

```python
import logging
logging.getLogger('urllib3').setLevel(logging.WARNING)
logging.getLogger('boto3').setLevel(logging.WARNING)
logging.getLogger('botocore').setLevel(logging.WARNING)
logging.getLogger('s3transfer').setLevel(logging.WARNING)
logging.getLogger('asyncio').setLevel(logging.WARNING)
logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
```

## Celery worker logging

```python
from celery.signals import after_setup_logger, task_prerun, task_postrun
from celery import shared_task
from .logger import logger, request_id_var

@task_prerun.connect
def task_prerun_handler(sender, task_id, task, args, kwargs, **rest):
    # Extract correlation from task kwargs
    rid = kwargs.get('_correlation', {}).get('request_id') or task_id
    request_id_var.set(rid)
    logger.info('task.started', task_name=task.name, task_id=task_id)

@task_postrun.connect
def task_postrun_handler(sender, task_id, task, args, kwargs, retval, state, **rest):
    logger.info('task.completed', task_name=task.name, task_id=task_id, state=state)
```

## Common Python pitfalls

| Pitfall | Fix |
|---|---|
| `print(...)` instead of logger | Replace all; lint with flake8-print |
| logger configured but uncalled (silent) | Verify config runs at import; test in REPL |
| logger.info('%s', expensive_call()) | Use `if logger.isEnabledFor(logging.INFO):` guard or pass callable in event_dict |
| Logging in tight async loop | Sample (`if i % 100 == 0`) or batch outside the loop |
| Default level too verbose | INFO in prod, not DEBUG |
| Mixing logging + print | All print → logger.info/debug |
| Loggers per-module not configured to propagate to root | Make sure `propagate = True` in dict config |

## Testing

```python
import pytest
from .logger import logger

def test_redaction(caplog):
    logger.info('test_event', password='secret123', user='john')
    assert 'secret123' not in caplog.text
    assert '[REDACTED]' in caplog.text
    assert 'john' in caplog.text  # non-sensitive preserved
```

(For structlog, use its `capture_logs` context manager.)
