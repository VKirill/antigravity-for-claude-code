import { describe, test, expect } from "bun:test";
import {
  extractResultEnvelope,
  synthesizeFailureEnvelope,
  formatWorkerResult,
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
