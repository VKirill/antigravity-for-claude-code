# httpx — Wrong vs Right

Paired snippets. Reach for the right column.

## 1. One client per request (leaks)

### Wrong
```python
async def fetch_user(user_id: int):
    async with httpx.AsyncClient() as client:        # ❌ new client per call
        r = await client.get(f"https://api.example.com/users/{user_id}")
        return r.json()

await asyncio.gather(*(fetch_user(i) for i in range(100)))
# 100 TCP+TLS handshakes, 100 pool tear-downs
```

### Right
```python
# At app startup
app.state.http = httpx.AsyncClient(base_url="https://api.example.com")

async def fetch_user(client: httpx.AsyncClient, user_id: int):
    r = await client.get(f"/users/{user_id}")
    r.raise_for_status()
    return r.json()

await asyncio.gather(*(fetch_user(app.state.http, i) for i in range(100)))
# 1 connection pool, reused; with http2=True, often 1 socket
```

## 2. Missing context manager (sockets leak until GC)

### Wrong
```python
client = httpx.Client()
r = client.get("https://api.example.com/items")     # ❌ never closed
return r.json()
```

### Right
```python
with httpx.Client() as client:                       # ✅ closed on exit
    r = client.get("https://api.example.com/items")
    r.raise_for_status()
    return r.json()
```

For a process-scoped client, pair manual `.close()` / `await .aclose()` with the framework's shutdown hook.

## 3. Sync client inside `async def` (blocks the event loop)

### Wrong
```python
async def handler():
    with httpx.Client() as client:                   # ❌ sync I/O in async fn
        r = client.get("https://upstream")
        return r.json()
```

### Right
```python
async def handler():
    async with httpx.AsyncClient() as client:        # ✅ AsyncClient + await
        r = await client.get("https://upstream")
        r.raise_for_status()
        return r.json()
```

## 4. No timeout

### Wrong
```python
with httpx.Client(timeout=None) as client:           # ❌ unbounded waits
    r = client.get("https://flaky-upstream")
```

### Right
```python
with httpx.Client(timeout=httpx.Timeout(DEFAULT_TIMEOUT, connect=CONNECT_TIMEOUT)) as client:
    r = client.get("https://flaky-upstream")
    r.raise_for_status()
```

(Numeric values pinned in `recommended-defaults.md`.)

## 5. Assuming `follow_redirects=True`

### Wrong
```python
r = httpx.get("https://example.com/old-path")        # ❌ httpx default = False
data = r.json()                                       # 301 body, not the JSON you expected
```

### Right
```python
r = httpx.get("https://example.com/old-path", follow_redirects=True)
r.raise_for_status()
data = r.json()
```

Or set it on the client.

## 6. Manual retry loop without backoff

### Wrong
```python
for _ in range(5):
    try:
        r = client.get(url)
        r.raise_for_status()
        return r.json()
    except httpx.HTTPError:
        continue                                      # ❌ no backoff, no jitter, retries 4xx
```

### Right
```python
from tenacity import retry, stop_after_attempt, wait_exponential_jitter, retry_if_exception_type

@retry(
    reraise=True,
    stop=stop_after_attempt(MAX_ATTEMPTS),
    wait=wait_exponential_jitter(initial=BACKOFF_INITIAL, max=BACKOFF_MAX),
    retry=retry_if_exception_type((httpx.RequestError, httpx.HTTPStatusError)),
)
def fetch(url: str):
    r = client.get(url)
    r.raise_for_status()
    return r.json()
```

Don't retry 4xx — bake that into the predicate or check `e.response.status_code` inside the retry-predicate function.

## 7. Streaming response without `with`

### Wrong
```python
response = client.stream("GET", url)                 # ❌ no context manager
for chunk in response.iter_bytes():
    ...
# connection held until GC
```

### Right
```python
with client.stream("GET", url) as response:          # ✅
    response.raise_for_status()
    for chunk in response.iter_bytes():
        ...
```

## 8. `data=` for JSON body

### Wrong
```python
client.post(url, data={"name": "widget"})            # ❌ form-encoded, not JSON
```

### Right
```python
client.post(url, json={"name": "widget"})            # ✅ JSON
```

## 9. Verifying disabled in production

### Wrong
```python
client = httpx.Client(verify=False)                  # ❌ MITM risk
```

### Right
```python
import ssl, truststore
ctx = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT) # ✅ OS trust store
client = httpx.Client(verify=ctx)
```

Or pass a CA bundle path: `verify="/etc/ssl/certs/internal-ca.pem"`.

## 10. Monkey-patching the network in tests

### Wrong
```python
def test_calls_upstream(monkeypatch):
    monkeypatch.setattr(httpx, "get", lambda *a, **kw: ...)   # ❌
    ...
```

### Right
```python
def test_calls_upstream(httpx_mock):
    httpx_mock.add_response(url="https://api.example.com/x", json={"ok": True})
    with httpx.Client() as client:
        r = client.get("https://api.example.com/x")
        assert r.json() == {"ok": True}
```

Or `respx`, or `httpx.MockTransport`. See `testing.md`.

## 11. Missing `raise_for_status()`

### Wrong
```python
r = client.get("https://api.example.com/items")
return r.json()                                       # ❌ 500-page-as-HTML → JSONDecodeError
```

### Right
```python
r = client.get("https://api.example.com/items")
r.raise_for_status()                                  # ✅ httpx.HTTPStatusError on 4xx/5xx
return r.json()
```

## 12. `proxies=` kwarg from `requests`

### Wrong
```python
httpx.get(url, proxies={"https": "http://p:8030"})    # ❌ TypeError: unexpected kwarg 'proxies'
```

### Right
```python
httpx.get(url, proxy="http://p:8030")                 # ✅
```

Or use `mounts=` on a `Client` for per-scheme routing.
