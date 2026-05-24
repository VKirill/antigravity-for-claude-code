# SPEC — Externalize agent prompts into editable `prompts/*.md`

## Problem

All persona/role/system prompts are hardcoded as string literals across the source:
- `src/config.ts` — `ROLE_PRESETS` (designer/copywriter/programmer/architect) + `DEBATE_PERSONAS` (optimist/skeptic/agreer/hater/synthesizer).
- `src/tools/debate.ts` — per-round task wrappers (RU+EN, autonomous + interactive), each `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ...]` + round instruction.
- `src/tools/programming.ts` — two `systemPrompt` strings (code-review, programming-advice).
- `src/tools/receipt.ts` — debate-receipt generation prompt (RU+EN).

Editing any prompt requires changing TypeScript and rebuilding. The user wants prompts in
standalone `.md` files in a `prompts/` folder, editable at any time, taking effect on the
**next MCP call without a rebuild or restart**.

## How prompts are sent today (context, do NOT change)

The persona text is **prepended into the same single message** sent to `agy --print`:
`promptToSend = `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${text}]\n\n${task}``. It is NOT two messages.
This message-assembly logic stays exactly as-is; only the SOURCE of `text` changes (from a
hardcoded literal to a file read).

## Scope

### Loader (`src/utils/prompts.ts`)
- `loadPrompt(relPath: string, vars?: Record<string,string>): string`
  - Reads `<PROMPTS_DIR>/<relPath>` **fresh on every call** via `fs.readFileSync` (utf-8).
  - `PROMPTS_DIR = process.env.ANTIGRAVITY_PROMPTS_DIR || <repo-root>/prompts`. Resolve repo-root
    from a stable anchor (e.g. `path.resolve(import.meta.dir, "../../prompts")`) so it works when
    run from `src/` via bun. Document that bundled `dist/` runs must set `ANTIGRAVITY_PROMPTS_DIR`.
  - Replaces `{{key}}` placeholders with `vars[key]`. Unknown `{{...}}` left intact is acceptable;
    a missing required var is the caller's responsibility (pass all vars).
  - On missing file → throw a clear `Error("prompt file not found: <abs path>")` (fail visibly).
  - Trim trailing newline so concatenation matches the old inline strings exactly.

### Prompt files (`prompts/`)
Extract every hardcoded string VERBATIM (same wording, RU/EN preserved) into:
```
prompts/
  roles/        designer.md copywriter.md programmer.md architect.md
  debate/       optimist.md skeptic.md agreer.md hater.md synthesizer.md
  rounds/       ru/*.md en/*.md   (per-round task wrappers, with {{topic}}/{{comment}} placeholders)
  tools/        code-review.md programming-advice.md debate-receipt.md
```
The persona files contain ONLY the persona text (the part currently in ROLE_PRESETS/DEBATE_PERSONAS).
The `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ...]` / `[SYSTEM PROMPT FOR ROLE: ...]` wrapper + `\n\n` join
stays in code so output bytes are identical to today.

### Rewire consumers (behavior-identical)
- `config.ts` — replace `ROLE_PRESETS`/`DEBATE_PERSONAS` literal maps with accessors backed by
  `loadPrompt("roles/<role>.md")` / `loadPrompt("debate/<persona>.md")`. Keep the SAME public
  shape used by callers (a lookup by key) so `discuss.ts`/`debate.ts` need minimal change, OR
  expose `getRolePreset(role)` / `getDebatePersona(name)` helpers and update callers.
- `discuss.ts`, `programming.ts`, `debate.ts`, `receipt.ts` — read prompt text via the loader.
  Round wrappers in `debate.ts` keep their orchestration; only the literal text moves to `rounds/*`.

## Acceptance criteria
- `bun test` fully green (baseline 59 pass / 0 fail). Existing assertions about the
  `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ...]` output must still pass → extraction is byte-identical.
- Editing a `prompts/*.md` changes the next MCP call's prompt with NO rebuild/restart
  (loader reads fresh each call).
- Missing prompt file throws a clear, named error.
- No hardcoded persona/role/system-prompt string literals remain in `src/` (only the wrapper
  template + round-orchestration logic).
- `ANTIGRAVITY_PROMPTS_DIR` env override works; default resolves to repo `prompts/`.

## Out of scope
- Changing the single-message assembly / `runAgy` send logic.
- Caching (explicitly fresh-read per call, per user decision).
- New prompts or wording changes (verbatim extraction only).

## Verification
- `bun test`
- Manual: edit `prompts/roles/programmer.md`, confirm a `discuss` call reflects it without rebuild.

## Sources
- Current code: src/config.ts, src/tools/{discuss,programming,debate,receipt}.ts (read 2026-05-24).
- User decisions: folder = `prompts`; read fresh on every call.
