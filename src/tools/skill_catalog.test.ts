import { describe, test, expect, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { parseSkillCatalog, handleGetSkillCatalog } from "./skill_catalog.ts";
import { resolvePromptsDir } from "../utils/prompts.ts";

describe("Skill Catalog Parser", () => {
  const tempFiles: string[] = [];

  function createTempFile(content: string): string {
    const filename = path.join(os.tmpdir(), `sc-test-${Math.random().toString(36).slice(2)}.md`);
    fs.writeFileSync(filename, content, "utf-8");
    tempFiles.push(filename);
    return filename;
  }

  afterEach(() => {
    for (const file of tempFiles) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch {
        // ignore
      }
    }
    tempFiles.length = 0;
  });

  test("parser-happy: parser on real catalog returns >=100 skills", () => {
    const catalogPath = path.join(resolvePromptsDir(), "skills-catalog.md");
    const skillsDir = "/dummy/skills";
    const result = parseSkillCatalog(catalogPath, skillsDir);
    expect(result.error).toBeUndefined();
    expect(result.skills.length).toBeGreaterThanOrEqual(100);
    expect(result.warnings.length).toBe(0);
  });

  test("parser-enoent: parser on nonexistent file returns error, no throw", () => {
    const catalogPath = "/tmp/__no_such_catalog__.md";
    const skillsDir = "/dummy/skills";
    const result = parseSkillCatalog(catalogPath, skillsDir);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("skills catalog not found at");
    expect(result.skills.length).toBe(0);
  });

  test("parser-eisdir: parser on directory path re-throws EISDIR", () => {
    const catalogPath = os.tmpdir();
    const skillsDir = "/dummy/skills";
    expect(() => parseSkillCatalog(catalogPath, skillsDir)).toThrow();
  });

  test("parser-no-markers: parser returns empty + warning when markers are missing", () => {
    const content = `
# Title
Some body text without markers.
    `;
    const tempFile = createTempFile(content);
    const result = parseSkillCatalog(tempFile, "/dummy/skills");
    expect(result.skills.length).toBe(0);
    expect(result.warnings).toContain("markers not found");
  });

  test("parser-malformed: parses valid and warns/skips invalid bullets", () => {
    const content = `
<!-- SKILLS:START -->
**Category A**
- \`good-skill\` — A description of the good skill
- malformed line here
<!-- SKILLS:END -->
    `;
    const tempFile = createTempFile(content);
    const result = parseSkillCatalog(tempFile, "/dummy/skills");
    expect(result.skills.length).toBe(1);
    expect(result.skills[0].name).toBe("good-skill");
    expect(result.skills[0].description).toBe("A description of the good skill");
    expect(result.skills[0].category).toBe("Category A");
    expect(result.skills[0].file_path).toBe(path.join("/dummy/skills", "good-skill", "SKILL.md"));

    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("malformed bullet: - malformed line here");
  });
});

describe("Skill Catalog Handler", () => {
  test("handler-no-args: returns >=100 skills", async () => {
    const response = await handleGetSkillCatalog({});
    expect(response.isError).toBeUndefined();
    const data = JSON.parse(response.content[0].text);
    expect(data.skills.length).toBeGreaterThanOrEqual(100);
    expect(data.total).toBe(data.skills.length);
  });

  test("handler-name: returns exactly 1 skill when name is matched", async () => {
    const response = await handleGetSkillCatalog({ name: "typescript" });
    expect(response.isError).toBeUndefined();
    const data = JSON.parse(response.content[0].text);
    expect(data.skills.length).toBe(1);
    expect(data.skills[0].name).toBe("typescript");
    expect(data.skills[0].file_path.endsWith(path.join("typescript", "SKILL.md"))).toBe(true);
  });

  test("handler-category-case: category filtering is case-insensitive substring match", async () => {
    const response1 = await handleGetSkillCatalog({ category: "Testing" });
    const data1 = JSON.parse(response1.content[0].text);
    expect(data1.skills.length).toBe(3);
    const names1 = data1.skills.map((s: any) => s.name).sort();
    expect(names1).toEqual(["playwright", "pytest", "vitest"]);

    const response2 = await handleGetSkillCatalog({ category: "testing" });
    const data2 = JSON.parse(response2.content[0].text);
    expect(data2.skills.length).toBe(3);
    const names2 = data2.skills.map((s: any) => s.name).sort();
    expect(names2).toEqual(["playwright", "pytest", "vitest"]);

    const response3 = await handleGetSkillCatalog({ category: "TESTING" });
    const data3 = JSON.parse(response3.content[0].text);
    expect(data3.skills.length).toBe(data2.skills.length);
    const names3 = data3.skills.map((s: any) => s.name).sort();
    expect(names3).toEqual(names2);
  });

  test("handler-category-backend-data: category filtering for 'Backend & data' contains postgresql, prisma, and zod", async () => {
    const response = await handleGetSkillCatalog({ category: "Backend & data" });
    expect(response.isError).toBeUndefined();
    const data = JSON.parse(response.content[0].text);
    const names = data.skills.map((s: any) => s.name);
    expect(names).toContain("postgresql");
    expect(names).toContain("prisma");
    expect(names).toContain("zod");
  });

  test("handler-name-wins: name parameter takes priority over category", async () => {
    const response = await handleGetSkillCatalog({ name: "typescript", category: "testing" });
    const data = JSON.parse(response.content[0].text);
    expect(data.skills.length).toBe(1);
    expect(data.skills[0].name).toBe("typescript");
  });

  test("handler-no-match: returns empty list (total 0) and not an error when no matches", async () => {
    const response = await handleGetSkillCatalog({ category: "nonexistent-zzz" });
    expect(response.isError).toBeUndefined();
    const data = JSON.parse(response.content[0].text);
    expect(data.skills.length).toBe(0);
    expect(data.total).toBe(0);
  });

  test("handler-env: respects AGY_SKILLS_DIR override, defaults otherwise", async () => {
    const originalEnv = process.env.AGY_SKILLS_DIR;

    try {
      const overrideDir = "/custom/override/dir";
      process.env.AGY_SKILLS_DIR = overrideDir;
      const resOverride = await handleGetSkillCatalog({ name: "typescript" });
      const dataOverride = JSON.parse(resOverride.content[0].text);
      expect(dataOverride.skills[0].file_path).toBe(path.join(overrideDir, "typescript", "SKILL.md"));

      delete process.env.AGY_SKILLS_DIR;
      const resDefault = await handleGetSkillCatalog({ name: "typescript" });
      const dataDefault = JSON.parse(resDefault.content[0].text);
      const expectedPrefix = path.join(process.env.HOME ?? os.homedir(), ".agents/skills");
      expect(dataDefault.skills[0].file_path).toBe(path.join(expectedPrefix, "typescript", "SKILL.md"));
    } finally {
      if (originalEnv !== undefined) {
        process.env.AGY_SKILLS_DIR = originalEnv;
      } else {
        delete process.env.AGY_SKILLS_DIR;
      }
    }
  });
});
