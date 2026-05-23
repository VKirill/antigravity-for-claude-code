import { readFileSync, existsSync } from "fs";
import { join } from "path";
import os from "os";
import { sessionState } from "../state.ts";
import { runAgy, getNewestConversationId } from "../utils/agy.ts";

const RECEIPT_PROMPTS = {
  ru: {
    prompt: `Пожалуйста, проанализируй историю текущей сессии дебатов и сформируй структурированный отчет на русском языке.

Отчет должен содержать следующие разделы:
1. **Тема обсуждения** (краткое резюме обсуждаемой проблемы).
2. **Сводная таблица участников**: для каждой роли/персоны (например, Оптимист, Скептик, Соглашатель, Хейтер), которая принимала участие:
   - Участник (Роль)
   - Основной тезис (Claim)
   - Аргументы и доказательства (Evidence)
3. **Отвергнутые альтернативы**: перечень вариантов решений или идей, которые были предложены другими участниками дебатов, но отвергнуты (с указанием причин).
4. **Итоговое принятое решение**: компромиссы, итоговая архитектура или соглашения, к которым пришли участники.

Отвечай строго на русском языке в формате Markdown. Начни сразу с заголовка "# Чек дебатов (Debate Receipt)" и не пиши никаких вводных слов от себя.`,
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
    prompt: `Please analyze the history of the current debate session and generate a structured report in English.

The report must contain the following sections:
1. **Debate Topic** (brief summary of the discussed problem).
2. **Participants Summary Table**: for each role/persona (e.g. Optimist, Skeptic, Agreer, Hater) that participated:
   - Participant (Role)
   - Core claim (Claim)
   - Arguments and evidence (Evidence)
3. **Rejected Alternatives**: list of proposed options or ideas that were rejected (with reasons).
4. **Final Decision**: compromises, final architecture, or agreements reached.

Respond strictly in English in Markdown format. Start directly with the header "# Debate Receipt" and do not write any introductory text.`,
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
