import { test, expect } from "bun:test";
import { join } from "path";

const hookPath = join(import.meta.dir, "guard-dangerous-bash.sh");

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

test("t1. psql -c \"DROP TABLE foo\" -> exit 2, deny", async () => {
  const { exitCode, json } = await runHook({
    tool_input: {
      command: 'psql -c "DROP TABLE foo"'
    }
  });
  expect(exitCode).toBe(2);
  expect(json).not.toBeNull();
  expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
});

test("t2. psql -c \"TRUNCATE foo\" -> exit 2, deny", async () => {
  const { exitCode, json } = await runHook({
    tool_input: {
      command: 'psql -c "TRUNCATE foo"'
    }
  });
  expect(exitCode).toBe(2);
  expect(json).not.toBeNull();
  expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
});

test("t3. psql -c \"DELETE FROM foo\" -> exit 2, deny", async () => {
  const { exitCode, json } = await runHook({
    tool_input: {
      command: 'psql -c "DELETE FROM foo"'
    }
  });
  expect(exitCode).toBe(2);
  expect(json).not.toBeNull();
  expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
});

test("t4. psql -c \"DELETE FROM foo WHERE id=1\" -> exit 0, allow", async () => {
  const { exitCode, json } = await runHook({
    tool_input: {
      command: 'psql -c "DELETE FROM foo WHERE id=1"'
    }
  });
  expect(exitCode).toBe(0);
  expect(json).toBeNull();
});

test("t5. heredoc cat <<EOF | task insert -\\n... DROP TABLE users ...\\nEOF -> exit 0, allow", async () => {
  const { exitCode, json } = await runHook({
    tool_input: {
      command: `cat <<EOF | task insert -
... DROP TABLE users ...
EOF`
    }
  });
  expect(exitCode).toBe(0);
  expect(json).toBeNull();
});

test("t6. same heredoc shape with DELETE FROM foo in body -> exit 0, allow", async () => {
  const { exitCode, json } = await runHook({
    tool_input: {
      command: `cat <<EOF | task insert -
... DELETE FROM foo ...
EOF`
    }
  });
  expect(exitCode).toBe(0);
  expect(json).toBeNull();
});

test("t7. rm -rf /tmp/foo -> exit 0, allow (whitelist)", async () => {
  const { exitCode, json } = await runHook({
    tool_input: {
      command: 'rm -rf /tmp/foo'
    }
  });
  expect(exitCode).toBe(0);
  expect(json).toBeNull();
});

test("t8. rm -rf /home/ubuntu/important -> exit 2, deny", async () => {
  const { exitCode, json } = await runHook({
    tool_input: {
      command: 'rm -rf /home/ubuntu/important'
    }
  });
  expect(exitCode).toBe(2);
  expect(json).not.toBeNull();
  expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
});

test("t9. git push --force -> exit 2, deny", async () => {
  const { exitCode, json } = await runHook({
    tool_input: {
      command: 'git push --force'
    }
  });
  expect(exitCode).toBe(2);
  expect(json).not.toBeNull();
  expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
});

test("t10. git push --force-with-lease -> exit 0, allow", async () => {
  const { exitCode, json } = await runHook({
    tool_input: {
      command: 'git push --force-with-lease'
    }
  });
  expect(exitCode).toBe(0);
  expect(json).toBeNull();
});

test("t11. cat file.md && grep foo file.md -> exit 0, allow (SAFE_CMDS)", async () => {
  const { exitCode, json } = await runHook({
    tool_input: {
      command: 'cat file.md && grep foo file.md'
    }
  });
  expect(exitCode).toBe(0);
  expect(json).toBeNull();
});

test("t12. unbalanced-quote input psql -c \"oops -> exit 0, allow (fail-open)", async () => {
  const { exitCode, json } = await runHook({
    tool_input: {
      command: 'psql -c "oops'
    }
  });
  expect(exitCode).toBe(0);
  expect(json).toBeNull();
});

test("t13. a 3-segment command chained with && where the middle segment is echo \"<<EOF\" and outer segments are psql -c with DROP TABLE and DELETE FROM respectively -> exit 2, deny", async () => {
  const { exitCode, json } = await runHook({
    tool_input: {
      command: 'psql -c "DROP TABLE foo" && echo "<<EOF" && psql -c "DELETE FROM bar"'
    }
  });
  expect(exitCode).toBe(2);
  expect(json).not.toBeNull();
  expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
});

test("t14. real heredoc body - cat <<EOF\\nDROP TABLE x\\nEOF\\n| task insert - -> exit 0, allow", async () => {
  const { exitCode, json } = await runHook({
    tool_input: {
      command: `cat <<EOF
DROP TABLE x
EOF
| task insert -`
    }
  });
  expect(exitCode).toBe(0);
  expect(json).toBeNull();
});

test("t15. echo '<<EOF' -> exit 0, allow", async () => {
  const { exitCode, json } = await runHook({
    tool_input: {
      command: "echo '<<EOF'"
    }
  });
  expect(exitCode).toBe(0);
  expect(json).toBeNull();
});

test("t16. quoted heredoc delimiter regression case -> exit 2, deny", async () => {
  const { exitCode, json } = await runHook({
    tool_input: {
      command: `cat <<'EOF' | psql -c "DROP TABLE x"
stuff
EOF`
    }
  });
  expect(exitCode).toBe(2);
  expect(json).not.toBeNull();
  expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
});

