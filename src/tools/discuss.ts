import { ROLE_PRESETS } from "../config.ts";
import { sessionState } from "../state.ts";
import { runAgy, getNewestConversationId } from "../utils/agy.ts";
import { captureGitFiles, buildFooter } from "../utils/observability.ts";

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

  let promptToSend = prompt;

  // If it's a new conversation, inject system instructions/roles
  if (!conversationIdToUse) {
    const selectedRole = args?.role ? String(args.role) : sessionState.pendingRole;
    const selectedSystemPrompt = args?.systemPrompt ? String(args.systemPrompt) : sessionState.pendingSystemPrompt;

    let systemPromptText = "";
    if (selectedRole && ROLE_PRESETS[selectedRole.toLowerCase()]) {
      systemPromptText = ROLE_PRESETS[selectedRole.toLowerCase()];
    }

    if (selectedSystemPrompt) {
      systemPromptText = systemPromptText
        ? `${systemPromptText}\n\nДополнительные системные инструкции:\n${selectedSystemPrompt}`
        : selectedSystemPrompt;
    }

    if (systemPromptText) {
      promptToSend = `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${systemPromptText}]\n\n${prompt}`;
    }

    // Clear pending configurations as they are now consumed
    sessionState.pendingRole = null;
    sessionState.pendingSystemPrompt = null;
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
    
    // If we didn't have an ID, grab the newly created one and store it
    if (conversationIdToUse) {
      sessionState.activeConversationId = conversationIdToUse;
    } else {
      sessionState.activeConversationId = getNewestConversationId();
    }

    const currentId = sessionState.activeConversationId || "unknown";

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
  sessionState.pendingRole = args?.role ? String(args.role) : null;

  let confirmationMsg = "Antigravity discussion session has been reset. The next call to discuss_with_antigravity will start a brand new conversation.";
  if (sessionState.pendingRole || sessionState.pendingSystemPrompt) {
    confirmationMsg += ` Pre-configured role: ${sessionState.pendingRole || "custom"}, system prompt: ${sessionState.pendingSystemPrompt || "none"}.`;
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
