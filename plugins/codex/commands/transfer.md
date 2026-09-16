---
description: Transfer the current Claude Code session into a resumable Codex thread
argument-hint: "[--profile <name>] [--source <claude-jsonl>]"
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" transfer "$ARGUMENTS"`

Present the command output to the user exactly as returned. Preserve the Codex session ID and the `codex resume <session-id>` command.

Profile selection:
- Treat `--profile <name>` or `-p <name>` as a runtime flag. Pass it through command and subagent handoffs to every companion helper call, including `task-resume-candidate`. Keep it out of the task prompt, including when rewriting the prompt.
- Omit the flag when the user has not requested a profile. Codex then uses the base config. Leave model and effort unset unless the user specifies them, so the profile defaults apply.
- If the user asks to choose a profile, ask which name to use before starting Codex.
- An explicit profile limits job selection for status, result and cancel. Without the flag, status/result can read all jobs and cancel uses the job's stored profile. Transfer includes the profile in its resume command.
