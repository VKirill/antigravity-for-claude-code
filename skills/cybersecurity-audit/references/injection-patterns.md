# Injection patterns — SQL/NoSQL/Command/LDAP/XPath/Template

Every injection vector with detection grep + fix pattern.

## SQL injection

### Patterns to flag

```bash
# String concat building SQL (JavaScript/TypeScript)
grep -rnE "query\s*=.*\+|\`SELECT[^\`]*\$\{|\`INSERT[^\`]*\$\{|\`UPDATE[^\`]*\$\{|\`DELETE[^\`]*\$\{" src/

# Python f-strings building SQL
grep -rnE 'f"\s*(SELECT|INSERT|UPDATE|DELETE)[^"]*\{' src/

# .format() / %s building SQL with user data
grep -rnE '("\s*(SELECT|INSERT|UPDATE|DELETE)[^"]*"\s*\.\s*format|\s*%\s*\(\s*req\.)' src/

# Sequelize / older ORMs with raw queries
grep -rnE 'sequelize\.query\(\s*[\`"]|\.raw\(\s*[\`"][^\`"]*\$' src/
```

### Fix patterns

| Stack | Right way |
|---|---|
| Node + pg | `pool.query('SELECT * FROM users WHERE id = $1', [id])` |
| Node + Prisma | `prisma.user.findUnique({ where: { id } })` — auto-parameterized |
| Python + psycopg | `cur.execute("SELECT * FROM users WHERE id = %s", (id,))` |
| Python + SQLAlchemy | `select(User).where(User.id == id)` |
| Django ORM | `User.objects.filter(id=id)` |
| Raw SQL with named params | `prisma.$queryRaw\`SELECT ... WHERE id = ${id}\`` (Prisma's tagged template safely parameterizes) |

### Never

- `f"SELECT * WHERE id = {req.id}"`
- `"SELECT * WHERE id = " + req.params.id`
- `"SELECT * WHERE id = '%s'" % (req.id,)`

### Edge cases

- **ORDER BY column** is NOT parameterizable in SQL — allowlist the field names instead: `const sortField = ['name','date'].includes(req.query.sort) ? req.query.sort : 'name';`
- **LIKE patterns** — user-supplied wildcards: escape `%` and `_` before using in `LIKE`

## NoSQL injection (MongoDB)

### Patterns

```bash
# Direct passthrough of req.body to query
grep -rnE 'find\(\s*req\.body|findOne\(\s*req\.body' src/
```

```js
// ❌ Vulnerable
db.users.find({ username: req.body.username, password: req.body.password });
// User sends: { username: "admin", password: { $ne: null } } → auth bypass

// ✅ Safe — validate types first
const schema = z.object({ username: z.string(), password: z.string() });
const { username, password } = schema.parse(req.body);
db.users.find({ username, password });
```

### Reject $-prefixed keys

```js
function sanitizeMongo(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  for (const k in obj) {
    if (k.startsWith('$')) delete obj[k];
    else sanitizeMongo(obj[k]);
  }
  return obj;
}
```

Or use a library: `mongo-sanitize`.

## OS command injection

### Patterns

```bash
# Node child_process with shell:true and user input
grep -rnE "exec\(|spawn\(.*shell:\s*true|execSync\(" src/ \
  --include='*.ts' --include='*.js' | \
  grep -E 'req\.|process\.argv|input'

# Python subprocess with shell=True
grep -rnE 'subprocess\.\w+\([^)]*shell\s*=\s*True' src/ --include='*.py'

# Python os.system with input
grep -rnE 'os\.system\(' src/ --include='*.py'
```

### Fix

```ts
// ❌
exec(`ffmpeg -i ${req.body.url} out.mp4`);    // RCE: req.body.url = "; rm -rf /"

// ✅
execFile('ffmpeg', ['-i', req.body.url, 'out.mp4']);  // arg array, no shell
```

Plus: validate `req.body.url` as a URL with allowlist host.

```python
# ❌
os.system(f"ffmpeg -i {url} out.mp4")

# ✅
subprocess.run(['ffmpeg', '-i', url, 'out.mp4'], check=True)  # shell=False default
```

## LDAP injection

User input in LDAP queries → can bypass auth or extract directory.

```py
# ❌
filter = f"(uid={username})"
ldap.search_s(base, scope, filter)
# username = "*)(uid=*"   → returns all users

# ✅
import ldap.filter
filter = "(uid=%s)" % ldap.filter.escape_filter_chars(username)
```

## XPath injection

```py
# ❌
query = f"//user[name/text()='{name}' and password/text()='{password}']"

# ✅ — parameterized XPath or escape input
from lxml import etree
# Use prepared XPath with variables (lxml supports this via XPath compile + variable binding)
```

## Server-Side Template Injection (SSTI)

User input rendered as template → RCE.

### Patterns

```bash
# Jinja2 with user-controlled template string
grep -rnE 'Template\(\s*req\.|render_template_string\(' src/ --include='*.py'

# Handlebars with user template
grep -rnE 'Handlebars\.compile\(\s*req\.' src/ --include='*.js'

# Mustache / EJS / Pug — similar
```

### Fix

Never compile user input as a template. Pre-define templates, pass user data as variables only:

```py
# ❌
return render_template_string(f"Hello {user_input}")

# ✅
return render_template('greet.html', name=user_input)
```

## Header injection / CRLF

User input in response header → can inject `\r\n` + new headers.

```ts
// ❌
res.setHeader('X-Custom', req.query.value);
// value = "test\r\nSet-Cookie: pwn=1" → injects Set-Cookie

// ✅ — Express/Fastify reject \r\n in setHeader by default in modern versions
//   but validate explicitly:
const value = String(req.query.value).replace(/[\r\n]/g, '');
res.setHeader('X-Custom', value);
```

## Cross-injection grep (all at once)

```bash
# Anything looking like dynamic code from user input
grep -rnE 'eval\(|new Function\(|Function\(|setTimeout\(\s*[\`"]|setInterval\(\s*[\`"]' src/ \
  --include='*.ts' --include='*.js' | grep -E 'req\.|input|body'

grep -rnE 'exec\(|compile\(|__import__\(' src/ --include='*.py' | grep -E 'request\.|input'
```

## Severity calibration

| Vector | Reachable from user input | Severity |
|---|---|---|
| SQL injection | Yes | 🔴 Critical |
| SQL injection | Admin-only path | ⚠️ High |
| OS command injection | Yes | 🔴 Critical |
| Template injection (SSTI) | Yes | 🔴 Critical |
| NoSQL injection (`$ne` auth bypass) | Yes | 🔴 Critical |
| LDAP injection | Yes | 🔴 Critical |
| Header injection (CRLF) | Yes | ⚠️ High |
| XPath injection | Yes | ⚠️ High |
