import { describe, test, expect } from "bun:test";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

// Guards the skill system against drift: every DEFAULT skill a worker auto-loads must exist on
// disk (no phantom defaults), and every bundled skill must be well-formed (has a description:
// frontmatter, so scripts/gen-skill-catalog.ts can surface it to the planner).
const ROOT = join(import.meta.dir, "..");
const SKILLS = join(ROOT, "skills");
const WORKERS = join(ROOT, "prompts", "workers");

const skillExists = (name: string) => existsSync(join(SKILLS, name, "SKILL.md"));

describe("skill sync", () => {
  test("every worker DEFAULT (Always:) skill exists in skills/", () => {
    const missing: string[] = [];
    for (const f of readdirSync(WORKERS).filter((x) => x.endsWith(".md"))) {
      const md = readFileSync(join(WORKERS, f), "utf-8");
      const line = md.split(/\r?\n/).find((l) => /Always:/i.test(l)) || "";
      const names = (line.match(/`[a-z0-9][a-z0-9-]*`/g) || []).map((s) => s.replace(/`/g, ""));
      for (const n of names) if (!skillExists(n)) missing.push(`${f}: ${n}`);
    }
    expect(missing).toEqual([]);
  });

  test("every bundled skill has a SKILL.md with a description: frontmatter", () => {
    const bad: string[] = [];
    for (const e of readdirSync(SKILLS, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const p = join(SKILLS, e.name, "SKILL.md");
      if (!existsSync(p)) {
        bad.push(`${e.name}: no SKILL.md`);
        continue;
      }
      if (!/^---[\s\S]*?\ndescription:/m.test(readFileSync(p, "utf-8"))) bad.push(`${e.name}: no description:`);
    }
    expect(bad).toEqual([]);
  });
});
