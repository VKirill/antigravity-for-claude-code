# httpx — Migrating from `requests`

httpx aims to be "broadly requests-compatible" — the basic shape carries over. But several defaults and APIs differ, and a few have changed in ways that silently change behavior.

## Cheatsheet

| `requests` | `httpx` | Notes |
|---|---|---|
| `requests.Session()` | `httpx.Client()` | Context-manage the client |
| `session.get(url)` | `client.get(url)` | Same shape |
| `requests.get(url)` | `httpx.get(url)` | Both top-level helpers exist |
| `allow_redirects=True` (default) | `follow_redirects=False` (default) | **Default flipped** — opt in per-call or per-client |
| `json=`, `data=`, `files=`, `params=`, `headers=` | Same | Identical surface |
| `timeout=5` | `timeout=5` | Same shape; httpx has stricter per-phase support via `httpx.Timeout(...)` |
| `proxies={"http": ..., "https": ...}` | `proxy="..."` or `mounts={...}` | `proxies=` kwarg does NOT exist |
| `verify=True/False/path` | `verify=True/False/path/SSLContext` | httpx also accepts an `ssl.SSLContext` |
| `cert="..."` | `cert="..."` | Same |
| `auth=("user", "pass")` | `auth=("user", "pass")` | Same |
| `requests.auth.HTTPBasicAuth` | `httpx.BasicAuth` | Renamed |
| `requests.auth.HTTPDigestAuth` | `httpx.DigestAuth` | Renamed |
| `response.url` | `httpx.URL` object | Was `str` in requests; call `str(response.url)` |
| `response.next` | `response.next_request` | Renamed; type is `httpx.Request` |
| `response.ok` | `response.is_success` | Renamed |
| `response.raise_for_status()` | Same | Same shape; raises `httpx.HTTPStatusError` |
| `requests.exceptions.ConnectionError` | `httpx.ConnectError` | Renamed (and narrower) |
| `requests.exceptions.Timeout` | `httpx.TimeoutException` | Includes connect/read/write/pool sub-exceptions |
| `requests.exceptions.HTTPError` | `httpx.HTTPStatusError` | Renamed |
| `requests.exceptions.RequestException` | `httpx.RequestError` | Renamed |
| `requests.adapters.HTTPAdapter(max_retries=N)` | `httpx.HTTPTransport(retries=N)` | **Connect retry only — see below** |

## Default behavior changes that bite

### Redirects are NOT followed by default

```python
# requests — follows redirects by default
r = requests.get("https://example.com")
# r.status_code is the FINAL status after following 3xx

# httpx — does NOT follow redirects by default
r = httpx.get("https://example.com")
# r.status_code may be 301/302/307 — you get the redirect response

# Enable explicitly:
r = httpx.get("https://example.com", follow_redirects=True)
# Or on the client:
with httpx.Client(follow_redirects=True) as client: ...
```

This is the single biggest silent behavior change. Audit every ported request to decide whether following redirects is expected.

### Stricter timeouts by default

httpx ships with a non-zero default timeout on every request. `requests` defaults to no timeout. If you rely on indefinite hangs (rare and a bad idea), pass `timeout=None`. Otherwise the existing httpx default is safer — see `recommended-defaults.md`.

### `response.url` is no longer a string

```python
# requests
str_url = response.url            # str

# httpx
url_obj = response.url            # httpx.URL
str_url = str(response.url)       # explicit conversion
path    = response.url.path
```

If any code does `response.url.endswith(...)`, it breaks until wrapped in `str(...)`.

### No prepared requests

`requests` has `PreparedRequest`. httpx replaces it with `client.build_request(...)` returning an `httpx.Request` you can mutate then `client.send(request)`. The shape is similar but the names differ.

### Event hooks cannot mutate

In `requests`, hooks could replace the response. In httpx, hooks observe only. Move mutation into custom transports or auth classes.

### Proxies kwarg renamed

```python
# requests
requests.get(url, proxies={"http": "http://p:8030", "https": "http://p:8030"})

# httpx
httpx.get(url, proxy="http://p:8030")
# or per-scheme via mounts on a Client
```

`proxies=` is NOT a kwarg — it raises a TypeError if used.

### No built-in retry

```python
# requests, with urllib3 Retry
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
session.mount("https://", HTTPAdapter(max_retries=Retry(total=3, backoff_factor=0.5)))

# httpx — only connect-error retry built in
transport = httpx.HTTPTransport(retries=2)
client = httpx.Client(transport=transport)
# For 5xx / read-timeout retry: layer tenacity or stamina
```

See `retries-and-resilience.md`.

### Charset / encoding

httpx uses UTF-8 for outbound request bodies (vs Latin-1 in requests) and uses charset detection for inbound. If you rely on a specific encoding, set `response.encoding` before reading `.text`.

### File uploads must be binary mode

```python
# Bad — encoding bugs
files = {"f": open("data.csv", "r")}    # ❌

# Good
files = {"f": open("data.csv", "rb")}   # ✅
```

`requests` was permissive about text-mode files. httpx is strict.

## Migration checklist

1. Replace `requests.Session()` → `httpx.Client()` (or `httpx.AsyncClient()` if migrating to async).
2. Wrap client creation in `with ... as client:`.
3. Decide redirect behavior per route — add `follow_redirects=True` where needed.
4. Replace `proxies={...}` → `proxy=` or `mounts=`.
5. Replace `requests.exceptions.*` → `httpx.*` exceptions (see hierarchy in `retries-and-resilience.md`).
6. Wrap `response.url` in `str(...)` where strings are required downstream.
7. Audit any retry logic — `Retry/HTTPAdapter` does not port; layer `tenacity` or `stamina`.
8. Audit `verify=False` — replace with custom CA bundle or `truststore`.
9. Open uploaded files in binary mode (`"rb"`).
10. Run tests with strict timeouts (httpx has them by default) — fix anything that hung silently.
