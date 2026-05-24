import { runAgy } from "../utils/agy.ts";
import { captureGitFiles, buildFooter } from "../utils/observability.ts";

export async function handleReviewCodeChanges(args: any) {
  const diff = String(args?.diff || "");
  const context = args?.context ? String(args.context) : "";

  const systemPrompt = `Ты — Senior Code Reviewer и эксперт по безопасности. Твоя цель — провести профессиональный аудит изменений кода (code review) на русском языке.
Найди потенциальные баги, утечки ресурсов, проблемы безопасности (например, инъекции, небезопасное управление состоянием), неэффективные алгоритмы и отступления от стандартов кодирования или принципов SOLID, DRY, KISS.

Сгруппируй замечания по категориям:
1. **Критические (P0/P1)**: Реальные ошибки, уязвимости, проблемы логики, которые могут сломать систему.
2. **Рекомендации (P2)**: Улучшения читаемости, стилистики, упрощение кода, рефакторинг.

Для каждого важного замечания предложи конкретный пример улучшения кода (исправленный фрагмент). Будь конструктивным и лаконичным.`;

  let promptToSend = `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${systemPrompt}]\n\n`;
  if (context) {
    promptToSend += `Контекст проекта/дополнительные требования:\n${context}\n\n`;
  }
  promptToSend += `Изменения кода для обзора (git diff):\n\`\`\`diff\n${diff}\n\`\`\``;

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
    const responseText = await runAgy(["--dangerously-skip-permissions", "--print", "--continue=false"], promptToSend);
    
    let footer = "";
    try {
      const filesAfter = captureGitFiles(cwd);
      footer = buildFooter(filesBefore, filesAfter, Date.now() - t0);
    } catch (e) {
      try {
        footer = `<!-- agy: ${((Date.now() - t0) / 1000).toFixed(1)}s -->`;
      } catch (e2) {
        footer = "";
      }
    }

    const returnText = footer ? `${responseText}\n${footer}` : responseText;

    return {
      content: [
        {
          type: "text",
          text: returnText,
        }
      ]
    };
  } catch (err: any) {
    return {
      content: [
        {
          type: "text",
          text: `Ошибка при проведении код-ревью: ${err.message}`,
        }
      ],
      isError: true
    };
  }
}

export async function handleGetProgrammingAdvice(args: any) {
  const question = String(args?.question || "");
  const codeSnippet = args?.codeSnippet ? String(args.codeSnippet) : "";
  const language = args?.language ? String(args.language) : "";

  const systemPrompt = `Ты — Senior Software Engineer и Solutions Architect. Твоя цель — дать точный, лаконичный, глубокий и практически полезный технический ответ на вопрос разработчика на русском языке.
Используй лучшие индустриальные практики, избегай общих слов и лишней воды. Приводи наглядные, чистые и готовые к использованию примеры кода.`;

  let promptToSend = `[СИСТЕМНЫЙ ПРОМПТ ДЛЯ РОЛИ: ${systemPrompt}]\n\n`;
  if (language) {
    promptToSend += `Язык/Технология/Стек: ${language}\n\n`;
  }
  if (codeSnippet) {
    promptToSend += `Исходный код для контекста:\n\`\`\`\n${codeSnippet}\n\`\`\`\n\n`;
  }
  promptToSend += `Вопрос:\n${question}`;

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
    const responseText = await runAgy(["--dangerously-skip-permissions", "--print", "--continue=false"], promptToSend);
    
    let footer = "";
    try {
      const filesAfter = captureGitFiles(cwd);
      footer = buildFooter(filesBefore, filesAfter, Date.now() - t0);
    } catch (e) {
      try {
        footer = `<!-- agy: ${((Date.now() - t0) / 1000).toFixed(1)}s -->`;
      } catch (e2) {
        footer = "";
      }
    }

    const returnText = footer ? `${responseText}\n${footer}` : responseText;

    return {
      content: [
        {
          type: "text",
          text: returnText,
        }
      ]
    };
  } catch (err: any) {
    return {
      content: [
        {
          type: "text",
          text: `Ошибка при получении совета по программированию: ${err.message}`,
        }
      ],
      isError: true
    };
  }
}
