---
description: Check whether the local Codex CLI is ready and optionally toggle the stop-time review gate
argument-hint: '[--profile <name>] [--enable-review-gate|--disable-review-gate]'
allowed-tools: Bash(node:*), Bash(npm:*), AskUserQuestion
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" setup --json $ARGUMENTS
```

If the result says Codex is unavailable and npm is available:
- Use `AskUserQuestion` exactly once to ask whether Claude should install Codex now.
- Put the install option first and suffix it with `(Recommended)`.
- Use these two options:
  - `Install Codex (Recommended)`
  - `Skip for now`
- If the user chooses install, run:

```bash
npm install -g @openai/codex
```

- Then rerun:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" setup --json $ARGUMENTS
```

If Codex is already installed or npm is unavailable:
- Do not ask about installation.

Output rules:
- Present the final setup output to the user.
- If installation was skipped, present the original setup output.
- If Codex is installed but not authenticated, preserve the guidance to run `!codex login`.

Profile selection:
- Treat `--profile <name>` or `-p <name>` as a runtime flag. Pass it through command and subagent handoffs to every companion helper call, including `task-resume-candidate`. Keep it out of the task prompt, including when rewriting the prompt.
- Omit the flag when the user has not requested a profile. Codex then uses the base config. Leave model and effort unset unless the user specifies them, so the profile defaults apply.
- If the user asks to choose a profile, ask which name to use before starting Codex.
- An explicit profile limits job selection for status, result and cancel. Without the flag, status/result can read all jobs and cancel uses the job's stored profile. Transfer includes the profile in its resume command.
