import { loadPrompt } from "./utils/prompts.ts";

export function getRolePreset(role: string): string | undefined {
  const known = new Set(["designer", "copywriter", "programmer", "architect"]);
  const key = role.toLowerCase();
  if (!known.has(key)) return undefined;
  return loadPrompt(`roles/${key}.md`);
}


