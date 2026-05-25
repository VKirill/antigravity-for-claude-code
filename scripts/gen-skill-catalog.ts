#!/usr/bin/env bun
// Generates the "available skills" index inside prompts/skills-catalog.md FROM the skills the
// workers actually load — so the planner picks OPTIONAL skills by an accurate description (not a
// bare name) and the catalog can never list a skill that can't be loaded.
//
// Source dir (first that applies):
//   1. $AGENTS_SKILLS_DIR   2. ~/.agents/skills (the runtime load dir)   3. <repo>/skills (bundle)
//
// Each entry = `name` + a short "what it is" from its SKILL.md `description:`, grouped into human
// categories (matched by NAME). Run: bun run scripts/gen-skill-catalog.ts
// (writes between the <!-- SKILLS:START --> / <!-- SKILLS:END --> markers).
import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";

const ROOT = join(import.meta.dir, "..");
const HOME = process.env.HOME || "";
const SKILLS_DIR =
  process.env.AGENTS_SKILLS_DIR ||
  (HOME && existsSync(join(HOME, ".agents/skills")) ? join(HOME, ".agents/skills") : join(ROOT, "skills"));
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
  const flat = desc.replace(/\s+/g, " ").trim();
  const lead = flat.split(/\bUse when\b|\bUse for\b|\bTrigger/i)[0].trim().replace(/[.\s]+$/, "");
  let s = lead || flat; // fallback: a desc that is ONLY "Use when…" keeps its raw text
  if (s.length > 110) {
    const dot = s.indexOf(". ");
    s = dot > 0 && dot < 110 ? s.slice(0, dot) : s.slice(0, 107) + "…";
  }
  return s;
}

// First matching rule (order matters) on the NAME → human category. Name-only (not tags) so a
// framework tagged with its language (e.g. django tagged `python`) lands in Backend, not Languages.
const CATEGORY_RULES: [string, RegExp][] = [
  ["Core craft & discipline", /(karpathy|coder-craft|frontend-craft|architecture-craft|data-systems-craft|^refactoring$|refactor-hotspots|review-craft|debugging-craft|systematic-debugging|(^|-)tdd$|testing-craft|logging-standards|ru-text|brainstorm|orchestrator-workflow|project-architect|cybersecurity|security-audit|backend-security)/],
  ["Testing", /(^pytest|^vitest|^playwright|^jest|cypress)/],
  ["Frontend & UI", /(react|^vue|nextjs|nuxt|astro|svelte|tailwind|shadcn|(^|-)css|(^|-)ui-|ux-|design-system|web-animation|webgl|svg-canvas|web-qa|frontend|i18n|tanstack|expo|accessibility)/],
  ["Backend & data", /(nodejs|fastify|hono|fastapi|django|nestjs|express|better-auth|bullmq|prisma|drizzle|sqlalchemy|postgres|redis|nosql|graphql|api-patterns|database|^zod$|pydantic|httpx|backend|(^|-)orm|queue|microservices)/],
  ["Data science & ML", /(numpy|pandas|polars|pytorch|scikit|transformers|tensorflow|cuda|jupyter)/],
  ["AI / agents / MCP", /(agent|(^|-)mcp|langchain|claude-code|^codex|opencode|skill-eval)/],
  ["Infra / cloud / sysadmin", /(linux|sysadmin|yandex-cloud|google-cloud|^aws|^gcp|docker|kubernetes|proxy)/],
  ["Integrations", /(telegram|^vk-|max-bridge|cloudpayments|yookassa|stripe|payment|webhook)/],
  ["Marketing, SEO & content", /(marketing|(^|-)smm|copywrit|(^|-)ad-|creative|(^|-)brand|audience|competitor|legal-ru|senior-marketer|design-studio|slides|^ckm:|yandex-direct|google-ads|google-search|search-console|metrika|metrica|webmaster|(^|-)seo|ga4|(^|-)gtm|xmlstock|mutagen|social-platforms|discovery-interview)/],
  ["Tooling & VCS", /((^|-)git$|gitnexus|^biome|eslint|prettier|^vite$|(^|-)lint|(^|-)vcs)/],
  ["Languages", /(typescript|^python|javascript|c-pro|cpp-pro|csharp-pro|php-pro|sql-pro|go-pro|^go$|^rust|java-pro|kotlin|swift|ruby)/],
  ["Media", /(remotion|media-asset|ffmpeg|^video|image-|banana)/],
];
function categorize(name: string): string {
  const n = name.toLowerCase();
  for (const [cat, re] of CATEGORY_RULES) if (re.test(n)) return cat;
  return "Other";
}
const CATEGORY_ORDER = [...CATEGORY_RULES.map(([c]) => c), "Other"];

type Skill = { name: string; desc: string; cat: string };
const skills: Skill[] = [];
for (const dir of readdirSync(SKILLS_DIR).sort()) {
  const p = join(SKILLS_DIR, dir, "SKILL.md");
  if (!existsSync(p)) continue;
  const fm = frontmatter(readFileSync(p, "utf-8"));
  if (typeof fm.description !== "string") continue; // skip malformed entries
  const name = typeof fm.name === "string" ? fm.name : dir;
  skills.push({ name, desc: shorten(fm.description), cat: categorize(name) });
}

const byCat = new Map<string, Skill[]>();
for (const s of skills) {
  if (!byCat.has(s.cat)) byCat.set(s.cat, []);
  byCat.get(s.cat)!.push(s);
}

let out = `${START}\n## Available skills — pick OPTIONAL ones by description\n\n`;
out += `> Auto-generated from the worker skill dir by \`scripts/gen-skill-catalog.ts\` — ${skills.length} skills. `;
out += `Role DEFAULTS load automatically (baked into each worker prompt); put ONLY task-specific picks in \`skill_hints\`.\n\n`;
for (const cat of CATEGORY_ORDER) {
  const list = byCat.get(cat);
  if (!list || list.length === 0) continue;
  out += `**${cat}**\n`;
  for (const s of list.sort((a, b) => a.name.localeCompare(b.name))) {
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
console.log(`gen-skill-catalog: ${skills.length} skills from ${SKILLS_DIR} → prompts/skills-catalog.md`); // guardian: allow — CLI generator output
