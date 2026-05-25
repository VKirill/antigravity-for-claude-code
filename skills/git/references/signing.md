# Signing commits and tags

Cryptographic signatures prove that a commit was authored by the claimed identity. Three formats:

| Format | Best for |
|---|---|
| **SSH signing** | Default for most people. Re-uses existing SSH keys |
| **GPG** | Legacy/regulated environments; mature tooling |
| **sigstore / `gitsign`** | CI/CD, OIDC-keyless, no long-lived secrets |

## SSH signing (recommended default)

Available since git 2.34. Re-uses your existing `~/.ssh/id_ed25519` (or whichever key).

### Setup

```bash
# Tell git to use SSH for signing
git config --global gpg.format ssh

# Point at the PUBLIC key (yes, public — the private key signs, public is the identity)
git config --global user.signingkey ~/.ssh/id_ed25519.pub

# Sign all commits and tags by default
git config --global commit.gpgsign true
git config --global tag.gpgsign true
```

### Allowed signers (verify others' signatures)

```bash
git config --global gpg.ssh.allowedSignersFile ~/.config/git/allowed_signers
```

`~/.config/git/allowed_signers`:
```
alice@example.com ssh-ed25519 AAAA...
bob@example.com   ssh-ed25519 AAAA...
```

Now `git log --show-signature` validates against this file.

### GitHub verification

1. Upload your public SSH key to GitHub as **Signing Key** (Settings → SSH and GPG keys → New SSH key → Key type: Signing Key)
2. Pushed commits now show "Verified" badge

A single SSH key can serve as both auth key AND signing key — you have to add it twice in GitHub UI under different "Key type" settings.

## GPG signing

Heavier setup but works on platforms that don't yet support SSH signing.

### Setup

```bash
# Generate a key (Ed25519 preferred)
gpg --quick-generate-key "Your Name <you@example.com>" ed25519 sign 0

# List keys
gpg --list-secret-keys --keyid-format=long

# Configure git
git config --global gpg.format openpgp                    # default
git config --global user.signingkey ABC123DEF456          # the key ID from list
git config --global commit.gpgsign true

# Export for GitHub
gpg --armor --export ABC123DEF456 | pbcopy                # macOS
# or | xclip -selection clipboard                          # Linux
```

Paste into GitHub Settings → SSH and GPG keys → New GPG key.

### GPG agent

GPG asks for the passphrase on every commit. To cache it:

```bash
# ~/.gnupg/gpg-agent.conf
default-cache-ttl 3600
max-cache-ttl 86400
```

Then `gpg-connect-agent reloadagent /bye`.

On macOS, `pinentry-mac` integrates with Keychain.

## sigstore (gitsign)

Keyless signing via OIDC — your identity is verified through Google/GitHub/Microsoft OAuth, and a short-lived certificate is issued. No long-lived secrets to leak.

```bash
# Install
brew install sigstore/tap/gitsign
# or
go install github.com/sigstore/gitsign@latest

# Configure
git config --global commit.gpgsign true
git config --global tag.gpgsign true
git config --global gpg.x509.program gitsign
git config --global gpg.format x509
```

On commit, browser opens for OIDC auth. Certificate is logged to the public Rekor transparency log.

### When to use sigstore

- **CI/CD pipelines** — workload identity, no secret to rotate
- **Audited environments** — Rekor transparency log proves chain of custody
- **Teams that hate key management**

### When NOT to use sigstore

- Solo dev who just wants signed commits → use SSH signing
- Offline development (sigstore requires OIDC network call)
- Long-lived signatures that need to verify decades later (cert rotation)

## Verifying signatures

```bash
# Single commit
git log -1 --show-signature

# All commits since branch point
git log --show-signature main..HEAD

# Verify a tag
git tag -v v1.2.3

# Pipe through grep for "Good signature"
git log --show-signature main..HEAD | grep -E "(Good|Bad|No) signature"
```

## Enforcement at the repo level

GitHub: enable **"Require signed commits"** under branch protection rules. Pushes with unsigned commits are rejected at the server.

GitLab: settings → Repository → Push Rules → "Reject unsigned commits".

## Common issues

| Symptom | Cause | Fix |
|---|---|---|
| `gpg: signing failed: Inappropriate ioctl for device` | GPG can't reach pinentry from non-TTY context | `export GPG_TTY=$(tty)` in shell rc |
| `error: gpg failed to sign the data` | Wrong signing key | `gpg --list-secret-keys` to confirm key ID |
| GitHub shows "Unverified" | Key not uploaded as Signing Key (only as Auth Key) | Re-upload under correct Key Type |
| SSH signing not working on git < 2.34 | Old git version | Upgrade git |

## Per-repo override

```bash
cd ~/code/work-project
git config user.signingkey ~/.ssh/work_ed25519.pub
git config user.email "you@work.example.com"
```

Useful when work / personal accounts use different keys.
