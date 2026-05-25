# Editor integration

## VS Code

### Install

Extension: `dbaeumer.vscode-eslint`.

### `.vscode/settings.json`

```json
{
  "eslint.useFlatConfig": true,
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact",
    "vue",
    "astro"
  ],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "eslint.run": "onType"
}
```

Notes:
- `eslint.useFlatConfig: true` is the default in recent extension versions; set explicitly to be safe
- `source.fixAll.eslint: "explicit"` runs fixes on save but not on every keystroke
- `eslint.run: "onType"` shows diagnostics while typing (slight CPU cost — switch to `"onSave"` on large repos)

### With Prettier

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

Prettier formats first, then ESLint fixes (only the rules `eslint-config-prettier` didn't disable).

### Troubleshooting

| Symptom | Fix |
|---|---|
| "ESLint not running" | Open Output → "ESLint" log; usually missing `eslint.config.*` |
| "Failed to load config from …" | Run `npx eslint --print-config <file>` to surface real error |
| Slow performance | Disable `eslint.run: "onType"`, switch to `"onSave"` |
| Phantom errors after fix | Reload window (`Cmd+Shift+P` → "Reload Window") |

## JetBrains (WebStorm / IntelliJ IDEA)

`Preferences → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint`:

- ✅ **Automatic ESLint configuration** (auto-detects flat config)
- ✅ **Run eslint --fix on save** under "Actions on Save"

For TypeScript files, also enable in `Languages & Frameworks → TypeScript → ESLint`.

WebStorm 2024+ supports flat config natively. Older versions: switch to "Manual" and point at `eslint.config.js`.

## Neovim

Via `nvim-lspconfig` + `eslint-lsp`:

```lua
require("lspconfig").eslint.setup({
  settings = {
    useFlatConfig = true,
    workingDirectory = { mode = "auto" },
  },
  on_attach = function(_, bufnr)
    vim.api.nvim_create_autocmd("BufWritePre", {
      buffer = bufnr,
      command = "EslintFixAll",
    })
  end,
})
```

Or with `null-ls` / `none-ls`:

```lua
require("null-ls").setup({
  sources = {
    require("null-ls").builtins.diagnostics.eslint_d,
    require("null-ls").builtins.code_actions.eslint_d,
    require("null-ls").builtins.formatting.eslint_d,
  },
})
```

`eslint_d` is a daemonized ESLint — keeps the runtime warm between invocations, 10x faster than spawning fresh.

## Zed

`.zed/settings.json`:
```json
{
  "languages": {
    "TypeScript": {
      "code_actions_on_format": {
        "source.fixAll.eslint": true
      }
    }
  }
}
```

Zed auto-detects flat config — no extra setting needed.

## CLI: ad-hoc fix

```bash
# Fix a single file
npx eslint src/components/Modal.tsx --fix

# See the resolved config for a specific file
npx eslint --print-config src/components/Modal.tsx | jq

# Open the config inspector in a browser
npx eslint --inspect-config
```

## Common editor issue: stale config

If you change `eslint.config.ts` and the editor doesn't pick up the new rules:

- VS Code: ESLint output → "Restart ESLint Server" (`Cmd+Shift+P` → "ESLint: Restart ESLint Server")
- WebStorm: invalidate caches and restart
- Neovim: `:LspRestart eslint`
