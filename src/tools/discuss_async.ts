import { sessionState } from "../state.ts";
import { loadPrompt } from "../utils/prompts.ts";
import { startTmuxJob, getJobStatus, getJobDir } from "../utils/jobs.ts";
import { buildFooter } from "../utils/observability.ts";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

export async function handleDiscussWithAntigravityAsyncStart(args: any) { // guardian: allow — dynamic MCP tool args, validated at use
  const prompt = String(args?.prompt || "");
  if (!prompt) {
    return { content: [{ type: "text", text: "Error: prompt is required" }], isError: true };
  }

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

  // Generate unique jobId with readable task prefix if available
  let taskPrefix = "";
  if (conversationIdToUse && conversationIdToUse.match(/^TASK-\d+$/i)) {
    taskPrefix = `${conversationIdToUse.toLowerCase()}-`;
  } else {
    const taskMatch = prompt.match(/(?:^|\n)(?:id|task|task_id):\s*(TASK-\d+)/i) || prompt.match(/(?:id|task|task_id):\s*(TASK-\d+)/i);
    if (taskMatch) {
      taskPrefix = `${taskMatch[1].toLowerCase()}-`;
    }
  }
  const jobId = `${taskPrefix}job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Start job in tmux
  const meta = startTmuxJob(jobId, promptToSend, conversationIdToUse, args?.cwd ? String(args.cwd) : undefined);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ jobId, status: meta.status, error: meta.error || null }),
      }
    ],
    isError: meta.status === "failed",
  };
}

export async function handleDiscussWithAntigravityAsyncStatus(args: any) { // guardian: allow — dynamic MCP tool args, validated at use
  const jobId = String(args?.jobId || "");
  if (!jobId) {
    return { content: [{ type: "text", text: "Error: jobId is required" }], isError: true };
  }
  if (!/^[A-Za-z0-9._-]+$/.test(jobId)) {
    return { content: [{ type: "text", text: "Error: invalid jobId" }], isError: true };
  }

  let meta;
  try {
    meta = getJobStatus(jobId);
  } catch (e) {
    return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
  }

  let logTail = "";
  if (meta.status === "running") {
    try {
      const outputFile = join(getJobDir(jobId), "output.txt");
      if (existsSync(outputFile)) {
        const content = readFileSync(outputFile, "utf-8");
        const lines = content.split(/\n/);
        logTail = lines.slice(-25).join("\n");
      }
    } catch (e) {
      // ignore soft-fail
    }
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          jobId: meta.jobId,
          status: meta.status,
          durationSec: Math.round((Date.now() - meta.startTime) / 1000),
          logTail: logTail || null,
          error: meta.error || null,
        }),
      }
    ],
    isError: false,
  };
}

export async function handleDiscussWithAntigravityAsyncResult(args: any) { // guardian: allow — dynamic MCP tool args, validated at use
  const jobId = String(args?.jobId || "");
  if (!jobId) {
    return { content: [{ type: "text", text: "Error: jobId is required" }], isError: true };
  }
  if (!/^[A-Za-z0-9._-]+$/.test(jobId)) {
    return { content: [{ type: "text", text: "Error: invalid jobId" }], isError: true };
  }

  let meta;
  try {
    meta = getJobStatus(jobId);
  } catch (e) {
    return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
  }

  if (meta.status === "running") {
    return {
      content: [{ type: "text", text: `Error: Job ${jobId} is still running. Poll its status first.` }],
      isError: true,
    };
  }

  let responseText = "";
  try {
    const outputFile = join(getJobDir(jobId), "output.txt");
    if (existsSync(outputFile)) {
      responseText = readFileSync(outputFile, "utf-8");
    }
  } catch (e) {
    return { content: [{ type: "text", text: `Error reading output file: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
  }

  const durationMs = meta.durationMs || (Date.now() - meta.startTime);
  const footer = buildFooter(meta.filesBefore || [], meta.filesAfter || [], durationMs);
  const activeId = sessionState.activeConversationId || "new";

  const returnText = footer
    ? `${responseText}\n\n<!-- active_session_id: ${activeId} -->\n${footer}`
    : `${responseText}\n\n<!-- active_session_id: ${activeId} -->`;

  return {
    content: [
      {
        type: "text",
        text: returnText,
      }
    ],
    isError: meta.status === "failed" || meta.status === "killed",
  };
}
