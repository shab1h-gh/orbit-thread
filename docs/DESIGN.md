# Design

Orbit Thread is a developer tool; its "interface" is text read by people and AI assistants.

## Principles

- **Lean context.** Load only what the task needs. Prefer a 50-line handoff over a transcript.
- **Evidence over assertion.** Say what was verified, label what is heuristic, list what is unknown. Never invent priorities or completed work.
- **Repository is truth.** Git and tracked docs override stale notes.
- **Safe by default.** Read-only where possible; preserve user files; no surprises.

## Orbit Next response design

- Compact single-line JSON in one text content block (no duplicated structured payload) to keep tokens down.
- Stable vocabulary: severities `critical|high|medium|low|info`; basis `verified|heuristic`; check status `PASS|WARN|BLOCKED|UNKNOWN`.
- Every action or check carries source URLs a person can open.
- Lists are capped (12 actions, 5 failed jobs, 5 annotations per job, 240 characters per message) and say when something was omitted.
- Tool descriptions state inputs, what is returned and that the tool is read-only; schemas are minimal (`owner`, `repo`, optional `run_id`).
- Repository-derived text is always flattened and accompanied by a notice that it is untrusted.
