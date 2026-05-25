# SSRF + deserialization + XXE + RCE chains

Two classes that lead to remote code execution or internal-network access.

## SSRF (Server-Side Request Forgery)

Server fetches URL provided by user → can hit:
- Cloud metadata: AWS `169.254.169.254`, GCP `metadata.google.internal`, Azure IMDS
- Internal services not exposed to internet
- File system: `file:///etc/passwd`
- Other protocols: `gopher://`, `dict://`, `ftp://`, `ldap://`

### Detection

```bash
# Server-side HTTP calls with user input
grep -rnE 'fetch\(|axios\.|http\.get|https\.get|requests\.get|httpx\.get|urlopen\(' src/ | \
  grep -E 'req\.|request\.|input|body\.|query\.|params\.'

# Specifically dangerous: server-side fetch of arbitrary URL
grep -rnE 'fetch\(\s*req\.body\.url|axios\(req\.body|requests\.get\(req\.' src/
```

### Fix patterns

```ts
// ❌
app.post('/preview', async (req, res) => {
  const html = await fetch(req.body.url).then(r => r.text());
  res.json({ html });
});

// ✅ allowlist + DNS resolution check
import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

async function safeFetch(url) {
  const u = new URL(url);
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('protocol');

  // Resolve DNS ourselves
  const addrs = await dns.resolve4(u.hostname);
  for (const ip of addrs) {
    const parsed = ipaddr.parse(ip);
    if (parsed.range() !== 'unicast') throw new Error('private IP');
  }

  // Disable redirects (or follow with re-check on each hop)
  return fetch(url, { redirect: 'manual' });
}
```

### Cloud metadata blocklist

| Cloud | IP / Host |
|---|---|
| AWS | `169.254.169.254`, `fd00:ec2::254` |
| GCP | `169.254.169.254`, `metadata.google.internal`, `metadata` |
| Azure | `169.254.169.254` |
| Alibaba | `100.100.100.200` |
| DigitalOcean | `169.254.169.254` |
| OpenStack | `169.254.169.254` |

### Blind SSRF

Server doesn't return response body to attacker — attacker still gets info via timing, response size, error messages. Treat all SSRF as critical.

### Image/video processing libs

ImageMagick, FFmpeg can fetch remote URLs internally via `URL://` or `https://` syntax in input. Strip those before passing user input.

```bash
# Detect ImageMagick / sharp / ffmpeg with user input
grep -rnE 'sharp\(|imagemagick|ffmpeg' src/ -A3 | grep -E 'req\.|input|body\.'
```

## Insecure deserialization

User-supplied data deserialized into objects → can instantiate dangerous classes → RCE.

### Python — pickle, yaml.load

```bash
grep -rnE 'pickle\.loads|pickle\.load\(' src/ --include='*.py'
grep -rnE 'yaml\.load\([^)]*\)' src/ --include='*.py' | grep -v SafeLoader
```

```py
# ❌
import pickle
data = pickle.loads(req.body)  # arbitrary code execution

# ✅ — don't deserialize untrusted; use JSON + Pydantic
from pydantic import BaseModel
class Input(BaseModel):
    name: str
    age: int
data = Input.model_validate_json(req.body)
```

```py
# ❌
import yaml
data = yaml.load(req.body)

# ✅
data = yaml.safe_load(req.body)  # only basic types, no class instantiation
```

### Node — eval, new Function, vm.runIn*

```bash
grep -rnE "eval\(|new Function\(|vm\.runIn|require\(.*req\.|require\(.*input" src/
```

All of these can execute arbitrary JS. There is no safe way to call them on user input.

### Java — readObject, ObjectInputStream

(If you ever touch Java code) Same risk; use a serialization library with allowlist (Jackson with default-typing disabled).

### XML XXE (XML External Entity)

```bash
grep -rnE 'DOMParser\(\)|XMLParser|xml\.etree|libxml|fast-xml-parser|xml2js' src/
```

```py
# ❌ defusedxml needed
import xml.etree.ElementTree as ET
ET.fromstring(user_xml)   # can resolve external entities → file disclosure + SSRF

# ✅
from defusedxml.ElementTree import fromstring
fromstring(user_xml)
```

```js
// Node fast-xml-parser — disable external entity resolution
new XMLParser({ processEntities: false });
```

### JSON.parse with `__proto__` (prototype pollution)

```js
// ❌
const obj = JSON.parse(req.body);
Object.assign({}, obj);  // if body has "__proto__": {...}, pollutes Object.prototype
```

**Fix:**
- Validate schema with Zod / Yup before merging
- Use `Object.create(null)` for prototype-less objects
- Modern Node: `JSON.parse` itself is safe; danger is in subsequent `Object.assign` / `_.merge` / `_.set`

```bash
grep -rnE '_\.merge\(|_\.set\(|Object\.assign\(\s*\{' src/ -B2 -A2 | grep -B2 'merge\|set\|assign' | grep -E 'req\.|input|body'
```

## RCE chains

Realistic 2026 chains:

1. **SSRF → IMDS → AWS keys → S3 read.** Mitigate: block metadata IP at the SSRF layer; use IMDSv2 (session-required).
2. **File upload (SVG) → stored XSS → admin session theft → RCE via admin function.** Mitigate: sanitize SVG; isolate uploads to a sandbox domain.
3. **Insecure deserialization → RCE.** Mitigate: never deserialize untrusted; use JSON + schema.
4. **Template injection (Jinja2) → RCE via `{{config.__class__...}}`.** Mitigate: never compile user input as template.
5. **Prototype pollution → admin-check bypass.** Mitigate: schema validation; avoid recursive merge libs.
6. **Dependency confusion → malicious npm package → exfil + RCE in CI.** Mitigate: scope private deps; signed registry.

## Severity calibration

| Finding | Severity |
|---|---|
| SSRF reachable from public endpoint, no allowlist | 🔴 Critical |
| `pickle.loads` / `yaml.load` on user input | 🔴 Critical |
| `eval` / `new Function` on user input | 🔴 Critical |
| XXE without `defusedxml` / entities disabled | 🔴 Critical |
| Template injection (SSTI) via Jinja2 / Handlebars / Pug | 🔴 Critical |
| Prototype pollution via `_.merge(target, req.body)` | 🔴 Critical |
| SSRF behind authentication (still bad — internal attackers) | ⚠️ High |
| SSRF with allowlist but allows redirect-follow | ⚠️ High |
| Image processing (sharp/ffmpeg) fetches remote URL from user input | ⚠️ High |
| JSON parsing followed by deep-merge into a config object | ⚠️ High |
