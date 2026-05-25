# Supply chain — OSV.dev + native scanners + typosquatting

The single biggest attack vector in 2026 isn't your code — it's the 3rd-party packages you depend on. This is the deep dive on dependency vulnerability hunting.

## Why OSV.dev is the right primary source

`npm audit`, `pip-audit`, `cargo audit`, `govulncheck` each check their **own** ecosystem with their **own** advisory database. Each misses:

- Fresh CVEs from GHSA before the ecosystem-specific DB picks them up
- OSS-Fuzz findings (Google's own fuzzing infrastructure → critical RCE bugs in low-level libs)
- Linux-distro-curated advisories
- Cross-ecosystem packages (e.g., a Rust crate used as a Python wheel)

**OSV.dev** is Google's [Open Source Vulnerabilities](https://google.github.io/osv.dev/) database — a free, open, deduplicated aggregation of:
- GitHub Security Advisories (GHSA)
- npm, PyPI, Maven, RubyGems, NuGet, crates.io, Go, Hex, Packagist, Hackage
- OSS-Fuzz
- Linux distro advisories
- Android, OSV (RustSec, etc.)

Used as **complement** (not replacement) to native scanners — they overlap ~80%, OSV catches the remaining 20%.

## API quick-reference

### Single query

```http
POST https://api.osv.dev/v1/query
Content-Type: application/json

{
  "package": { "name": "express", "ecosystem": "npm" },
  "version": "4.17.1"
}
```

Returns `{"vulns": [...]}` or `{}` if none.

### Batch query (preferred for whole lockfile)

```http
POST https://api.osv.dev/v1/querybatch
Content-Type: application/json

{
  "queries": [
    { "package": { "name": "express", "ecosystem": "npm" }, "version": "4.17.1" },
    { "package": { "name": "lodash", "ecosystem": "npm" }, "version": "4.17.20" }
  ]
}
```

Returns `{"results": [{"vulns": [...]}, {"vulns": [...]}]}` — array indexed in same order as input.

### Ecosystem strings (exact)

`npm` `PyPI` `Maven` `Go` `crates.io` `RubyGems` `NuGet` `Packagist` `Hex` `Hackage` `Pub` `OSS-Fuzz` `Linux` `Debian` `Ubuntu` `Alpine` `Rocky Linux` `AlmaLinux` `Android` `GitHub Actions`

### Rate limits

No auth required; ~1000 req/min per IP. For larger workloads use `osv-scanner` CLI which handles batching + caching automatically.

## Recommended workflow

### 1. CLI scanner first (preferred)

```bash
# Install once
go install github.com/google/osv-scanner/cmd/osv-scanner@latest
# or
brew install osv-scanner

# Scan repo
osv-scanner --recursive --format=json .

# Scan specific lockfiles
osv-scanner -L package-lock.json -L pnpm-lock.yaml -L requirements.txt
```

`osv-scanner` understands lockfile formats natively, batches queries to OSV.dev, deduplicates output, supports SBOM (CycloneDX/SPDX).

### 2. Cross-check with native scanner

Run alongside to catch the rare native-only finding:

```bash
# Node
npm audit --json > /tmp/npm-audit.json

# Python
pip-audit --format json > /tmp/pip-audit.json

# Rust
cargo audit --json > /tmp/cargo-audit.json

# Go
govulncheck -json ./... > /tmp/govulncheck.json
```

### 3. Diff the findings

Anything in native-only or OSV-only is suspicious — usually it's a fresh CVE in one DB but not the other. Investigate severity + reachability before triaging.

## What to do when a CVE hits

For each finding, answer 4 questions before triaging:

1. **Reachability**: is the vulnerable code path actually called in our codebase? Not all CVEs apply to all usage patterns. Use `osv-scanner` with `--call-analysis=go` for Go (Go's static analyzer is uniquely good here).
2. **Exposure**: is the function reachable from untrusted input (web body, env var, external API)? Or only from trusted internal code paths?
3. **Severity context**: CVSS 9.0 on a dev-only dep is < CVSS 6.0 on a prod-reachable input parser.
4. **Fix availability**: is there a patched version? If yes — bump. If no — workaround / `npm overrides` / pin a fork.

Output for each finding:

```
[Critical] CVE-2025-XXXX  express@4.17.1 → fixed in 4.19.2
  Path: User-input HTTP header → response.set() → header injection
  Reachability: ✅ reached (see src/routes/auth.ts:42)
  Action: bump express to 4.19.2 in package.json; re-run osv-scanner
```

## Typosquatting + dependency confusion

Two attacks that CVE databases don't catch because they're new malicious packages, not old vulnerable ones.

### Typosquatting detection

```bash
# Check for lookalike package names in package.json
node -e "
  const p = require('./package.json');
  const knownGood = ['react', 'react-dom', 'next', 'express', 'lodash'];  // your trusted set
  Object.keys({...p.dependencies, ...p.devDependencies}).forEach(name => {
    knownGood.forEach(good => {
      // Levenshtein-1 from a known-good name = suspicious
      if (name !== good && levenshtein(name, good) === 1) console.log('SUSPICIOUS:', name, 'vs', good);
    });
  });
"
```

Patterns to flag manually:
- `loadsh` vs `lodash`
- `discordjs` vs `discord.js`
- `requests` (Python style) in npm
- Newly published package with very few downloads + reasonable-looking name

Cross-check via:
- npm: `npm view <pkg> time` — show creation date; <30 days old = elevated risk
- npm: `npm view <pkg> downloads` — <1000/week + critical role = suspicious

### Dependency confusion

Attack: attacker publishes a package on public npm with the same name as your internal private package. Your CI pulls public version by mistake.

Defenses:
- Scope all internal packages: `@company/internal-foo` not `internal-foo`
- Use private registry with strict scope rules
- Check `package.json` for any unscoped, non-public package that might be internal
- Configure `.npmrc`:
  ```
  @company:registry=https://internal.registry/
  always-auth=true
  ```

## Severity calibration for supply-chain

| Finding | Severity | Why |
|---|---|---|
| Critical CVE in dep used in prod request path | 🔴 Critical | Reachable RCE / data leak |
| Critical CVE in dev-only dep (`devDependencies`) | ⚠️ High | Not in prod, but can compromise dev machine + supply chain to your repo |
| High CVE in transitive dep, code path not reached | 🟡 Medium | Bump anyway; future paths could reach |
| CVE in dep we no longer use but still in lockfile | 🟡 Medium | Clean lockfile; `npm prune --production` etc. |
| New unknown package with <30 days history + low downloads | ⚠️ High | Possible typosquatting; investigate before merge |
| OSV.dev says vulnerable, native scanner clean | ⚠️ High | OSV usually fresher; trust OSV |
| Native scanner says vulnerable, OSV clean | 🟡 Medium | Sometimes ecosystem DB has false positive; verify advisory text |

## Lockfile hygiene

- **Always commit lockfiles** — `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `poetry.lock`, `uv.lock`, `Cargo.lock`, `Gemfile.lock`, `composer.lock`. They pin transitive versions.
- **Review lockfile diffs** in PRs — a bumped indirect dep can be malicious.
- **Use `npm ci` / `pnpm install --frozen-lockfile` / `pip install -r requirements.lock`** in CI, not regular install — fails if lockfile drifts.
- **Subresource integrity** for CDN-loaded scripts — `<script src="..." integrity="sha384-...">`.

## Anti-patterns

| Pattern | Why bad | Fix |
|---|---|---|
| `npm audit fix --force` in CI | Silently bumps major versions, can break runtime | Bump deliberately, review |
| `pip install --upgrade-strategy=eager` | Same | Pin versions, bump via tooling like Renovate |
| Ignoring `audit` findings as "noise" | Real CVEs get lost in alert fatigue | Triage with the 4 questions above |
| Trusting one scanner's verdict | Each has blind spots | Use OSV.dev + native cross-check |
| Pinning to specific patch version forever | Misses security patches | Use semver ranges + Renovate; only pin when you have a reason |
| Allowing unscoped public packages with names that look internal | Dep confusion vector | Always scope private deps |

## Last verified

API surface verified against https://google.github.io/osv.dev/api/ — endpoints, ecosystem strings, batch format current as of skill creation date.
