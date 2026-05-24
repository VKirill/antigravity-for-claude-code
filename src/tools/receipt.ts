import { readFileSync, existsSync } from "fs";
import { join } from "path";
import os from "os";
import { sessionState } from "../state.ts";
import { runAgy, getNewestConversationId } from "../utils/agy.ts";
import { loadPrompt } from "../utils/prompts.ts";

const RECEIPT_PROMPTS = {
  ru: {
    get prompt() {
      return loadPrompt("tools/debate-receipt.ru.md");
    },
    error: (id: string, msg: string) => `# Чек дебатов (Сессия: ${id})\n\nНе удалось автоматически проанализировать сессию с помощью AI: ${msg}.`,
    hooksAudit: "\n\n## Аудит безопасности и изменений (Hooks Audit)\n\n",
    allowedChanges: "### Успешные изменения файлов\n\n",
    allowedHeaders: "| Файл | Инструмент | Статус | Время |\n| :--- | :--- | :--- | :--- |\n",
    allowedRow: (file: string, tool: string, time: string) => `| \`${file}\` | \`${tool}\` | ✅ Разрешено | ${time} |\n`,
    noChanges: "*Изменений файлов в рамках этой сессии зафиксировано не было.*\n\n",
    blockedAttempts: "### Заблокированные нарушения правил\n\n",
    blockedWarning: (file: string, tool: string, reason: string, time: string) => `> [!WARNING]
> **Попытка нарушения правил кодирования заблокирована хуком безопасности**
> - **Файл**: \`${file}\`
> - **Инструмент**: \`${tool}\`
> - **Причина блокировки**: ${reason || "Не указана"}
> - **Время**: ${time}\n\n`,
    noViolations: `> [!NOTE]
> Попыток нарушения правил кодирования (использование \`@ts-ignore\` или жестко заданных цветов) в этой сессии не зафиксировано.\n\n`
  },
  en: {
    get prompt() {
      return loadPrompt("tools/debate-receipt.en.md");
    },
    error: (id: string, msg: string) => `# Debate Receipt (Session: ${id})\n\nFailed to automatically analyze the session using AI: ${msg}.`,
    hooksAudit: "\n\n## Hooks & Security Audit\n\n",
    allowedChanges: "### Approved File Modifications\n\n",
    allowedHeaders: "| File | Tool | Status | Time |\n| :--- | :--- | :--- | :--- |\n",
    allowedRow: (file: string, tool: string, time: string) => `| \`${file}\` | \`${tool}\` | ✅ Allowed | ${time} |\n`,
    noChanges: "*No file modifications were recorded in this session.*\n\n",
    blockedAttempts: "### Blocked Quality Violations\n\n",
    blockedWarning: (file: string, tool: string, reason: string, time: string) => `> [!WARNING]
> **Coding policy violation blocked by security hook**
> - **File**: \`${file}\`
> - **Tool**: \`${tool}\`
> - **Block Reason**: ${reason || "Not specified"}
> - **Time**: ${time}\n\n`,
    noViolations: `> [!NOTE]
> No coding policy violations (such as using \`@ts-ignore\` or hardcoded colors) were attempted in this session.\n\n`
  }
};

export async function handleGetDebateReceipt(args: any) {
  const targetDebateId = args?.debateId ? String(args.debateId) : (sessionState.activeConversationId || getNewestConversationId());
  if (!targetDebateId) {
    return {
      content: [
        {
          type: "text",
          text: "Ошибка: не найдено активной сессии дебатов. Пожалуйста, укажите debateId.",
        }
      ],
      isError: true
    };
  }

  const langInput = args?.language;
  const lang = (langInput === "en" || langInput === "english") ? "en" : "ru";
  const prompts = RECEIPT_PROMPTS[lang];

  const homeDir = process.env.HOME || os.homedir();
  const auditLogPath = join(homeDir, ".gemini/antigravity-cli/hooks-audit.jsonl");
  const touchedFiles: any[] = [];

  if (existsSync(auditLogPath)) {
    try {
      const content = readFileSync(auditLogPath, "utf-8");
      const lines = content.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.conversationId === targetDebateId) {
            touchedFiles.push(entry);
          }
        } catch (e) {
          // Ignore malformed JSON lines
        }
      }
    } catch (err) {
      // Ignore file read errors
    }
  }

  const allowedChanges = touchedFiles.filter(f => f.decision === "allow");
  const blockedAttempts = touchedFiles.filter(f => f.decision === "block");

  let responseText = "";
  try {
    responseText = await runAgy(
      ["--dangerously-skip-permissions", "--print", "--conversation", targetDebateId],
      prompts.prompt
    );
  } catch (err: any) {
    responseText = prompts.error(targetDebateId, err.message);
  }

  let auditMarkdown = prompts.hooksAudit;

  if (allowedChanges.length > 0) {
    auditMarkdown += prompts.allowedChanges;
    auditMarkdown += prompts.allowedHeaders;
    for (const item of allowedChanges) {
      auditMarkdown += prompts.allowedRow(item.file, item.tool, item.timestamp);
    }
    auditMarkdown += `\n`;
  } else {
    auditMarkdown += prompts.noChanges;
  }

  if (blockedAttempts.length > 0) {
    auditMarkdown += prompts.blockedAttempts;
    for (const item of blockedAttempts) {
      auditMarkdown += prompts.blockedWarning(item.file, item.tool, item.reason, item.timestamp);
    }
  } else {
    auditMarkdown += prompts.noViolations;
  }

  const finalReport = `${responseText.trim()}${auditMarkdown}`;

  return {
    content: [
      {
        type: "text",
        text: finalReport,
      }
    ]
  };
}
