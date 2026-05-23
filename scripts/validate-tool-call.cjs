#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

// Read stdin
let inputData = '';
process.stdin.on('data', chunk => {
  inputData += chunk;
});

function logAuditEvent(conversationId, toolName, targetFile, decision, reason = '') {
  try {
    const configDir = path.join(os.homedir(), '.gemini', 'antigravity-cli');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    const logFile = path.join(configDir, 'hooks-audit.jsonl');
    const logEntry = {
      timestamp: new Date().toISOString(),
      conversationId: conversationId || 'unknown',
      tool: toolName,
      file: targetFile,
      decision: decision,
      reason: reason
    };
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

process.stdin.on('end', () => {
  try {
    if (!inputData.trim()) {
      console.log(JSON.stringify({ decision: "allow" }));
      process.exit(0);
    }

    const context = JSON.parse(inputData);
    const toolCall = context.toolCall;
    const conversationId = context.conversationId || 'unknown';

    if (!toolCall || !toolCall.name) {
      console.log(JSON.stringify({ decision: "allow" }));
      process.exit(0);
    }

    const toolName = toolCall.name;
    const args = toolCall.args || {};

    // Only validate file modification tools
    if (['write_to_file', 'replace_file_content', 'multi_replace_file_content'].includes(toolName)) {
      const targetFile = args.TargetFile || '';
      
      // Extract content to validate
      let contentsToCheck = [];
      if (args.CodeContent) {
        contentsToCheck.push(args.CodeContent);
      }
      if (args.ReplacementContent) {
        contentsToCheck.push(args.ReplacementContent);
      }
      if (args.ReplacementChunks && Array.isArray(args.ReplacementChunks)) {
        args.ReplacementChunks.forEach(chunk => {
          if (chunk.ReplacementContent) {
            contentsToCheck.push(chunk.ReplacementContent);
          }
        });
      }

      const mergedContent = contentsToCheck.join('\n');

      // 1. Check for ignore comments
      const ignorePattern = /@ts-ignore|@ts-nocheck|@vue-ignore|vue-ignore/i;
      if (ignorePattern.test(mergedContent)) {
        const errorMsg = "КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать @ts-ignore, @ts-nocheck или @vue-ignore для скрытия ошибок. Пожалуйста, исправьте типы или код.";
        logAuditEvent(conversationId, toolName, targetFile, 'block', errorMsg);
        console.error(`[GUIDELINE ERROR] ${errorMsg}`);
        console.log(JSON.stringify({
          decision: "block",
          reason: errorMsg
        }));
        process.exit(1);
      }

      // 2. Check for hex colors and px in Vue/CSS components (excluding design system or configs)
      const isVueOrCss = targetFile.endsWith('.vue') || targetFile.endsWith('.css') || targetFile.endsWith('.scss');
      const isDesignSystemOrConfig = targetFile.includes('theme') || targetFile.includes('token') || targetFile.includes('tailwind') || targetFile.includes('config');

      if (isVueOrCss && !isDesignSystemOrConfig) {
        // Hex color regex: #f00, #ff0000, #ff0000ff (excluding CSS vars or other safe formats)
        // Match only hex color literals in styles or assignments
        const hexColorPattern = /#([0-9a-fA-F]{3}){1,2}\b/g;
        if (hexColorPattern.test(mergedContent)) {
          const errorMsg = "ЗАПРЕЩЕНО использовать жестко заданные HEX-цвета (например, #1e1e2f) в компонентах. Используйте дизайн-токены (CSS-переменные проекта).";
          logAuditEvent(conversationId, toolName, targetFile, 'block', errorMsg);
          console.error(`[GUIDELINE ERROR] ${errorMsg}`);
          console.log(JSON.stringify({
            decision: "block",
            reason: errorMsg
          }));
          process.exit(1);
        }
      }

      // Log successful checks
      logAuditEvent(conversationId, toolName, targetFile, 'allow');
    }

    // Default decision: allow
    console.log(JSON.stringify({ decision: "allow" }));
    process.exit(0);

  } catch (err) {
    // If anything fails in the hook itself, fallback to allow
    console.error("Hook error:", err);
    console.log(JSON.stringify({ decision: "allow" }));
    process.exit(0);
  }
});
