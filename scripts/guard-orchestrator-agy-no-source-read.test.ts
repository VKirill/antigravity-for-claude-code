import { test, expect } from "bun:test";
import { join } from "path";

const hookPath = join(import.meta.dir, "guard-orchestrator-agy-no-source-read.sh");

async function runHook(payload: any) {
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

  let json: any = null;
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
