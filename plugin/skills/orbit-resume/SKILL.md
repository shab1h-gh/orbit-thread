---
name: orbit-resume
description: Recover essential project context at the start of a fresh Codex or Claude Code conversation from the latest usable handoff, current Git state and only the living docs needed for the current task. Use once per new coding session, or when the user explicitly asks to resume project work.
---

# Orbit Thread Resume

Recover the current project state once at the beginning of a fresh coding conversation. Keep the context small and preserve unfinished changes.

## Workflow

1. If the user already supplied output from `npx orbit-thread resume` in this conversation, use it. Otherwise inspect `HANDOFF-STATE.md` once if it exists, then run read-only `git status --short --branch`, `git diff --stat HEAD`, and `git log -1 --oneline` from the project root. Do not invoke npm, install tools, or search the repository broadly.
2. Treat the handoff as a lead. Current Git state and tracked project docs override stale or conflicting handoff details. A missing or malformed handoff is not a reason to invent the objective or completed work; use the user's current request and state what remains unknown.
3. Preserve all dirty and untracked work. Never reset, clean, stash, stage, commit, checkout, deploy, or otherwise change repository state.
4. Read only the living doc that directly informs the current requested task: PRODUCT for scope or behaviour, DESIGN for UI, ARCHITECTURE for runtime/data flow, SECURITY for trust/auth/secrets, ROADMAP for planning. Use its existing root or `docs/` location. Do not load unrelated docs or repeat facts already clear from the handoff.
5. Give the user a compact summary of the objective, verified milestones, unfinished work, risks, verification, Git state, and immediate next action. Separate facts from unknowns. End with one clear next action grounded in the current request and repository evidence.

Run this skill once per fresh conversation. Do not repeat it during the same session unless the user asks for a fresh recovery. If the host cannot invoke it automatically, the reliable fallback is `$orbit-resume` in Codex, `/orbit-resume` in Claude Code, or `/orbit-thread:orbit-resume` from the Claude marketplace plugin.

## Safety

- Read only the handoff, Git summaries, and task-relevant living docs. Never read `.env`, `.dev.vars`, credentials, private keys, or unrelated files.
- Do not echo secret-looking values or sensitive local file paths. Keep the user's unfinished work intact.
- The `npx orbit-thread resume` CLI command is read-only and can be run by the developer for a concise terminal summary. Do not run `npx` from this skill because it can download packages when the CLI is unavailable.
- Do not claim a check, test, deployment, commit, or external action unless current evidence confirms it.
