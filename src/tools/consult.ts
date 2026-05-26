import { runAgy, getNewestConversationId } from "../utils/agy.ts";
import { captureGitFiles, buildFooter } from "../utils/observability.ts";
import { loadPrompt } from "../utils/prompts.ts";

// consult_antigravity — the ADVISORY sibling of the prose tools (get_programming_advice /
// review_code_changes). It returns a structured PROSE consultation, NEVER a task-contract plan
// and NEVER a YAML `result:` envelope. That separation is the whole point: the async+worker path
// always forces an envelope (and worker-planner forces contracts), which is what dragged plain
// consultations into "planning mode". This tool never touches that machinery.
//
// Differences from get_programming_advice: it loads the consultant persona, supports an optional
// conversationId for multi-turn consulting, and an optional cwd so the consultant can read the
// TARGET project's files (consultations are usually ABOUT a specific repo).
export async function handleConsultAntigravity(args: any) { // guardian: allow — dynamic MCP tool args, validated at use
  const prompt = String(args?.prompt || "");
  if (!prompt) {
    return { content: [{ type: "text", text: "Error: prompt is required" }], isError: true };
  }
  const context = args?.context ? String(args.context) : "";
  const conversationId = args?.conversationId ? String(args.conversationId) : null;
  const effectiveCwd = args?.cwd ? String(args.cwd) : (process.env.PWD || process.cwd());
  const userSkills = Array.isArray(args?.skills) ? args.skills.map(String) : [];

  // ALWAYS-ON consulting methodology + OPTIONAL caller-provided topical skills.
  // `consultant-craft` carries the whole consulting discipline (Block + Minto + research protocol
  // + format + isolation) so the consultant works as a neutral EXTERNAL advisor by default —
  // independent of the caller's project playbook. Topical skills like `architecture-craft` are
  // injected ONLY when the caller passes them explicitly (i.e. wants the consultation grounded in
  // their internal methodology); the consultant never auto-loads them.
  const skills = userSkills.includes("consultant-craft")
    ? userSkills
    : ["consultant-craft", ...userSkills];

  const systemPrompt = loadPrompt("tools/consultant.md");

  let promptToSend = `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${systemPrompt}]\n\n`;
  // skills is always non-empty (consultant-craft is the floor), so the directive always fires.
  promptToSend += `Перед ответом прочти SKILL.md этих методологий (агеишная папка скиллов — ~/.agents/skills/<имя>/SKILL.md) и опирайся на них, называя применяемый принцип: ${skills.join(", ")}\n\n`;
  if (context) {
    promptToSend += `Контекст (проект / спецификация / ограничения):\n${context}\n\n`;
  }
  promptToSend += `Запрос на консультацию:\n${prompt}`;

  // Multi-turn: resume an existing consultation thread, or start a fresh non-continuing one.
  const cmdArgs = ["--dangerously-skip-permissions", "--print"];
  if (conversationId) {
    cmdArgs.push("--conversation", conversationId);
  } else {
    cmdArgs.push("--continue=false");
  }

  let filesBefore: string[] = [];
  try {
    filesBefore = captureGitFiles(effectiveCwd);
  } catch (e) {
    // soft-fail
  }
  const t0 = Date.now();

  try {
    const responseText = await runAgy(cmdArgs, promptToSend, 2, effectiveCwd);

    let footer = "";
    try {
      const filesAfter = captureGitFiles(effectiveCwd);
      footer = buildFooter(filesBefore, filesAfter, Date.now() - t0);
    } catch (e) {
      try {
        footer = `<!-- agy: ${((Date.now() - t0) / 1000).toFixed(1)}s -->`;
      } catch (e2) {
        footer = "";
      }
    }

    // Surface the conversation id so a follow-up consultation can continue the same thread
    // by passing it back as conversationId. Best-effort — never block the answer on it.
    let sessionId = conversationId;
    if (!sessionId) {
      try { sessionId = getNewestConversationId(); } catch { sessionId = null; }
    }
    const sessionComment = `<!-- consult_session_id: ${sessionId || "new"} -->`;

    const returnText = footer
      ? `${responseText}\n\n${sessionComment}\n${footer}`
      : `${responseText}\n\n${sessionComment}`;

    return {
      content: [
        {
          type: "text",
          text: returnText,
        }
      ]
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `Ошибка при консультации с Antigravity: ${err instanceof Error ? err.message : String(err)}`,
        }
      ],
      isError: true
    };
  }
}
