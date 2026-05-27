// Regression coverage for the by-reference dispatch helper: readTaskRow reads
// the contract YAML from a project's orchestrator.db (SQLite). Used by the
// async_start handler when callers dispatch by task_id instead of inlining the
// full contract in the MCP prompt argument.
//
// This file does NOT import test-setup.ts — that module installs a global
// `mock.module("fs", ...)` shim which blocks real bun:sqlite from opening files
// on disk. We use real fs + real bun:sqlite to mirror production.

import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { readTaskRow, buildDispatchPreamble } from "./orchestrator-db.ts";

// File-system ops via Bun native APIs (Bun.spawnSync / Bun.write) to bypass
// the global `mock.module("fs", ...)` installed by test-setup.ts when the full
// suite runs. JS-level fs/node:fs are intercepted; Bun.* APIs are native and
// hit real disk — same as bun:sqlite's Database, which the production code
// under test (orchestrator-db.ts) also uses. This keeps the test honest.

function shell(...argv: string[]): void {
  Bun.spawnSync(argv);
}

function joinPath(...parts: string[]): string {
  return parts.join("/").replace(/\/+/g, "/");
}

const TMP_ROOT = "/tmp";

interface Fixture {
  readonly cwd: string;
  readonly cleanup: () => void;
}

function makeProjectFixture(): Fixture {
  const cwd = joinPath(TMP_ROOT, `agy-orch-db-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`); // guardian: allow — disposable tmp dir
  shell("mkdir", "-p", joinPath(cwd, ".claude"));
  Bun.write(joinPath(cwd, ".gitignore"), ".claude/orchestrator.db*\n");

  const dbPath = joinPath(cwd, ".claude", "orchestrator.db");
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE tasks (
      id              TEXT PRIMARY KEY,
      parent_id       TEXT,
      title           TEXT NOT NULL,
      contract_yaml   TEXT NOT NULL,
      status          TEXT NOT NULL CHECK(status IN
                        ('pending','assigned','in_progress','review','done','failed','blocked')),
      assignee_agent  TEXT,
      risk_class      TEXT NOT NULL DEFAULT 'low' CHECK(risk_class IN ('low','medium','high')),
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      started_at      TEXT,
      completed_at    TEXT
    );
  `);
  db.prepare(
    "INSERT INTO tasks (id, title, contract_yaml, status, assignee_agent, risk_class) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(
    "TASK-FIXTURE-001",
    "Wire a new handler",
    "id: TASK-FIXTURE-001\nscope: |\n  Add POST /v1/foo.\n",
    "pending",
    "worker-coder",
    "medium"
  );
  db.close();

  return {
    cwd,
    cleanup: () => {
      try { shell("rm", "-rf", cwd); } catch { /* best-effort */ }
    },
  };
}

describe("readTaskRow — by-reference contract resolution", () => {
  let fixture: Fixture | null = null;

  beforeEach(() => {
    fixture = makeProjectFixture();
  });

  afterEach(() => {
    fixture?.cleanup();
    fixture = null;
  });

  test("returns the row when task_id matches", () => {
    const row = readTaskRow(fixture!.cwd, "TASK-FIXTURE-001");
    expect(row).not.toBeNull();
    expect(row!.id).toBe("TASK-FIXTURE-001");
    expect(row!.title).toBe("Wire a new handler");
    expect(row!.contract_yaml).toContain("POST /v1/foo");
    expect(row!.status).toBe("pending");
    expect(row!.assignee_agent).toBe("worker-coder");
    expect(row!.risk_class).toBe("medium");
  });

  test("returns null when task_id is unknown", () => {
    const row = readTaskRow(fixture!.cwd, "TASK-NOT-THERE");
    expect(row).toBeNull();
  });

  test("rejects task_id with invalid shape (path-traversal guard)", () => {
    expect(() => readTaskRow(fixture!.cwd, "../etc/passwd")).toThrow(/invalid task_id/);
    expect(() => readTaskRow(fixture!.cwd, "a b c")).toThrow(/invalid task_id/);
    expect(() => readTaskRow(fixture!.cwd, "name; DROP TABLE")).toThrow(/invalid task_id/);
  });

  test("rejects non-absolute cwd", () => {
    expect(() => readTaskRow("relative/path", "TASK-FIXTURE-001")).toThrow(/must be absolute/);
  });

  test("non-existent cwd surfaces as 'orchestrator.db not found' (helpful error)", () => {
    expect(() => readTaskRow("/tmp/this-path-does-not-exist-zzz-" + Date.now(), "TASK-FIXTURE-001"))
      .toThrow(/orchestrator\.db not found/);
  });

  test("cwd without orchestrator.db → 'orchestrator.db not found'", () => {
    const bare = joinPath(TMP_ROOT, `agy-orch-db-bare-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`); // guardian: allow — disposable tmp dir
    shell("mkdir", "-p", bare);
    try {
      expect(() => readTaskRow(bare, "TASK-FIXTURE-001")).toThrow(/orchestrator\.db not found/);
    } finally {
      shell("rm", "-rf", bare);
    }
  });
});

describe("buildDispatchPreamble — minimal payload for by-reference dispatch", () => {
  test("preamble carries the pointer + DB-flow instructions, NOT the contract content", () => {
    const out = buildDispatchPreamble({
      taskId: "TASK-FIXTURE-001",
      cwd: "/home/x/proj",
      skillsCsv: "typescript, ports-and-adapters",
      assigneeAgent: "worker-coder",
      title: "Wire a new handler",
    });

    expect(out).toContain("TASK_ID: TASK-FIXTURE-001");
    expect(out).toContain("cwd: /home/x/proj");
    expect(out).toContain("title: Wire a new handler");
    expect(out).toContain("assignee_agent: worker-coder");
    expect(out).toContain("skill_hints: typescript, ports-and-adapters");
    expect(out).toContain("task export TASK-FIXTURE-001");
    expect(out).toContain("task save-artifact TASK-FIXTURE-001 --kind result");
    expect(out).toContain("task update TASK-FIXTURE-001 --status done");
    expect(out).toContain("operate ONLY on TASK-FIXTURE-001");
    // Compactness: this must stay short — the whole point of by-reference is to KEEP
    // the orchestrator's conversation history small. Cap at 700 chars (very generous).
    expect(out.length).toBeLessThan(700);
  });

  test("preamble omits optional fields when absent", () => {
    const out = buildDispatchPreamble({
      taskId: "TASK-2",
      cwd: "/x",
      skillsCsv: "",
    });
    expect(out).not.toContain("title:");
    expect(out).not.toContain("assignee_agent:");
    expect(out).not.toContain("skill_hints:");
    expect(out).toContain("TASK_ID: TASK-2");
  });
});
