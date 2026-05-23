# Snapshot & Approval Testing

Snapshot tests serialize an output and compare against a stored "golden" value. The first run records; later runs flag any diff.

## syrupy — pytest-native snapshots

```bash
uv add --dev syrupy
```

```python
def test_render_user_card(user, snapshot):
    html = render_user_card(user)
    assert html == snapshot
```

First run: snapshot is recorded under `__snapshots__/test_render.ambr` (next to the test file). Subsequent runs compare.

### Updating snapshots

```bash
pytest --snapshot-update
```

Run only when the output *should* change. Review the diff before committing the snapshot file.

### Snapshot extensions

Default is `SingleFileSnapshotExtension` for everything in one `.ambr` file. Override for binaries or large blobs:

```python
from syrupy.extensions.image import PNGImageSnapshotExtension

def test_chart(snapshot):
    png_bytes = render_chart()
    assert png_bytes == snapshot(extension_class=PNGImageSnapshotExtension)
```

Built-in extensions: `JSONSnapshotExtension`, `SingleFileSnapshotExtension`, `PNGImageSnapshotExtension`, `AmberSnapshotExtension` (default).

### Per-test serializer

```python
def test_dict(snapshot):
    result = build_response()
    assert result == snapshot(matcher=lambda data, path: path_matcher(data))
```

Matchers are useful for fuzzy fields (timestamps, UUIDs) that change every run.

## When to use snapshots

Good fit:

- Large serialized output (rendered HTML, JSON dumps, generated reports)
- Output where every change is intentional and visible in diff
- Approval-style tests where defining each field by hand is noisy

Bad fit:

- Small known values — write `assert x == 42` instead
- Output that contains volatile values (timestamps, random IDs, hashes) without a matcher — every run "fails"
- Behavior verification where the rule matters, not the literal output (`assert is_valid(x)`, not `assert serialize(x) == "..."`)

A snapshot file with hundreds of entries means tests passed for years without anyone looking at the diffs. Smell-test snapshots regularly.

## Alternatives

### pytest-approvaltests

```bash
uv add --dev approvaltests pytest-approvaltests
```

```python
from approvaltests import verify

def test_invoice(invoice):
    verify(invoice.to_text())
```

`.received.txt` is written; rename to `.approved.txt` after review. Workflow-oriented (reviewer renames vs `--snapshot-update`).

### inline snapshots — `inline-snapshot`

```bash
uv add --dev inline-snapshot
```

```python
from inline_snapshot import snapshot

def test_user_dict():
    assert user_to_dict(u) == snapshot({"id": 1, "name": "Alice"})
```

First run records the value **inside the test file** (via `pytest --inline-snapshot=create`). Reviewer sees the snapshot in the PR diff like normal code. Best when snapshots are small.

## Workflow with CI

CI must **fail** on snapshot drift, not silently update. Never run `--snapshot-update` in CI. Local-only update, review the diff, commit, push.

For PRs that intentionally change output:

1. Run `pytest --snapshot-update` locally
2. Inspect every `.ambr` file in `git diff`
3. Commit snapshot changes in the same PR as the code change
4. Reviewer reads the snapshot diff to confirm output change is intended

## Common pitfalls

- **Auto-updating in CI** (`pytest --snapshot-update` in the test job): tests will always pass and no one notices regressions. Snapshots become useless.
- **Volatile fields without matchers**: every CI run fails on timestamp/UUID diffs. Normalize before assert or use matchers.
- **Snapshot files in `.gitignore`**: snapshots must be committed — they're the test oracle.
- **Snapshots never reviewed**: snapshot files grow stale; no one knows what they assert. Periodically grep and audit.
- **Snapshots for unstable serialization**: dict ordering, set ordering, float formatting — pin the serialization (e.g., `json.dumps(..., sort_keys=True)`) before snapshotting.
