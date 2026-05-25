#!/usr/bin/env bun
// Generates the "available skills" index inside prompts/skills-catalog.md FROM the real
// skills/ directory, so the planner picks OPTIONAL skills by an accurate description (not a
// bare name) and the catalog can never list a phantom skill. Each entry = `name` + a short
// "what it is" pulled from the skill's SKILL.md frontmatter `description:`.
//
// Run:  bun run scripts/gen-skill-catalog.ts
// Writes between the <!-- SKILLS:START --> / <!-- SKILLS:END --> markers (creates them if absent).
import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";

const ROOT = join(import.meta.dir, "..");
const SKILLS_DIR = join(ROOT, "skills");
const CATALOG = join(ROOT, "prompts", "skills-catalog.md");
const START = "<!-- SKILLS:START -->";
const END = "<!-- SKILLS:END -->";

function frontmatter(md: string): Record<string, unknown> {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  try {
    return (parseYaml(m[1]) as Record<string, unknown>) || {};
  } catch {
    return {};
  }
}

// A short (<=110 char) "what it is" — the lead text before the "Use when/Trigger" keyword dump.
function shorten(desc: string): string {
  let s = desc.replace(/\s+/g, " ").trim();
  s = s.split(/\bUse when\b|\bUse for\b|\bTrigger/i)[0].trim();
  s = s.replace(/[.\s]+$/, "");
  if (s.length > 110) {
    const dot = s.indexOf(". ");
    s = dot > 0 && dot < 110 ? s.slice(0, dot) : s.slice(0, 107) + "…";
  }
  return s;
}

type Skill = { name: string; desc: string; group: string };
const skills: Skill[] = [];
for (const dir of readdirSync(SKILLS_DIR).sort()) {
  const p = join(SKILLS_DIR, dir, "SKILL.md");
  if (!existsSync(p)) continue;
  const fm = frontmatter(readFileSync(p, "utf-8"));
  const stacks = Array.isArray(fm.stacks) ? fm.stacks.map(String) : [];
  const tags = Array.isArray(fm.tags) ? fm.tags.map(String) : [];
  let group = stacks.find((s) => s !== "stack-agnostic") || stacks[0] || tags[0] || "other";
  if (group === "stack-agnostic") group = "general";
  skills.push({
    name: typeof fm.name === "string" ? fm.name : dir,
    desc: typeof fm.description === "string" ? shorten(fm.description) : "",
    group,
  });
}

const byGroup = new Map<string, Skill[]>();
for (const s of skills) {
  if (!byGroup.has(s.group)) byGroup.set(s.group, []);
  byGroup.get(s.group)!.push(s);
}

let out = `${START}\n## Available skills — pick OPTIONAL ones by description\n\n`;
out += `> Auto-generated from skills/*/SKILL.md by \`scripts/gen-skill-catalog.ts\` — ${skills.length} skills. `;
out += `Role DEFAULTS load automatically (baked into each worker prompt); put ONLY task-specific picks in \`skill_hints\`.\n\n`;
for (const group of [...byGroup.keys()].sort()) {
  out += `**${group}**\n`;
  for (const s of byGroup.get(group)!.sort((a, b) => a.name.localeCompare(b.name))) {
    out += `- \`${s.name}\`${s.desc ? " — " + s.desc : ""}\n`;
  }
  out += "\n";
}
out = out.trimEnd() + "\n" + END;

let cat = readFileSync(CATALOG, "utf-8");
const a = cat.indexOf(START);
const b = cat.indexOf(END);
if (a >= 0 && b > a) {
  cat = cat.slice(0, a) + out + cat.slice(b + END.length);
} else {
  cat = cat.trimEnd() + "\n\n---\n\n" + out + "\n";
}
writeFileSync(CATALOG, cat);
console.log(`gen-skill-catalog: wrote ${skills.length} skills into prompts/skills-catalog.md`); // guardian: allow — CLI generator output
