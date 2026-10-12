---
name: handoff
description: Use Orbit Thread to overwrite HANDOFF-STATE.md with a compact, secret-free checkpoint of verified coding state. Invoke when the user asks for a handoff, when Orbit Thread project instructions require a meaningful checkpoint, before a fresh/cleared session, or before finalising a completed coding task whose repository state or durable project truth changed.
---

# Orbit Thread Handoff

Write concise current operational state for the next session, not a changelog or transcript.

## Workflow

1. Gather state once: `date '+%d-%m-%Y %H:%M'; git status --short --branch; git diff --stat HEAD; git log -1 --oneline`. If Git is unavailable, record that fact and use only current-session evidence. Reuse a handoff already read this session; otherwise read it once. Consult only files changed or discussed for the current work.
2. Reconcile previous state with current evidence. Keep only facts still true and work still relevant. Drop resolved, superseded or duplicated history. Repository state and relevant tracked docs override stale handoff content.
3. Pipe the new Markdown to this skill's `scripts/write_handoff.sh`, resolving the script relative to the loaded skill directory. In Claude Code, `${CLAUDE_SKILL_DIR}/scripts/write_handoff.sh` resolves that location; in Codex, use the loaded skill directory. Quote the path and run it with `sh`.
4. The writer overwrites repo-root `HANDOFF-STATE.md` atomically, rejects empty/over-50-line/obviously secret-bearing content, and prints the line count. Do not re-read after a successful write.
5. If this is an intermediate checkpoint and the current request still has unfinished work, continue. If the task is complete, return the normal final response.

## Format

```markdown
# Handoff State

Updated: DD-MM-YYYY HH:MM

## Current objective
## Completed milestones
## In progress
## Current state
## Decisions
## Open issues / risks
## Immediate next steps
## Verification
```

Omit empty sections. Aim for about 30 lines; hard cap 50. State each fact once. Immediate next steps must be genuinely outstanding.

## Rules

- Checkpoint after meaningful verified milestones and completed coding tasks when the configured project rules require it; skip read-only questions and trivial edits.
- Use read-only Git inspection only. Never commit, stage, amend, push, reset or otherwise mutate Git.
- Evidence only. Never claim a test, deployment, commit, push or external action happened without evidence.
- Never include secrets, credentials, tokens, private keys, recovery codes, `.env`/`.dev.vars` values, personal data or sensitive production data.
- Do not record the current HEAD SHA; it becomes stale easily. Exact SHAs are allowed only for immutable earlier revisions such as releases, deployments or rollback points.
- When Git is available, record the current branch as `Branch: <name>` under `Current state` so a later Resume can detect a branch change. Never record the current HEAD SHA.
- `HANDOFF-STATE.md` is local current state, intended to be Git-ignored. Never append history or make committing it a next step.
- Durable product, design, architecture, security or roadmap truth belongs in tracked living docs. Handoff does not replace those files.
- At an intermediate checkpoint, do not stop merely because the handoff was written.
