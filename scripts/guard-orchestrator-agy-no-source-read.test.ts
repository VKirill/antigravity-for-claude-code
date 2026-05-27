import { test, expect } from "bun:test";
import { join } from "path";

const hookPath = join(import.meta.dir, "guard-orchestrator-agy-no-source-read.sh");

async function runHook(payload: any) { // guardian: allow — test helper accepts arbitrary hook payload shapes
  const proc = Bun.spawn([hookPath], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  proc.stdin.write(JSON.stringify(payload));
  proc.stdin.end();

  const exitCode = await proc.exited;
  const stdoutText = await new Response(proc.stdout).text();
  const stderrText = await new Response(proc.stderr).text();

  let json: any = null; // guardian: allow — parsed hook output, shape varies by deny vs allow
  if (stdoutText.trim()) {
    try {
      json = JSON.parse(stdoutText);
    } catch {
      // Ignore JSON parse errors
    }
  }

  return { exitCode, stdoutText, stderrText, json };
}

test("a. Heredoc YAML body with files_to_touch and nested verification_commands is allowed", async () => {
  const { exitCode, json } = await runHook({
    agent_type: "dev-orchestrator-agy",
    tool_name: "Bash",
    tool_input: {
      command: `cat <<EOF | task insert -
id: TASK-NNN
title: test
files_to_touch: [src/foo.ts]
verification_commands: ["cat src/foo.ts | jq ..."]
EOF`
    }
  });

  expect(exitCode).toBe(0);
  expect(json).toBeNull();
});

test("b. Standalone cat on source file is denied", async () => {
  const { exitCode, json } = await runHook({
    agent_type: "dev-orchestrator-agy",
    tool_name: "Bash",
    tool_input: {
      command: "cat src/foo.ts"
    }
  });

  expect(exitCode).toBe(2);
  expect(json).not.toBeNull();
  expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
});

test("c. Pipeline cat reading source is denied", async () => {
  const { exitCode, json } = await runHook({
    agent_type: "dev-orchestrator-agy",
    tool_name: "Bash",
    tool_input: {
      command: "cat src/foo.ts | jq ."
    }
  });

  expect(exitCode).toBe(2);
  expect(json).not.toBeNull();
  expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
});

test("d. grep matching pattern on source file is denied", async () => {
  const { exitCode, json } = await runHook({
    agent_type: "dev-orchestrator-agy",
    tool_name: "Bash",
    tool_input: {
      command: 'grep -n "Hello" src/index.ts'
    }
  });

  expect(exitCode).toBe(2);
  expect(json).not.toBeNull();
  expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
});

test("e. task list piped to grep done is allowed", async () => {
  const { exitCode, json } = await runHook({
    agent_type: "dev-orchestrator-agy",
    tool_name: "Bash",
    tool_input: {
      command: "task list | grep done"
    }
  });

  expect(exitCode).toBe(0);
  expect(json).toBeNull();
});

test("f. git diff on source file is allowed", async () => {
  const { exitCode, json } = await runHook({
    agent_type: "dev-orchestrator-agy",
    tool_name: "Bash",
    tool_input: {
      command: "git diff -- src/foo.ts"
    }
  });

  expect(exitCode).toBe(0);
  expect(json).toBeNull();
});

test("g. Read tool with file_path is denied", async () => {
  const { exitCode, json } = await runHook({
    agent_type: "dev-orchestrator-agy",
    tool_name: "Read",
    tool_input: {
      file_path: "src/foo.ts"
    }
  });

  expect(exitCode).toBe(2);
  expect(json).not.toBeNull();
  expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
});

test("h. agent_type worker-coder running cat on source file is allowed", async () => {
  const { exitCode, json } = await runHook({
    agent_type: "worker-coder",
    tool_name: "Bash",
    tool_input: {
      command: "cat src/foo.ts"
    }
  });

  expect(exitCode).toBe(0);
  expect(json).toBeNull();
});

test("i. xargs cat src/foo.ts is denied", async () => {
  const { exitCode, json } = await runHook({
    agent_type: "dev-orchestrator-agy",
    tool_name: "Bash",
    tool_input: {
      command: "xargs cat src/foo.ts"
    }
  });

  expect(exitCode).toBe(2);
  expect(json).not.toBeNull();
  expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
});

test("j. bash -c \"cat src/foo.ts\" is denied", async () => {
  const { exitCode, json } = await runHook({
    agent_type: "dev-orchestrator-agy",
    tool_name: "Bash",
    tool_input: {
      command: `bash -c "cat src/foo.ts"`
    }
  });

  expect(exitCode).toBe(2);
  expect(json).not.toBeNull();
  expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
});

test("k. sh -c 'grep TODO src/foo.ts' is denied", async () => {
  const { exitCode, json } = await runHook({
    agent_type: "dev-orchestrator-agy",
    tool_name: "Bash",
    tool_input: {
      command: "sh -c 'grep TODO src/foo.ts'"
    }
  });

  expect(exitCode).toBe(2);
  expect(json).not.toBeNull();
  expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
});

test("l. eval 'cat src/foo.ts' is denied", async () => {
  const { exitCode, json } = await runHook({
    agent_type: "dev-orchestrator-agy",
    tool_name: "Bash",
    tool_input: {
      command: "eval 'cat src/foo.ts'"
    }
  });

  expect(exitCode).toBe(2);
  expect(json).not.toBeNull();
  expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
});

test("m. find . -name '*.ts' -exec cat {} \\; is denied", async () => {
  const { exitCode, json } = await runHook({
    agent_type: "dev-orchestrator-agy",
    tool_name: "Bash",
    tool_input: {
      command: "find . -name '*.ts' -exec cat {} \\;"
    }
  });

  expect(exitCode).toBe(2);
  expect(json).not.toBeNull();
  expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
});

test("n. env FOO=bar cat src/foo.ts is denied", async () => {
  const { exitCode, json } = await runHook({
    agent_type: "dev-orchestrator-agy",
    tool_name: "Bash",
    tool_input: {
      command: "env FOO=bar cat src/foo.ts"
    }
  });

  expect(exitCode).toBe(2);
  expect(json).not.toBeNull();
  expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
});

test("o. xargs -I{} echo {} < list.txt is allowed", async () => {
  const { exitCode, json } = await runHook({
    agent_type: "dev-orchestrator-agy",
    tool_name: "Bash",
    tool_input: {
      command: "xargs -I{} echo {} < list.txt"
    }
  });

  expect(exitCode).toBe(0);
  expect(json).toBeNull();
});

test("p. find . -type f -exec cat {} \\; -print is denied", async () => {
  const { exitCode, json } = await runHook({
    agent_type: "dev-orchestrator-agy",
    tool_name: "Bash",
    tool_input: {
      command: "find . -type f -exec cat {} \\; -print src/foo.ts"
    }
  });

  expect(exitCode).toBe(2);
  expect(json).not.toBeNull();
  expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
});

test("q. find . -type d is allowed", async () => {
  const { exitCode, json } = await runHook({
    agent_type: "dev-orchestrator-agy",
    tool_name: "Bash",
    tool_input: {
      command: "find . -type d"
    }
  });

  expect(exitCode).toBe(0);
  expect(json).toBeNull();
});

// r-t: regression — multi-line bash where newline acts as ';' between statements.
// Previously the shlex-based segmenter did NOT split on '\n', collapsing the next
// statement's args into the previous one's argv list. That made `git status | head`
// followed by `git add file.ts` look like `head ... file.ts` and falsely deny.

test("r. multi-line git pipeline + git add of .ts files is allowed (newline acts as ;)", async () => {
  const { exitCode, json } = await runHook({
    agent_type: "dev-orchestrator-agy",
    tool_name: "Bash",
    tool_input: {
      command: `git status --short 2>&1 | head -15
echo "---"
git add packages/application/src/identity/use-cases/cache-user-avatar.ts packages/application/src/identity/use-cases/index.ts`
    }
  });

  expect(exitCode).toBe(0);
  expect(json).toBeNull();
});

test("s. multi-line `head -15` then `git add file.ts` does not bleed across newline", async () => {
  const { exitCode, json } = await runHook({
    agent_type: "dev-orchestrator-agy",
    tool_name: "Bash",
    tool_input: {
      command: `cat package.json | head -15
git add src/foo.ts`
    }
  });

  expect(exitCode).toBe(0);
  expect(json).toBeNull();
});

test("t. real source-read on a separate line is STILL denied (no over-permissive newline rule)", async () => {
  const { exitCode, json } = await runHook({
    agent_type: "dev-orchestrator-agy",
    tool_name: "Bash",
    tool_input: {
      command: `git status
cat src/foo.ts`
    }
  });

  expect(exitCode).toBe(2);
  expect(json).not.toBeNull();
  expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
});

