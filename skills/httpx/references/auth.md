# httpx — Authentication

httpx ships built-in classes for Basic, Digest, and NetRC, plus a `httpx.Auth` base class for custom flows (bearer tokens, request signing, OAuth2 refresh).

## Built-in classes

### `httpx.BasicAuth(username, password)`

```python
import httpx

auth = httpx.BasicAuth(username="user", password="pass")
response = httpx.get("https://httpbin.org/basic-auth/user/pass", auth=auth)
```

The shorthand `auth=("user", "pass")` is equivalent.

### `httpx.DigestAuth(username, password)`

```python
auth = httpx.DigestAuth(username="user", password="pass")
response = httpx.get("https://httpbin.org/digest-auth/auth/user/pass", auth=auth)
```

DigestAuth sends an unauthenticated request first, parses the `WWW-Authenticate` challenge, and re-sends with the computed digest. The 401 response is visible in `response.history`.

### `httpx.NetRCAuth(file=None)`

Reads credentials from `~/.netrc` (or the file you pass):

```python
auth = httpx.NetRCAuth()
with httpx.Client(auth=auth) as client:
    response = client.get("https://example.com/api")
```

## Client-level vs per-request auth

```python
# All requests on this client use these credentials
with httpx.Client(auth=("api_user", "api_key")) as client:
    client.get("https://api.example.com/data")
    client.post("https://api.example.com/submit", json={"x": 1})

# Per-request override
client.get("https://other.example.com/", auth=("other_user", "other_key"))
```

## Bearer / token auth via a custom `httpx.Auth`

There is no built-in `BearerAuth`. Subclass `httpx.Auth`:

```python
import httpx

class BearerAuth(httpx.Auth):
    def __init__(self, token: str) -> None:
        self.token = token

    def auth_flow(self, request: httpx.Request):
        request.headers["Authorization"] = f"Bearer {self.token}"
        yield request

with httpx.Client(auth=BearerAuth("my-jwt-token")) as client:
    response = client.get("https://api.example.com/protected")
```

`auth_flow` is a generator. Yield the (modified) request; httpx sends it; control resumes after the yield with the response (you don't need to handle it unless you do refresh).

## Async auth flow

For coroutine-friendly auth (e.g. fetching a refresh token), implement `async_auth_flow`:

```python
class AsyncBearerAuth(httpx.Auth):
    requires_response_body = True

    def __init__(self, token_provider):
        self.token_provider = token_provider

    async def async_auth_flow(self, request):
        token = await self.token_provider()
        request.headers["Authorization"] = f"Bearer {token}"
        yield request
```

`requires_response_body = True` tells httpx to fully load the response body before resuming the generator — needed if you inspect the response (e.g. retry on 401).

## OAuth2 refresh pattern

The flow yields, inspects the response, and re-yields a fresh request if needed:

```python
class OAuth2Auth(httpx.Auth):
    requires_response_body = True

    def __init__(self, access_token, refresh_token, refresh_url):
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.refresh_url = refresh_url

    def auth_flow(self, request):
        request.headers["Authorization"] = f"Bearer {self.access_token}"
        response = yield request

        if response.status_code == 401:
            refresh_request = httpx.Request(
                "POST",
                self.refresh_url,
                data={"refresh_token": self.refresh_token, "grant_type": "refresh_token"},
            )
            refresh_response = yield refresh_request
            self.access_token = refresh_response.json()["access_token"]
            request.headers["Authorization"] = f"Bearer {self.access_token}"
            yield request
```

For more complex OAuth flows, prefer a maintained library (`authlib`, `httpx-oauth`) over hand-rolled refresh logic.

## Header-based API keys

Skip the `Auth` class entirely and set a default header on the client:

```python
client = httpx.Client(headers={"X-API-Key": api_key})
```

Use the `Auth` class only when the credential changes per request, depends on the request (signed-URL style), or needs a 401 retry.

## Request signing

The `Auth` flow is the right place to compute a per-request signature:

```python
import hmac, hashlib, time

class SignedAuth(httpx.Auth):
    def __init__(self, key: str, secret: bytes):
        self.key = key
        self.secret = secret

    def auth_flow(self, request):
        ts = str(int(time.time()))
        msg = f"{ts}{request.method}{request.url.raw_path.decode()}".encode()
        sig = hmac.new(self.secret, msg, hashlib.sha256).hexdigest()
        request.headers["X-Key"] = self.key
        request.headers["X-Timestamp"] = ts
        request.headers["X-Signature"] = sig
        yield request
```

## Important constraints

- Auth flow generators MUST yield the request — forgetting to yield deadlocks the send.
- Do NOT store secrets in code — load from env / secret store.
- For 401 retry, the flow can yield multiple requests; httpx will not loop infinitely (one re-auth attempt by convention).
- For OAuth2 + token caching across processes, the token store must be shared (Redis, file) — `Auth` instances are per-process.
