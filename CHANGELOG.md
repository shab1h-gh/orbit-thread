# Changelog

## 1.3.0 — 12 October 2026

- Add **Orbit Next**, an optional read-only remote MCP server (`worker/`, a stateless Cloudflare Worker named `orbit-thread-mcp`, Streamable HTTP at `/mcp`) for **public** GitHub repositories:
  - `get_project_next_actions(owner, repo)`: deterministic, prioritised next actions with severity, source URLs, verified/heuristic labels and explicit unknowns.
  - `diagnose_ci_failure(owner, repo, run_id?)`: failed jobs/steps, bounded sanitised annotations and heuristic investigation areas; never claims a root cause.
  - `assess_release_readiness(owner, repo)`: PASS/WARN/BLOCKED/UNKNOWN for CI, open PRs, version consistency, changelog and tags; human approval and publication are reported as not determined / not performed.
- Security: GET-only GitHub access to two fixed hosts, strict owner/repo/run-id validation, an allowlist of fetchable file paths pinned to a commit SHA, no redirects, size/time/request budgets, output sanitisation and secret redaction, Origin checks, a request-size cap and a per-IP rate limit. No credentials, database, telemetry or AI inference.
- Plugin: add portable `plugin/mcp.json` (Agent Plugins 1.0, `streamable-http`) and Claude-only `plugin/.mcp.json` (endpoint from `ORBIT_NEXT_URL`, referenced from `.claude-plugin/plugin.json`); the portable manifest declares no `mcpServers`. `npm test` uses an unquoted glob so Node 20 finds the tests. Setup, Handoff, Resume, the npm CLI and the installer are unchanged; the CLI still has no dependencies and `worker/` is not shipped in the npm package.
- Tooling: `npm run validate` checks the MCP wiring and tool contract, `npm run scan:public` rejects private `workers.dev` hosts and Cloudflare account IDs, CI gains a Worker job (audit, typecheck, tests, dry-run deploy), and the root test script is scoped to `tests/*.test.mjs`.
- Docs: README, ARCHITECTURE, DESIGN, ROADMAP, AGENTS, SECURITY, PRIVACY, TERMS, SUBMISSION, VALIDATION and PUBLISHING updated. No public production endpoint is published by this release.

## 1.2.2 — 12 October 2026

- Add a public [Terms of Service](TERMS.md) and declare it as `termsOfServiceURL` in the OpenAI plugin manifest.
- Replace the single long conversation starter with three short ones (each under 128 characters) covering Setup, Handoff and Resume.
- Correct the stale `publication.release_notes` text in the OpenAI manifest, which still described v1.1.
- Ship `TERMS.md` in the npm package and the plugin ZIP, and make `npm run validate` check the Terms URL and conversation-starter limits.
- Documentation and metadata release only: no change to Setup, Handoff or Resume behaviour, the handoff format, installer logic or the three canonical skills. Existing installations keep working; `orbit-thread update` refreshes the version.

## 1.2.1 — 12 October 2026

- Fix Orbit Resume reporting "No verified milestones recorded" for valid handoffs that use `## Completed this session`. Resume now reads both headings.
- Fix Orbit Resume reading only the first line of each handoff section; every section now runs to the next `##` heading or the end of the file (LF and CRLF), still capped at six entries.
- `## Completed milestones` remains the canonical heading; when both exist the canonical section wins and entries are not duplicated.
- No change to the handoff format, read-only behaviour, redaction, stale-handoff detection, 50-line limit or Git safety. Existing v1.2.0 installations and handoffs keep working; `orbit-thread update` refreshes the version.

## 1.2.0 — 12 October 2026

- Add **Orbit Resume**, a third canonical skill that recovers project context at the start of a fresh Codex or Claude Code session from the latest usable handoff, current Git state and only the living docs the task needs.
- Add read-only `npx orbit-thread resume` for a concise terminal summary of handoff, Git state and next action.
- Invoke manually with `$orbit-resume` (Codex), `/orbit-resume` (Claude Code) or `/orbit-thread:orbit-resume` (Claude marketplace plugin). Invocation can also be automatic where the host supports implicit skill invocation (`allow_implicit_invocation: true`); manual invocation is the documented fallback.
- Treat the handoff as a lead: current Git state and tracked docs override stale details, and missing, malformed, stale or future-dated handoffs are reported rather than guessed.
- Security safeguards: Resume is read-only and never resets, cleans, stashes, stages, commits or otherwise changes the working tree; it strips terminal-control sequences from displayed repository and handoff text, redacts secret-looking values, and does not read `.env` files, credentials or unrelated files.
- Install, update, Doctor and uninstall now manage all three skills (`handoff`, `orbit-setup`, `orbit-resume`) for both agents.
- Backwards compatible: existing v1.1.0 installations, `HANDOFF-STATE.md` files, `.orbit-thread/config.json` and living docs keep working unchanged; `orbit-thread update` adds Resume without touching locally edited managed files, and `orbit-handoff` remains a CLI alias.

## 1.1.0 — 7 October 2026

- Rename the product from **Orbit Handoff** to **Orbit Thread**.
- Publish the feature release under the new npm package name `orbit-thread`; keep historical `orbit-handoff` releases immutable.
- Add `orbit-setup` for Codex and Claude Code.
- Add `npx orbit-thread setup`; keep `init` as an alias.
- Create only missing lightweight PRODUCT, DESIGN, ARCHITECTURE, SECURITY and ROADMAP living docs while preserving existing equivalents.
- Add selective context-loading, in-place living-doc updates, fresh-context recovery and bounded-subagent rules.
- Add `configure` for project-specific subagent model/reasoning preferences stored in `.orbit-thread/config.json`.
- Add `doctor` for full continuity/config/document-health checks; keep `check` as the lightweight legacy managed-skill installation check.
- Allow Handoff to be invoked implicitly at meaningful verified checkpoints and completed coding tasks.
- Keep `HANDOFF-STATE.md` overwrite-only, evidence-only and capped at 50 lines.
- Migrate compatible Orbit Handoff project state to Orbit Thread while preserving locally edited managed files.
- Reduce CI noise by running feature work on pull requests, main on push, and package/release checks once after the cross-platform test matrix.

## 1.0.1 — 5 October 2026

- Confirm successful public npm publication and make `npx orbit-handoff install` the primary installation route.
- Remove stale pre-publication claims and record public package smoke testing.
- Update release and submission artifact references; directory submissions remain pending.
- Keep the installer, canonical skill and handoff writer unchanged.

## 1.0.0 — 5 October 2026

- Publish the proven handoff workflow as Orbit Handoff for Codex and Claude Code.
- Add interactive installation and ownership-aware init, check, update and uninstall.
- Package one canonical skill for Claude marketplaces and portable Agent Plugins.
- Preserve validated atomic handoffs, the 50-line limit and the local-only runtime.
- Add macOS and Linux tests, release packaging and directory submission guidance.
