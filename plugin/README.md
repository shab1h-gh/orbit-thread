# Orbit Thread

Orbit Thread provides three local coding skills:

- **Orbit Setup** prepares a project with lightweight living docs, selective context rules and configurable subagent preferences.
- **Handoff** overwrites a compact, evidence-only `HANDOFF-STATE.md` so a fresh coding session can resume from Git + current project truth rather than a large old conversation.
- **Resume** reconstructs concise project context from the latest usable handoff, current Git state and task-relevant living docs.

Standalone commands:

- Codex: `$orbit-setup`, `$handoff` and `$orbit-resume`
- Claude Code: `/orbit-setup`, `/handoff` and `/orbit-resume`

Claude plugin commands:

- `/orbit-thread:orbit-setup`
- `/orbit-thread:handoff`
- `/orbit-thread:orbit-resume`

Setup creates only missing PRODUCT, DESIGN, ARCHITECTURE, SECURITY and ROADMAP templates, preserves existing equivalents, manages a concise Orbit Thread section in AGENTS.md/CLAUDE.md, and keeps local handoff/tool state Git-ignored.

Start each coding task in a fresh chat and run Resume once at session start, automatically where supported or manually as a fallback. The project rules update living docs in place, load only relevant context, default to no subagents with a maximum of two, and request Handoff after meaningful verified milestones/completed coding tasks.

Handoff is overwrite-only, capped at 50 lines, secret-checked before atomic replacement and makes no network calls or Git mutations. Resume and `npx orbit-thread resume` are read-only and preserve unfinished work.

## Orbit Next (optional remote MCP)

`mcp.json` (portable Agent Plugins 1.0, Streamable HTTP) and `.mcp.json` (Claude Code, URL from `ORBIT_NEXT_URL`) declare the `orbit-next` MCP server. Its three read-only tools inspect **public GitHub repositories**: `get_project_next_actions`, `diagnose_ci_failure` and `assess_release_readiness`. It is separate from the local skills: Resume reads only your local handoff and Git state, while Orbit Next fetches public GitHub metadata for an `owner/repo` you name. It needs no account, uses no AI inference and stores nothing. There is no telemetry.

See the project README for installation, migration and update instructions.
