import fs from "fs";
import path from "path";

/**
 * Loads a prompt from a file, performing placeholder substitution and trimming one trailing newline.
 *
 * @param relPath Relative path to the prompt file under PROMPTS_DIR.
 * @param vars Variables to substitute.
 * @returns The loaded and processed prompt string.
 */
export function loadPrompt(relPath: string, vars?: Record<string, string>): string {
  const promptsDir = process.env.ANTIGRAVITY_PROMPTS_DIR || path.resolve(import.meta.dir, "../../prompts");
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
