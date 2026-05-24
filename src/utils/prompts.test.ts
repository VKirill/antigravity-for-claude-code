import { describe, it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import fs from "fs";
import path from "path";
import os from "os";
import { loadPrompt } from "./prompts.ts";

describe("prompts utility", () => {
  let tempDirs: string[] = [];
  let originalPromptsDir: string | undefined;

  beforeEach(() => {
    originalPromptsDir = process.env.ANTIGRAVITY_PROMPTS_DIR;
  });

  afterEach(() => {
    if (originalPromptsDir !== undefined) {
      process.env.ANTIGRAVITY_PROMPTS_DIR = originalPromptsDir;
    } else {
      delete process.env.ANTIGRAVITY_PROMPTS_DIR;
    }
  });

  afterAll(() => {
    // Clean up all temporary directories
    for (const dir of tempDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (e) {
        // ignore
      }
    }
  });

  function createTempDir(): string {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "antigravity-prompts-test-"));
    tempDirs.push(tempDir);
    return tempDir;
  }

  it("should read a file's content correctly and trim exactly one trailing newline", () => {
    const tempDir = createTempDir();
    process.env.ANTIGRAVITY_PROMPTS_DIR = tempDir;

    const relPath = "test-prompt.md";
    const content = "Hello world\n";
    fs.writeFileSync(path.join(tempDir, relPath), content, "utf-8");

    const result = loadPrompt(relPath);
    expect(result).toBe("Hello world");
  });

  it("should not trim if there is no trailing newline", () => {
    const tempDir = createTempDir();
    process.env.ANTIGRAVITY_PROMPTS_DIR = tempDir;

    const relPath = "test-prompt-no-newline.md";
    const content = "Hello world";
    fs.writeFileSync(path.join(tempDir, relPath), content, "utf-8");

    const result = loadPrompt(relPath);
    expect(result).toBe("Hello world");
  });

  it("should trim exactly one trailing newline even if there are multiple newlines (leaving others intact)", () => {
    const tempDir = createTempDir();
    process.env.ANTIGRAVITY_PROMPTS_DIR = tempDir;

    const relPath = "test-prompt-multi-newline.md";
    const content = "Hello world\n\n";
    fs.writeFileSync(path.join(tempDir, relPath), content, "utf-8");

    const result = loadPrompt(relPath);
    expect(result).toBe("Hello world\n");
  });

  it("should prove FRESH read (no caching)", () => {
    const tempDir = createTempDir();
    process.env.ANTIGRAVITY_PROMPTS_DIR = tempDir;

    const relPath = "fresh-test.md";
    const filePath = path.join(tempDir, relPath);

    fs.writeFileSync(filePath, "Initial content\n", "utf-8");
    expect(loadPrompt(relPath)).toBe("Initial content");

    fs.writeFileSync(filePath, "Updated content\n", "utf-8");
    expect(loadPrompt(relPath)).toBe("Updated content");
  });

  it("should handle placeholder substitution and leave unknown placeholders intact", () => {
    const tempDir = createTempDir();
    process.env.ANTIGRAVITY_PROMPTS_DIR = tempDir;

    const relPath = "subst-test.md";
    const filePath = path.join(tempDir, relPath);

    fs.writeFileSync(filePath, "Hello {{name}}! Welcome to {{place}}. Unknown: {{ghost}}.\n", "utf-8");

    const result = loadPrompt(relPath, { name: "Alice", place: "Wonderland" });
    expect(result).toBe("Hello Alice! Welcome to Wonderland. Unknown: {{ghost}}.");
  });

  it("should throw a clear error when missing file", () => {
    const tempDir = createTempDir();
    process.env.ANTIGRAVITY_PROMPTS_DIR = tempDir;

    const relPath = "nonexistent.md";
    const absPath = path.join(tempDir, relPath);

    expect(() => loadPrompt(relPath)).toThrow(new Error(`prompt file not found: ${absPath}`));
  });

  it("should honor ANTIGRAVITY_PROMPTS_DIR override", () => {
    const tempDir1 = createTempDir();
    const tempDir2 = createTempDir();

    fs.writeFileSync(path.join(tempDir1, "test.md"), "Dir 1\n", "utf-8");
    fs.writeFileSync(path.join(tempDir2, "test.md"), "Dir 2\n", "utf-8");

    process.env.ANTIGRAVITY_PROMPTS_DIR = tempDir1;
    expect(loadPrompt("test.md")).toBe("Dir 1");

    process.env.ANTIGRAVITY_PROMPTS_DIR = tempDir2;
    expect(loadPrompt("test.md")).toBe("Dir 2");
  });

  it("should walk up and find real repo prompts/ when ANTIGRAVITY_PROMPTS_DIR is unset", () => {
    delete process.env.ANTIGRAVITY_PROMPTS_DIR;
    const result = loadPrompt("debate/optimist.md");
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });

  it("should prioritize ANTIGRAVITY_PROMPTS_DIR override over walk-up", () => {
    const tempDir = createTempDir();
    fs.mkdirSync(path.join(tempDir, "debate"), { recursive: true });
    fs.writeFileSync(path.join(tempDir, "debate/optimist.md"), "Override content\n", "utf-8");

    process.env.ANTIGRAVITY_PROMPTS_DIR = tempDir;
    const result = loadPrompt("debate/optimist.md");
    expect(result).toBe("Override content");
  });
});
