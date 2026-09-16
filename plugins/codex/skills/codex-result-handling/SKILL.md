---
name: codex-result-handling
description: Internal guidance for presenting Codex helper output back to the user
user-invocable: false
---

# Codex Result Handling

When the helper returns Codex output:
- Preserve the helper's verdict, summary, findings, and next steps structure.
- For review output, present findings first and keep them ordered by severity.
- Use the file paths and line numbers exactly as the helper reports them.
- Preserve evidence boundaries. If Codex marked something as an inference, uncertainty, or follow-up question, keep that distinction.
- Preserve output sections when the prompt asked for them, such as observed facts, inferences, open questions, touched files, or next steps.
- If there are no findings, say that explicitly and keep the residual-risk note brief.
- If Codex made edits, say so explicitly and list the touched files when the helper provides them.
- For `codex:codex-rescue`, do not turn a failed or incomplete Codex run into a Claude-side implementation attempt. Report the failure and stop.
- For `codex:codex-rescue`, if Codex was never successfully invoked, do not generate a substitute answer at all.
- CRITICAL: After presenting review findings, STOP. Do not make any code changes. Do not fix any issues. You MUST explicitly ask the user which issues, if any, they want fixed before touching a single file. Auto-applying fixes from a review is strictly forbidden, even if the fix is obvious.
- If the helper reports malformed output or a failed Codex run, include the most actionable stderr lines and stop there instead of guessing.
- If the helper reports that setup or authentication is required, direct the user to `/codex:setup` and do not improvise alternate auth flows.

Profile selection:
- Treat `--profile <name>` or `-p <name>` as a runtime flag. Pass it through command and subagent handoffs to every companion helper call, including `task-resume-candidate`. Keep it out of the task prompt, including when rewriting the prompt.
- Omit the flag when the user has not requested a profile. Codex then uses the base config. Leave model and effort unset unless the user specifies them, so the profile defaults apply.
- If the user asks to choose a profile, ask which name to use before starting Codex.
- An explicit profile limits job selection for status, result and cancel. Without the flag, status/result can read all jobs and cancel uses the job's stored profile. Transfer includes the profile in its resume command.
