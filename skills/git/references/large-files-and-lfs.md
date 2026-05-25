# Large files and Git LFS

Git is bad at large binary files. Every checkout pulls every version. A 100 MB design file checked in 50 times = 5 GB of pack data forever.

## When to use LFS

Use LFS for files that are:
- Binary (not text-diffable)
- Large (>5 MB rule of thumb)
- Versioned (you DO want them in history)

Common candidates: `.psd`, `.ai`, `.sketch`, `.mp4`, `.pdf`, `.zip`, `.bin`, ML model weights, large datasets, audio.

Don't use LFS for: source code, text configs, small images you actually edit.

## Setup

```bash
# Install LFS (one-time per machine)
brew install git-lfs
# or apt install git-lfs / yum / pacman

# Hook LFS into git (one-time per user)
git lfs install

# Track patterns in your repo (writes .gitattributes)
git lfs track "*.psd"
git lfs track "*.mp4"
git lfs track "models/*.bin"

# Commit .gitattributes — every clone needs it
git add .gitattributes
git commit -m "chore: track binaries with LFS"
```

## How it works

When you commit a tracked file:

1. The file content goes to LFS storage
2. Git stores only a small pointer file (`oid sha256:abc...`)
3. On clone, the pointer is checked out
4. On checkout, LFS downloads the actual file

Result: `.git` stays small, history is fast.

## Inspecting LFS state

```bash
# List LFS-tracked patterns
git lfs track

# See LFS files in the repo
git lfs ls-files

# See LFS file at HEAD vs pointer
cat large-asset.psd                    # pointer text
git lfs pull                           # download actual content

# Status of LFS objects
git lfs status

# Migrate existing files into LFS (rewrites history!)
git lfs migrate import --include="*.psd" --everything
```

## Migration: convert existing large files to LFS

```bash
# Backup first
git clone --mirror . ../backup-repo

# Migrate
git lfs migrate import --include="*.psd,*.mp4" --everything

# Re-push (force, this rewrites history — coordinate with team)
git push --force --all
git push --force --tags
```

Everyone else MUST re-clone after this. Coordinate.

## Quotas and cost

GitHub LFS has:
- **1 GB storage** free per repo
- **1 GB bandwidth** free per month
- Paid packs above that

Bitbucket, GitLab have similar models. Self-hosted LFS (e.g. with `lfs-test-server` or S3-backed) is unlimited but you run it.

## Alternatives to LFS

### Just don't commit large files

If the file is a build artifact, generate it in CI. If it's an external asset, store it in S3 / Google Drive / Dropbox and reference by URL.

### git-annex

More powerful, more complex. Decouples "knowing about" a file from "having" it. Good for scientific data sets. Steep learning curve.

### dvc (Data Version Control)

Built for ML datasets and models. Tracks files via S3 / GCS / etc. and stores pointers in git. Better than LFS for ML workflows.

### Mercurial largefiles / artifact servers / Perforce

Different paradigms; out of scope.

## .gitattributes syntax

```
# Track all PSDs with LFS
*.psd filter=lfs diff=lfs merge=lfs -text

# Track only files in a specific directory
assets/raw/* filter=lfs diff=lfs merge=lfs -text

# Stop tracking a pattern (revert to plain git)
*.svg !filter !diff !merge text
```

`git lfs track <pattern>` writes these lines for you.

## Common issues

| Symptom | Cause | Fix |
|---|---|---|
| `Smudge error: ... 134` | LFS hooks not installed in clone | `git lfs install && git lfs pull` |
| Clone is huge despite LFS | Old large files already in history | `git lfs migrate import` to rewrite |
| File shows as pointer text | LFS not pulled | `git lfs pull` |
| LFS bandwidth quota exceeded | Heavy LFS download traffic | Use `git clone --filter=blob:none` (partial clone) |
| `.gitattributes` not respected | File added before `git lfs track` | `git rm --cached file && git add file` |

## Partial clone (alternative to LFS)

Modern git supports partial clones — download history without all blobs:

```bash
git clone --filter=blob:none <url>          # no blobs at clone time
git clone --filter=tree:0 <url>             # even leaner
```

Blobs are downloaded on demand when you `git checkout` a file. Doesn't require LFS server-side.

Tradeoff: needs git 2.27+ on both client and server, and partial clones can't easily be cloned again.

## Decision: LFS vs partial clone vs alternative

| Situation | Use |
|---|---|
| < 10 binary files, < 100 MB each | LFS |
| Many binary files, plain git would clone gigabytes | Partial clone |
| ML datasets with versioning needs | DVC |
| Build artifacts | Don't commit — generate in CI |
| Massive monorepo (Microsoft-scale) | Scalar / VFS for git |
