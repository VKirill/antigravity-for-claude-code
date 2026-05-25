# httpx — Proxies and TLS

## Single proxy

Route all HTTP and HTTPS traffic through one proxy:

```python
client = httpx.Client(proxy="http://localhost:8030")
```

With authentication:

```python
client = httpx.Client(proxy="http://username:password@localhost:8030")
```

This replaces the requests-style `proxies={"http": ..., "https": ...}` kwarg, which httpx does not accept. Pass `proxy=` instead.

## Per-scheme proxy via `mounts=`

Route different schemes (or different upstream hosts) to different transports:

```python
proxy_mounts = {
    "http://":  httpx.HTTPTransport(proxy="http://localhost:8030"),
    "https://": httpx.HTTPTransport(proxy="http://localhost:8031"),
}
client = httpx.Client(mounts=proxy_mounts)
```

Async equivalent uses `httpx.AsyncHTTPTransport`. Keys can match more specific prefixes (`"https://internal.example.com"`) — most specific wins.

### HTTPS proxy URL scheme

The proxy URL used for the `"https://"` mount typically has scheme `http://`, not `https://`. Most HTTP CONNECT proxies expose plain HTTP themselves and tunnel TLS to the origin.

## Environment-variable proxies

httpx respects `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY` by default (`trust_env=True`). Disable with `trust_env=False`:

```python
client = httpx.Client(trust_env=False)
```

## SOCKS proxies

```bash
pip install httpx[socks]
```

```python
client = httpx.Client(proxy="socks5://user:pass@host:1080")
```

Supports `socks5://` and `socks5h://` (DNS resolved by the proxy).

## TLS — `verify=`

Default: `verify=True` validates against the `certifi` CA bundle.

```python
# Default (recommended)
client = httpx.Client()                       # verify=True implicit

# Disable verification — DO NOT use in production
client = httpx.Client(verify=False)

# Custom CA bundle file
client = httpx.Client(verify="/path/to/ca-bundle.pem")

# Custom SSLContext
import ssl
ctx = ssl.create_default_context(cafile="/path/to/ca-bundle.pem")
client = httpx.Client(verify=ctx)
```

httpx also reads `SSL_CERT_FILE` and `SSL_CERT_DIR` from the environment.

## System trust store

To use the operating-system trust store (Windows cert store, macOS keychain, Linux NSS) instead of certifi:

```bash
pip install truststore
```

```python
import ssl, truststore
ctx = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
client = httpx.Client(verify=ctx)
```

This is the right answer in corporate environments where the OS already trusts an internal CA.

## Mutual TLS (mTLS) — client certificate

Load the client cert into an `SSLContext` and pass via `verify=` (because mTLS context handles both directions):

```python
import ssl
ctx = ssl.create_default_context()
ctx.load_cert_chain(certfile="/path/to/client.pem", keyfile="/path/to/client.key")
client = httpx.Client(verify=ctx)
```

Alternative shorthand via `cert=`:

```python
client = httpx.Client(cert=("/path/to/client.pem", "/path/to/client.key"))
# or single combined PEM:
client = httpx.Client(cert="/path/to/client-combined.pem")
```

## Local HTTPS development

For testing HTTPS against `localhost`, generate a self-signed cert with `trustme`:

```python
import trustme, httpx, ssl
ca = trustme.CA()
server_cert = ca.issue_cert("localhost")
# ... configure your local server with server_cert ...

ctx = ssl.create_default_context()
ca.configure_trust(ctx)
client = httpx.Client(verify=ctx)
```

## Diagnosing TLS errors

| Error | Likely cause |
|---|---|
| `ssl.SSLCertVerificationError: ... CERTIFICATE_VERIFY_FAILED` | Server cert not signed by a CA in your bundle; or expired; or hostname mismatch |
| `ssl.SSLError: ... unsupported protocol` | Server requires TLS version newer than your `ssl` allows |
| `ConnectError: [SSL: WRONG_VERSION_NUMBER]` | You connected to a plain-HTTP port with `https://` |

Never patch these with `verify=False` in production — load the correct CA bundle or use `truststore`.

## Proxy + TLS together

mTLS through a proxy works with the SSLContext approach — the cert goes on the context, the proxy goes on `proxy=` or `mounts=`. Each transport in `mounts=` carries its own TLS settings, so per-host TLS is possible.
