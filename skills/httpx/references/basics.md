# httpx — Basics

The minimum vocabulary: methods, params, bodies, response inspection.

## Top-level functions

`httpx.get`, `httpx.post`, `httpx.put`, `httpx.patch`, `httpx.delete`, `httpx.head`, `httpx.options`, `httpx.request(method, url, ...)`.

These create a one-shot `Client` under the hood. Use them only for throwaway scripts. For real code, use a context-managed `Client` (see `client-and-asyncclient.md`).

```python
import httpx

response = httpx.get("https://httpbin.org/get")
print(response.status_code)   # 200
print(response.json())
```

## Query parameters

```python
httpx.get("https://api.example.com/search", params={"q": "httpx", "limit": 10})
# → GET /search?q=httpx&limit=10
```

`params=` accepts a dict, a list of tuples (preserves duplicates), or a `httpx.QueryParams` object.

## Headers

```python
httpx.get("https://api.example.com/me", headers={"Authorization": "Bearer abc"})
```

Header keys are case-insensitive. The response object's `.headers` is also case-insensitive.

## Request bodies — `json=`, `data=`, `content=`, `files=`

Pick exactly one body kind per call.

| Use | When |
|---|---|
| `json={"a": 1}` | JSON body — sets `Content-Type: application/json` and serializes via `json.dumps` |
| `data={"a": "1"}` | URL-encoded form (`application/x-www-form-urlencoded`). Only dicts/lists of tuples. |
| `content=b"..."` or `content="..."` | Raw bytes / text body. Use when you control encoding. |
| `files={"f": open(path, "rb")}` | Multipart upload (`multipart/form-data`) |
| `data=` **+** `files=` | Multipart with form fields and files together |

Notes:
- Using `data=` with a raw string or bytes is deprecated — switch to `content=`.
- Files MUST be opened in binary mode (`"rb"`).
- `json=` and `data=`/`content=` are mutually exclusive in practice — passing both is a coding error.

```python
# JSON POST
response = httpx.post("https://api.example.com/items", json={"name": "widget"})

# Form POST
response = httpx.post("https://api.example.com/login", data={"user": "x", "pass": "y"})

# Raw bytes
response = httpx.put("https://api.example.com/blob", content=b"raw bytes here")

# Multipart upload
files = {"upload": ("report.csv", open("report.csv", "rb"), "text/csv")}
response = httpx.post("https://api.example.com/upload", files=files, data={"folder": "q3"})
```

## Response object

Common attributes/methods:

| Attribute / method | Returns |
|---|---|
| `.status_code` | `int` — e.g. `200`, `404` |
| `.is_success` | `True` for 2xx |
| `.is_redirect` | `True` for 3xx |
| `.is_client_error` | `True` for 4xx |
| `.is_server_error` | `True` for 5xx |
| `.text` | `str` — body decoded per `response.encoding` |
| `.content` | `bytes` — raw body |
| `.json()` | parsed JSON (raises on invalid JSON) |
| `.headers` | case-insensitive header dict |
| `.cookies` | response cookies |
| `.url` | `httpx.URL` object — call `str(response.url)` for string |
| `.http_version` | `"HTTP/1.1"` or `"HTTP/2"` |
| `.elapsed` | `datetime.timedelta` — server round-trip time |
| `.request` | the originating `httpx.Request` |
| `.history` | list of prior responses for redirects |
| `.raise_for_status()` | raises `httpx.HTTPStatusError` for 4xx/5xx |
| `.next_request` | `httpx.Request` for next redirect, or `None` |

```python
response = httpx.get("https://api.example.com/items/42")
response.raise_for_status()
item = response.json()
```

## URL handling

`response.url` is `httpx.URL`, not a string. Convert with `str(response.url)` or compare with another `httpx.URL`.

```python
str(response.url)  # 'https://api.example.com/items/42'
response.url.path  # '/items/42'
response.url.host  # 'api.example.com'
```

## Encoding

`response.encoding` is set by httpx's charset detection. Override before reading `.text`:

```python
response.encoding = "utf-8"
print(response.text)
```

## Limits to know up front

- httpx applies default timeouts on every request — see `recommended-defaults.md`. Do not assume "no timeout".
- `follow_redirects=False` is the default — opposite of `requests`. See `migration-from-requests.md`.
- One-shot `httpx.get(...)` opens and closes a connection per call. For multiple calls to the same host, use a `Client` (`client-and-asyncclient.md`).
