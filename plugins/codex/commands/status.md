---
description: Show active and recent Codex jobs for this repository, including review-gate status
argument-hint: '[--profile <name>] [job-id] [--wait] [--timeout-ms <ms>] [--all]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" status "$ARGUMENTS"`

If the user did not pass a job ID:
- Render the command output as a single Markdown table for the current and past runs in this session.
- Keep it compact. Do not include progress blocks or extra prose outside the table.
- Preserve the actionable fields from the command output, including job ID, kind, status, phase, elapsed or duration, summary, and follow-up commands.

If the user did pass a job ID:
- Present the full command output to the user.
- Do not summarize or condense it.

Profile selection:
- Treat `--profile <name>` or `-p <name>` as a runtime flag. Pass it through command and subagent handoffs to every companion helper call, including `task-resume-candidate`. Keep it out of the task prompt, including when rewriting the prompt.
- Omit the flag when the user has not requested a profile. Codex then uses the base config. Leave model and effort unset unless the user specifies them, so the profile defaults apply.
- If the user asks to choose a profile, ask which name to use before starting Codex.
- An explicit profile limits job selection for status, result and cancel. Without the flag, status/result can read all jobs and cancel uses the job's stored profile. Transfer includes the profile in its resume command.
