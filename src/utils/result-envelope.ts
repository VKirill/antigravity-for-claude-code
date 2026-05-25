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

import { parse as parseYaml } from "yaml";

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

export type EnvelopeParse = { ok: true; envelope: string } | { ok: false; error: string };

/**
 * STRICT validation via a real YAML parser. The candidate must actually PARSE and have a
 * top-level `result:` mapping with content. "Strict" = if the orchestrator couldn't YAML.parse
 * it, we reject it (no regex guessing). Tolerates a stray ```yaml fence and indentation, then
 * returns the re-wrapped envelope or a clear, human-readable error.
 */
export function parseEnvelopeStrict(candidate: string | null | undefined): EnvelopeParse {
  if (!candidate || !candidate.trim()) return { ok: false, error: "empty" };
  let body = candidate.trim();
  // tolerate a single ```yaml fence wrapping the candidate
  const fenced = body.match(/^`{3,}[ \t]*(?:ya?ml)?[ \t]*\r?\n([\s\S]*?)\r?\n`{3,}\s*$/);
  if (fenced) body = fenced[1];
  body = dedent(body.trim());

  let doc: unknown;
  try {
    doc = parseYaml(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message.split("\n")[0] : String(e);
    return { ok: false, error: `invalid YAML: ${msg}` };
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return { ok: false, error: "top level is not a YAML mapping" };
  }
  const result = (doc as Record<string, unknown>).result;
  if (result === undefined) return { ok: false, error: "no top-level `result:` key" };
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return { ok: false, error: "`result:` is empty or not a mapping" };
  }
  return { ok: true, envelope: "```yaml\n" + body.trimEnd() + "\n```" };
}

/**
 * Pull the worker's `result:` envelope out of the raw agy transcript.
 * Returns the envelope re-wrapped in a clean ```yaml fence, or null if none parses.
 * Scans only the tail; among candidates the LAST one that strictly parses wins (the final answer).
 */
export function extractResultEnvelope(output: string): string | null {
  if (!output) return null;
  const scan = output.length > TAIL_BYTES ? output.slice(-TAIL_BYTES) : output;

  // 1) Fenced code blocks (``` or ```` , optional yaml/yml lang). Take the LAST that strictly
  //    parses as an envelope (real YAML.parse + top-level result: mapping).
  const fenceRe = /(`{3,})[ \t]*(?:ya?ml)?[ \t]*\r?\n([\s\S]*?)\r?\n\1[ \t]*(?:\r?\n|$)/g;
  let m: RegExpExecArray | null;
  let last: string | null = null;
  while ((m = fenceRe.exec(scan)) !== null) {
    const p = parseEnvelopeStrict(m[2]);
    if (p.ok) last = p.envelope;
  }
  if (last !== null) return last;

  // 2) Loose fallback: a bare top-level `result:` (no fence). From the LAST such line to the end.
  const bareRe = /^result[ \t]*:/gm;
  let bare: RegExpExecArray | null;
  let lastIdx = -1;
  while ((bare = bareRe.exec(scan)) !== null) lastIdx = bare.index;
  if (lastIdx >= 0) {
    const p = parseEnvelopeStrict(scan.slice(lastIdx));
    if (p.ok) return p.envelope;
  }

  return null;
}

/**
 * The STRICT sidecar path: the worker wrote its envelope to a dedicated `result.yaml` SIDECAR —
 * a clean file, not the noisy transcript. We strictly YAML.parse + validate it (no mining, no
 * guessing). Returns the wrapped envelope, or null if absent/empty/invalid — in which case the
 * caller falls back to transcript extraction. (For the invalid-but-present case the caller can use
 * parseEnvelopeStrict directly to surface the error.)
 */
export function wrapSidecarEnvelope(content: string | null | undefined): string | null {
  const p = parseEnvelopeStrict(content);
  return p.ok ? p.envelope : null;
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
