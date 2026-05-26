import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { resolvePromptsDir } from "../utils/prompts.ts";

export interface Skill {
  name: string;
  category: string;
  description: string;
  file_path: string;
}

export function parseSkillCatalog(catalogPath: string, skillsDir: string): {
  skills: Skill[];
  warnings: string[];
  error?: string;
} {
  let content: string;
  try {
    content = fs.readFileSync(catalogPath, "utf-8");
  } catch (err: any) {
    if (err && err.code === "ENOENT") {
      return {
        skills: [],
        warnings: [],
        error: `skills catalog not found at ${catalogPath}`
      };
    }
    throw err;
  }

  const lines = content.split(/\r?\n/);
  const startIndex = lines.findIndex(line => line.includes("<!-- SKILLS:START -->"));
  const endIndex = lines.findIndex(line => line.includes("<!-- SKILLS:END -->"));

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    return {
      skills: [],
      warnings: ["markers not found"]
    };
  }

  const skills: Skill[] = [];
  const warnings: string[] = [];
  let currentCategory = "";

  const categoryRegex = /^\*\*(.+?)\*\*$/;
  const bulletRegex = /^-\s+`([^`]+)`\s+[—-]\s+(.+)$/;

  for (let i = startIndex + 1; i < endIndex; i++) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }

    const catMatch = line.match(categoryRegex);
    if (catMatch) {
      currentCategory = catMatch[1];
      continue;
    }

    const bulletMatch = line.match(bulletRegex);
    if (bulletMatch) {
      const name = bulletMatch[1];
      const description = bulletMatch[2].trim();
      const filePath = path.join(skillsDir, name, "SKILL.md");
      skills.push({
        name,
        category: currentCategory,
        description,
        file_path: filePath
      });
      continue;
    }

    if (line.startsWith("- ")) {
      warnings.push(`malformed bullet: ${line}`);
    }
  }

  return {
    skills,
    warnings
  };
}

export async function handleGetSkillCatalog(args?: { name?: string; category?: string }) {
  const catalogPath = path.join(resolvePromptsDir(), "skills-catalog.md");
  const homeDir = process.env.HOME ?? os.homedir();
  const skillsDir = process.env.AGY_SKILLS_DIR ?? path.join(homeDir, ".agents/skills");

  const parsed = parseSkillCatalog(catalogPath, skillsDir);
  if (parsed.error) {
    return {
      isError: true,
      content: [{ type: "text", text: parsed.error }]
    };
  }

  let skills = parsed.skills;
  if (args?.name) {
    skills = skills.filter(s => s.name === args.name);
  } else if (args?.category) {
    const cat = args.category.toLowerCase();
    skills = skills.filter(s => s.category.toLowerCase().includes(cat));
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ skills, total: skills.length, warnings: parsed.warnings }, null, 2)
      }
    ]
  };
}
