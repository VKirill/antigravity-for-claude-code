#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const projectDir = path.resolve(__dirname);
const targetHookScript = path.join(projectDir, 'scripts', 'validate-tool-call.cjs');

// Make validator executable
try {
  fs.chmodSync(targetHookScript, '755');
  console.log(`Validator script made executable: ${targetHookScript}`);
} catch (err) {
  console.error(`Failed to chmod validator: ${err.message}`);
}

const configDir = path.join(os.homedir(), '.gemini', 'antigravity-cli');
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

const hookConfig = {
  "code-guidelines-gate": {
    "enabled": true,
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": targetHookScript,
            "timeout": 5
          }
        ]
      }
    ]
  }
};

const targetConfigFile = path.join(configDir, 'hooks.json');
fs.writeFileSync(targetConfigFile, JSON.stringify(hookConfig, null, 2));
console.log(`Hooks configuration successfully installed to: ${targetConfigFile}`);
