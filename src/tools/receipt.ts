import { readFileSync, existsSync } from "fs";
import { join } from "path";
import os from "os";
import { sessionState } from "../state.ts";
import { runAgy, getNewestConversationId } from "../utils/agy.ts";

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

  const receiptPrompt = `Пожалуйста, проанализируй историю текущей сессии дебатов и сформируй структурированный отчет на русском языке.

Отчет должен содержать следующие разделы:
1. **Тема обсуждения** (краткое резюме обсуждаемой проблемы).
2. **Сводная таблица участников**: для каждой роли/персоны (например, Оптимист, Скептик, Соглашатель, Хейтер), которая принимала участие:
   - Участник (Роль)
   - Основной тезис (Claim)
   - Аргументы и доказательства (Evidence)
3. **Отвергнутые альтернативы**: перечень вариантов решений или идей, которые были предложены другими участниками дебатов, но отвергнуты (с указанием причин).
4. **Итоговое принятое решение**: компромиссы, итоговая архитектура или соглашения, к которым пришли участники.

Отвечай строго на русском языке в формате Markdown. Начни сразу с заголовка "# Чек дебатов (Debate Receipt)" и не пиши никаких вводных слов от себя.`;

  let responseText = "";
  try {
    responseText = await runAgy(
      ["--dangerously-skip-permissions", "--print", "--conversation", targetDebateId],
      receiptPrompt
    );
  } catch (err: any) {
    responseText = `# Чек дебатов (Сессия: ${targetDebateId})\n\nНе удалось автоматически проанализировать сессию с помощью AI: ${err.message}.`;
  }

  let auditMarkdown = `\n\n## Аудит безопасности и изменений (Hooks Audit)\n\n`;

  if (allowedChanges.length > 0) {
    auditMarkdown += `### Успешные изменения файлов\n\n`;
    auditMarkdown += `| Файл | Инструмент | Статус | Время |\n`;
    auditMarkdown += `| :--- | :--- | :--- | :--- |\n`;
    for (const item of allowedChanges) {
      auditMarkdown += `| \`${item.file}\` | \`${item.tool}\` | ✅ Разрешено | ${item.timestamp} |\n`;
    }
    auditMarkdown += `\n`;
  } else {
    auditMarkdown += `*Изменений файлов в рамках этой сессии зафиксировано не было.*\n\n`;
  }

  if (blockedAttempts.length > 0) {
    auditMarkdown += `### Заблокированные нарушения правил\n\n`;
    for (const item of blockedAttempts) {
      auditMarkdown += `> [!WARNING]\n`;
      auditMarkdown += `> **Попытка нарушения правил кодирования заблокирована хуком безопасности**\n`;
      auditMarkdown += `> - **Файл**: \`${item.file}\`\n`;
      auditMarkdown += `> - **Инструмент**: \`${item.tool}\`\n`;
      auditMarkdown += `> - **Причина блокировки**: ${item.reason || "Не указана"}\n`;
      auditMarkdown += `> - **Время**: ${item.timestamp}\n\n`;
    }
  } else {
    auditMarkdown += `> [!NOTE]\n`;
    auditMarkdown += `> Попыток нарушения правил кодирования (использование \`@ts-ignore\` или жестко заданных цветов) в этой сессии не зафиксировано.\n\n`;
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
