# git — Eval Cases

v3 format: **user-voice phrasing** (Russian/typos/incomplete welcome) + **Expected behavior** column.

## Positive — should activate (10)

| User-voice prompt | Expected behavior |
|---|---|
| "как сделать rebase feature ветки на main" | Load `references/rebasing-and-history.md` |
| "conventional commits с commitlint настроить" | Load `references/conventional-commits.md` + cite `templates/commitlint.config.js` |
| "squash last 5 commits через autosquash" | Load `references/rebasing-and-history.md` autosquash section |
| "git worktree для hotfix ветки" | Load `references/worktrees.md` |
| "ssh signing вместо gpg" | Load `references/signing.md` SSH section |
| "lefthook для pre-commit lint" | Load `references/hooks.md` + cite `templates/lefthook.yml` |
| "восстановить удалённые коммиты через reflog" | Load `references/rebasing-and-history.md` reflog recovery + `examples/recover-from-bad-rebase.md` |
| "git bisect для регрессии" | Load `references/REFERENCE.md` (debugging history quick-lookup) |
| "что делает --force-with-lease" | Load `references/remote-collaboration.md` force-with-lease section |
| ".gitignore для node проекта" | Cite `templates/.gitignore.node` |

## Negative — should NOT activate (10)

| User-voice prompt | Should route to | Why |
|---|---|---|
| "github cli создать PR" | `github` cascade | GitHub-specific, not git CLI |
| "github actions для CI" | `github-actions` | CI config, not git |
| "cloudflare pages deploy" | (cloud) | Hosting |
| "из svn в git мигрировать" | (out of scope) | SVN migration excluded |
| "nx для monorepo" | (out of scope) | Monorepo tooling |
| "turbo для monorepo" | (out of scope) | Monorepo tooling |
| "mercurial bookmarks" | (no skill) | Different VCS |
| "gitlab branch protection" | (out of scope) | GitLab UI |
| "npm test в CI" | `nodejs` / `github-actions` | Not git |
| "conventional commits parser написать" | (commitlint cascade) | Parser implementation |

## Edge cases — 5

| User-voice prompt | Resolution |
|---|---|
| "как отменить последний push --force" | **git** primary — `references/rebasing-and-history.md` reflog recovery + `examples/recover-from-bad-rebase.md` |
| "husky vs lefthook что выбрать" | **git** — load `references/hooks.md` comparison |
| "gpg или ssh signing в 2026" | **git** — load `references/signing.md` decision section |
| "как не закоммитить секреты" | **git** — load `references/hooks.md` (gitleaks via pre-commit) + `.gitignore` patterns |
| "коллега force-pushed, я потерял работу" | **git** — load reflog recovery + `examples/recover-from-bad-rebase.md` |

## How to verify (manual)

1. Open a fresh session with this skill at `~/.claude/skills/git/`.
2. Paste each Positive prompt → confirm:
   - System reminder lists `git` as active
   - Response references files matching the "Expected behavior" column
3. Paste each Negative prompt → confirm `git` is NOT routed for unrelated tooling
4. Edge cases: confirm the correct sub-file is cited (recovery via reflog, hook comparison, etc.)

If a prompt routes wrong:
- Negative → Positive: tighten SKIP rules in description
- Positive → Negative: add the missing trigger term
- Edge routes only to one when it should split: enrich Related Skills cross-links

Run after any description or major reference restructure — that's the regression check.
