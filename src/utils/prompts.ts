import fs from "fs";
import path from "path";

function resolvePromptsDir(): string {
  if (process.env.ANTIGRAVITY_PROMPTS_DIR) return process.env.ANTIGRAVITY_PROMPTS_DIR;
  // walk up from import.meta.dir looking for a directory that contains a "prompts" subdir
  let dir = import.meta.dir;
  while (true) {
    const candidate = path.join(dir, "prompts");
    try {
      if (fs.statSync(candidate).isDirectory()) return candidate;
    } catch { /* not here */ }
    const parent = path.dirname(dir);
    if (parent === dir) break;   // reached filesystem root
    dir = parent;
  }
  // fallback: previous behavior
  return path.resolve(import.meta.dir, "../../prompts");
}

/**
 * Loads a prompt from a file, performing placeholder substitution and trimming one trailing newline.
 *
 * @param relPath Relative path to the prompt file under PROMPTS_DIR.
 * @param vars Variables to substitute.
 * @returns The loaded and processed prompt string.
 */
export function loadPrompt(relPath: string, vars?: Record<string, string>): string {
  const promptsDir = resolvePromptsDir();
  const absPath = path.join(promptsDir, relPath);

  let content: string;
  try {
    content = fs.readFileSync(absPath, "utf-8");
  } catch (err: any) {
    if (err && err.code === "ENOENT") {
      throw new Error(`prompt file not found: ${absPath}`);
    }
    throw err;
  }

  // Trim exactly one trailing newline if present (\r\n or \n)
  if (content.endsWith("\r\n")) {
    content = content.slice(0, -2);
  } else if (content.endsWith("\n")) {
    content = content.slice(0, -1);
  }

  // Perform placeholder substitutions
  if (vars) {
    for (const key of Object.keys(vars)) {
      const placeholder = `{{${key}}}`;
      const value = String(vars[key]);
      content = content.split(placeholder).join(value);
    }
  }

  return content;
}
