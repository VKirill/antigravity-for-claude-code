import { sessionState } from "../state.ts";
import { runAgy } from "../utils/agy.ts";
import { captureGitFiles, buildFooter } from "../utils/observability.ts";
import { loadPrompt } from "../utils/prompts.ts";

export async function handleDiscussWithAntigravity(args: any) {
  const prompt = String(args?.prompt || "");
  
  // Auto-detect task ID from the prompt content if conversationId is not explicitly specified
  let conversationIdToUse = args?.conversationId ? String(args.conversationId) : null;
  
  if (!conversationIdToUse) {
    const taskMatch = prompt.match(/(?:^|\n)(?:id|task|task_id):\s*(TASK-\d+)/i) || prompt.match(/(?:id|task|task_id):\s*(TASK-\d+)/i);
    if (taskMatch) {
      conversationIdToUse = taskMatch[1];
    }
  }
  
  // Fallback to activeConversationId from memory if still not resolved
  if (!conversationIdToUse) {
    conversationIdToUse = sessionState.activeConversationId;
  }

  const worker = args?.worker ? String(args.worker) : null;
  const skills = Array.isArray(args?.skills) ? args.skills.map(String) : [];
  const skillsStr = skills.join(", ");

  let promptToSend = prompt;

  if (worker) {
    try {
      const wtext = loadPrompt(`workers/${worker}.md`, { skills: skillsStr });
      promptToSend = `${wtext}\n\n---\n\n${prompt}`;
    } catch (e) {
      return { content: [{ type: "text", text: `Error: worker prompt not found: ${worker}` }], isError: true };
    }
  } else {
    let systemPromptText = String(args?.systemPrompt || sessionState.pendingSystemPrompt || "");
    if (skills.length > 0) {
      systemPromptText = systemPromptText
        ? systemPromptText + "\n\nЗагрузи эти скиллы перед работой (прочти SKILL.md каждого): " + skillsStr
        : "Загрузи эти скиллы перед работой (прочти SKILL.md каждого): " + skillsStr;
    }
    if (!conversationIdToUse) {
      if (systemPromptText) {
        promptToSend = `[СИСТЕМНЫЙ ПРОМПТ: ${systemPromptText}]\n\n${prompt}`;
      }
      // Clear pending configurations as they are now consumed
      sessionState.pendingSystemPrompt = null;
    }
  }

  const cmdArgs = ["--dangerously-skip-permissions", "--print"];
  if (conversationIdToUse) {
    cmdArgs.push("--conversation", conversationIdToUse);
  } else {
    cmdArgs.push("--continue=false");
  }

  let cwd = ".";
  try { cwd = process.env.PWD || process.cwd(); } catch { /* soft-fail */ }
  let filesBefore: string[] = [];
  try {
    filesBefore = captureGitFiles(cwd);
  } catch (e) {
    // soft-fail
  }
  const t0 = Date.now();

  try {
    const responseText = await runAgy(cmdArgs, promptToSend);
    
    if (conversationIdToUse) {
      sessionState.activeConversationId = conversationIdToUse;
    }

    const currentId = sessionState.activeConversationId || "new";

    let footer = "";
    try {
      const filesAfter = captureGitFiles(cwd);
      footer = buildFooter(filesBefore, filesAfter, Date.now() - t0);
    } catch (e) {
      // soft-fail with basic footer
      try {
        footer = `<!-- agy: ${((Date.now() - t0) / 1000).toFixed(1)}s -->`;
      } catch (e2) {
        footer = "";
      }
    }

    const returnText = footer 
      ? `${responseText}\n\n<!-- active_session_id: ${currentId} -->\n${footer}`
      : `${responseText}\n\n<!-- active_session_id: ${currentId} -->`;

    return {
      content: [
        {
          type: "text",
          text: returnText,
        }
      ],
    };
  } catch (err: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error debating with Antigravity: ${err.message}`,
        },
      ],
      isError: true,
    };
  }
}

export async function handleResetAntigravitySession(args: any) {
  sessionState.activeConversationId = null;
  sessionState.pendingSystemPrompt = args?.systemPrompt ? String(args.systemPrompt) : null;

  let confirmationMsg = "Antigravity discussion session has been reset. The next call to discuss_with_antigravity will start a brand new conversation.";
  if (sessionState.pendingSystemPrompt) {
    confirmationMsg += ` Pre-configured system prompt: ${sessionState.pendingSystemPrompt}.`;
  }

  return {
    content: [
      {
        type: "text",
        text: confirmationMsg,
      },
    ],
  };
}
