// Layer 0 — deterministic result extraction for the orchestrator.
//
// agy writes its WHOLE response (reasoning + every tool call + the final result) to the
// job's output.txt. The orchestrator (Claude/Opus) must NOT ingest that raw transcript —
// it burns the weekly Claude limit for nothing. Per the worker contract every worker ends
// its reply with EXACTLY ONE fenced ```yaml block whose only top-level key is `result:`
// (see prompts/skills-catalog.md → "Result envelope"). The MCP `_result` tool returns ONLY
// that envelope; the full transcript stays in output.txt as an internal server artifact the
// orchestrator never sees (unless a human passes full:true for debugging).
//
// Hardened per an Antigravity design review:
//  - scan only the TAIL of the transcript (the envelope is always the final answer) → no ReDoS
//    on huge logs, and far less chance of grabbing an echoed example / a `cat`-ed old envelope;
//  - validate the block actually looks like an envelope (defeats truncated/partial blocks);
//  - dedent so an indented ` result:` still parses as valid top-level YAML;
//  - if the job hit a fatal crash marker, NEVER trust an extracted block — synthesize failure.
//
// These functions are pure (no fs) so they are exhaustively unit-testable. The handler reads
// the file + computes the crash marker, then calls formatWorkerResult().

const TAIL_BYTES = 64 * 1024; // the envelope is the last thing agy prints; bound the scan window.

function dedent(s: string): string {
  const lines = s.split("\n");
  let min = Infinity;
  for (const l of lines) {
    if (!l.trim()) continue;
    const lead = l.match(/^[ \t]*/);
    min = Math.min(min, lead ? lead[0].length : 0);
  }
  if (!isFinite(min) || min === 0) return s;
  return lines.map((l) => l.slice(min)).join("\n");
}

// A real envelope has a top-level `result:` AND payload under it (a nested key, or an inline
// value). Rejects a truncated `result:` with nothing after it (a halted/streamed-off block).
function looksLikeEnvelope(body: string): boolean {
  const at = body.search(/^result[ \t]*:/m);
  if (at < 0) return false;
  const after = body.slice(at);
  return /^result[ \t]*:[ \t]*\S/.test(after) || /\n[ \t]+\S[^\n]*:/.test(after);
}

/**
 * Pull the worker's `result:` envelope out of the raw agy transcript.
 * Returns the envelope re-wrapped in a clean ```yaml fence, or null if none is present.
 * Scans only the tail; among candidates the LAST valid one wins (the final answer).
 */
export function extractResultEnvelope(output: string): string | null {
  if (!output) return null;
  const scan = output.length > TAIL_BYTES ? output.slice(-TAIL_BYTES) : output;

  // 1) Fenced code blocks (``` or ```` , optional yaml/yml lang). Take the LAST whose dedented
  //    body looks like an envelope (top-level result: + payload).
  const fenceRe = /(`{3,})[ \t]*(?:ya?ml)?[ \t]*\r?\n([\s\S]*?)\r?\n\1[ \t]*(?:\r?\n|$)/g;
  let m: RegExpExecArray | null;
  let lastBody: string | null = null;
  while ((m = fenceRe.exec(scan)) !== null) {
    const body = dedent(m[2]);
    if (looksLikeEnvelope(body)) lastBody = body;
  }
  if (lastBody !== null) return "```yaml\n" + lastBody.trimEnd() + "\n```";

  // 2) Loose fallback: a bare top-level `result:` (no fence). From the LAST such line to the end.
  const bareRe = /^result[ \t]*:/gm;
  let bare: RegExpExecArray | null;
  let lastIdx = -1;
  while ((bare = bareRe.exec(scan)) !== null) lastIdx = bare.index;
  if (lastIdx >= 0) {
    const block = scan.slice(lastIdx);
    if (looksLikeEnvelope(block)) return "```yaml\n" + block.trimEnd() + "\n```";
  }

  return null;
}

/**
 * The STRICT path: the worker wrote its envelope to a dedicated `result.yaml` SIDECAR — a clean
 * file, not the noisy transcript. We just normalise + validate it (no mining, no guessing which
 * block is real). Tolerates an accidental ```yaml fence the worker may have added. Returns the
 * wrapped envelope, or null if the sidecar is absent/empty/not a valid envelope — in which case
 * the caller falls back to transcript extraction (older worker, or it crashed before writing).
 */
export function wrapSidecarEnvelope(content: string | null | undefined): string | null {
  if (!content) return null;
  let body = content.trim();
  if (!body) return null;
  // tolerate the worker wrapping the file in a single fence
  const fenced = body.match(/^`{3,}[ \t]*(?:ya?ml)?[ \t]*\r?\n([\s\S]*?)\r?\n`{3,}\s*$/);
  if (fenced) body = fenced[1];
  body = dedent(body.trim());
  if (!looksLikeEnvelope(body)) return null;
  return "```yaml\n" + body.trimEnd() + "\n```";
}

/**
 * Build a deterministic FAILURE envelope when the worker emitted no parseable `result:`
 * (it crashed before finishing). The orchestrator still gets a clean structured result it
 * can gate on (status: failed) — with the crash evidence inline, NO reference to any file.
 */
export function synthesizeFailureEnvelope(output: string, crashMarker: string | null): string {
  const reason = (crashMarker || "worker produced no result: envelope (likely crashed before finishing)")
    .replace(/[\r\n]+/g, " ")
    .trim();
  const tailLines = (output || "")
    .replace(/`{3,}/g, "'''") // neutralise stray fences so they can't break the block scalar
    .split(/\r?\n/)
    .filter((l) => l.length > 0)
    .slice(-20);
  const excerpt = tailLines.length
    ? "  failure_excerpt: |\n" + tailLines.map((l) => "    " + l).join("\n") + "\n"
    : "";
  return (
    "```yaml\n" +
    "result:\n" +
    "  status: failed\n" +
    "  summary: |\n" +
    "    Worker emitted no result: envelope — treated as a failed run.\n" +
    "  errors:\n" +
    "    - " + JSON.stringify(reason) + "\n" +
    excerpt +
    "```"
  );
}

/**
 * What the MCP `_result` tool returns to the orchestrator.
 * - full=true   → the complete raw transcript (human debugging / recovery escalation only).
 * - crashMarker → the run hit a fatal agy marker; its output can't be trusted to hold a real
 *                 envelope (may be an echoed example / inspected old block) → synthesize failure.
 * - otherwise   → the extracted envelope, or a synthesized failure envelope if none exists.
 */
export function formatWorkerResult(opts: {
  output: string;
  full?: boolean;
  crashMarker?: string | null;
}): string {
  if (opts.full) return opts.output;
  if (opts.crashMarker) return synthesizeFailureEnvelope(opts.output, opts.crashMarker);
  const envelope = extractResultEnvelope(opts.output);
  if (envelope) return envelope;
  return synthesizeFailureEnvelope(opts.output, null);
}
