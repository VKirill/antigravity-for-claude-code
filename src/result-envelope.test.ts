import { describe, test, expect } from "bun:test";
import {
  extractResultEnvelope,
  synthesizeFailureEnvelope,
  formatWorkerResult,
  wrapSidecarEnvelope,
  parseEnvelopeStrict,
} from "./utils/result-envelope.ts";

describe("extractResultEnvelope", () => {
  test("pulls the fenced ```yaml result: block out of a full transcript", () => {
    const transcript = [
      "Let me analyze the codebase.",
      "[tool] gitnexus_query('clamp') -> no match",
      "Now I'll write the function and the test.",
      "```yaml",
      "result:",
      "  status: done",
      "  summary: |",
      "    Added clamp() and a unit test.",
      "  artifacts:",
      "    - src/utils/clamp.ts",
      "```",
    ].join("\n");
    const env = extractResultEnvelope(transcript);
    expect(env).not.toBeNull();
    expect(env).toContain("result:");
    expect(env).toContain("status: done");
    expect(env).toContain("src/utils/clamp.ts");
    // crucially: the reasoning/tool-call noise is dropped
    expect(env).not.toContain("Let me analyze");
    expect(env).not.toContain("gitnexus_query");
  });

  test("supports 4-backtick fences", () => {
    const t = "intro\n````yaml\nresult:\n  status: planned\n````\ntrailer";
    const env = extractResultEnvelope(t);
    expect(env).toContain("status: planned");
    expect(env).not.toContain("trailer");
    expect(env).not.toContain("intro");
  });

  test("when several result blocks exist, the LAST one wins", () => {
    const t = [
      "```yaml",
      "result:",
      "  status: paused   # an earlier echoed example",
      "```",
      "...more work...",
      "```yaml",
      "result:",
      "  status: done",
      "```",
    ].join("\n");
    const env = extractResultEnvelope(t)!;
    expect(env).toContain("status: done");
    expect(env).not.toContain("status: paused");
  });

  test("ignores fenced yaml blocks that have no top-level result: key", () => {
    const t = "```yaml\nfoo:\n  bar: 1\n```";
    expect(extractResultEnvelope(t)).toBeNull();
  });

  test("loose fallback: bare result: with no fence", () => {
    const t = "some prose\nresult:\n  status: done\n  summary: ok";
    const env = extractResultEnvelope(t)!;
    expect(env).toContain("```yaml");
    expect(env).toContain("status: done");
    expect(env).not.toContain("some prose");
  });

  test("returns null for empty or envelope-less output", () => {
    expect(extractResultEnvelope("")).toBeNull();
    expect(extractResultEnvelope("agent executor error\nstack trace...")).toBeNull();
  });

  test("dedents an indented envelope to valid top-level YAML", () => {
    const t = "```yaml\n  result:\n    status: done\n```";
    const env = extractResultEnvelope(t)!;
    expect(env).toContain("\nresult:"); // dedented to column 0
    expect(env).toContain("status: done");
  });

  test("rejects a truncated result: with no payload", () => {
    expect(extractResultEnvelope("```yaml\nresult:\n```")).toBeNull();
  });

  test("scans a large transcript tail without hanging (ReDoS guard)", () => {
    const junk = "x".repeat(70 * 1024);
    const env = extractResultEnvelope(junk + "\n```yaml\nresult:\n  status: done\n```")!;
    expect(env).toContain("status: done");
  });
});

describe("synthesizeFailureEnvelope", () => {
  test("builds a structured failed envelope with the crash marker + tail, no file reference", () => {
    const out = "step 1 ok\nstep 2 ok\nagent executor error: boom";
    const env = synthesizeFailureEnvelope(out, "agent executor error");
    expect(env).toContain("status: failed");
    expect(env).toContain("agent executor error");
    expect(env).toContain("failure_excerpt:");
    expect(env).toContain("step 1 ok");
    expect(env).not.toContain("output.txt");
    expect(env).not.toContain(".claude/jobs");
  });

  test("falls back to a generic reason when no crash marker", () => {
    const env = synthesizeFailureEnvelope("partial...", null);
    expect(env).toContain("status: failed");
    expect(env).toContain("no result: envelope");
  });

  test("handles empty output without an excerpt block", () => {
    const env = synthesizeFailureEnvelope("", "KAPUT");
    expect(env).toContain("status: failed");
    expect(env).not.toContain("failure_excerpt:");
  });

  test("neutralises stray fences in the excerpt so they can't break the block scalar", () => {
    const env = synthesizeFailureEnvelope("```\nrogue fence\n```", "boom");
    expect(env).toContain("rogue fence");
    expect(env).toContain("'''"); // the rogue ``` fences were rewritten to '''
    // the only triple-backtick runs left are the wrapper's open (```yaml) + close (```)
    expect((env.match(/```/g) || []).length).toBe(2);
  });
});

describe("formatWorkerResult", () => {
  test("default returns only the envelope, not the transcript", () => {
    const transcript = "noise noise\n```yaml\nresult:\n  status: done\n```";
    const out = formatWorkerResult({ output: transcript });
    expect(out).toContain("status: done");
    expect(out).not.toContain("noise noise");
  });

  test("full:true returns the complete raw transcript unchanged", () => {
    const transcript = "noise noise\n```yaml\nresult:\n  status: done\n```";
    expect(formatWorkerResult({ output: transcript, full: true })).toBe(transcript);
  });

  test("no envelope -> synthesized failure envelope (orchestrator can still gate on status)", () => {
    const out = formatWorkerResult({ output: "agent executor error", crashMarker: "agent executor error" });
    expect(out).toContain("status: failed");
    expect(out).toContain("agent executor error");
  });

  test("crashMarker present -> synthesizes failure even when an envelope-looking block exists", () => {
    const out = formatWorkerResult({
      output: "```yaml\nresult:\n  status: done\n```",
      crashMarker: "agent executor error",
    });
    // verdict is the synthesized failure, NOT the worker's (untrusted) done block — the raw
    // "status: done" only survives inside the failure_excerpt as evidence.
    expect(out).toContain("status: failed");
    expect(out).toContain("Worker emitted no result: envelope");
    expect(out).toContain("agent executor error");
  });
});

describe("wrapSidecarEnvelope (strict result.yaml path)", () => {
  test("accepts a clean bare envelope and wraps it", () => {
    const env = wrapSidecarEnvelope("result:\n  status: done\n  summary: ok")!;
    expect(env).toContain("```yaml");
    expect(env).toContain("status: done");
  });

  test("tolerates the worker wrapping the file in a ```yaml fence", () => {
    const env = wrapSidecarEnvelope("```yaml\nresult:\n  status: planned\n```")!;
    expect(env).toContain("status: planned");
    // no double fence — exactly the wrapper open + close
    expect((env.match(/```/g) || []).length).toBe(2);
  });

  test("dedents an indented sidecar to valid top-level YAML", () => {
    const env = wrapSidecarEnvelope("  result:\n    status: done")!;
    expect(env).toContain("\nresult:");
    expect(env).toContain("status: done");
  });

  test("returns null for empty / whitespace / missing", () => {
    expect(wrapSidecarEnvelope("")).toBeNull();
    expect(wrapSidecarEnvelope("   \n  ")).toBeNull();
    expect(wrapSidecarEnvelope(null)).toBeNull();
    expect(wrapSidecarEnvelope(undefined)).toBeNull();
  });

  test("rejects a non-envelope or truncated sidecar (caller falls back)", () => {
    expect(wrapSidecarEnvelope("just some text")).toBeNull();
    expect(wrapSidecarEnvelope("foo:\n  bar: 1")).toBeNull();
    expect(wrapSidecarEnvelope("result:")).toBeNull(); // truncated, no payload
  });
});

describe("parseEnvelopeStrict (real YAML.parse)", () => {
  test("accepts a valid envelope", () => {
    const p = parseEnvelopeStrict("result:\n  status: done\n  summary: ok");
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.envelope).toContain("status: done");
  });

  test("rejects malformed YAML with a clear error", () => {
    const p = parseEnvelopeStrict("result:\n  items: [1, 2"); // unclosed flow sequence
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.error).toContain("invalid YAML");
  });

  test("rejects YAML that has no top-level result: key", () => {
    const p = parseEnvelopeStrict("foo:\n  bar: 1");
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.error).toContain("result:");
  });

  test("rejects result: that is empty or a scalar (not a mapping)", () => {
    expect(parseEnvelopeStrict("result:").ok).toBe(false);          // null
    expect(parseEnvelopeStrict("result: done").ok).toBe(false);     // scalar
    const p = parseEnvelopeStrict("result: done");
    if (!p.ok) expect(p.error).toContain("mapping");
  });

  test("rejects a top-level scalar (not a mapping)", () => {
    const p = parseEnvelopeStrict("just a string");
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.error).toContain("mapping");
  });

  test("rejects empty input", () => {
    expect(parseEnvelopeStrict("").ok).toBe(false);
    expect(parseEnvelopeStrict("   ").ok).toBe(false);
    expect(parseEnvelopeStrict(null).ok).toBe(false);
  });

  test("tolerates a stray ```yaml fence around the envelope", () => {
    const p = parseEnvelopeStrict("```yaml\nresult:\n  status: planned\n```");
    expect(p.ok).toBe(true);
    if (p.ok) expect((p.envelope.match(/```/g) || []).length).toBe(2);
  });
});
