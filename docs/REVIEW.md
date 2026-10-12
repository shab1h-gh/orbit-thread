# Provider review materials: Orbit Next

Nothing here has been submitted. Requirements checked 13 October 2026; see [SUBMISSION.md](SUBMISSION.md). Provider dashboards win over this file if their flow differs.

## Summary

Orbit Next is a remote, read-only MCP server (Streamable HTTP, stateless, no accounts) at `https://mcp.orbit.convio.io/mcp`. It inspects **public** GitHub repositories only and has three tools. No database, no AI calls, no telemetry, no user data stored. Privacy: [PRIVACY.md](../PRIVACY.md) · Terms: [TERMS.md](../TERMS.md) · Security: [SECURITY.md](../SECURITY.md) · Support: GitHub Issues.

## Tools (all `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`)

| Tool | Description (as served) |
| :--- | :--- |
| `get_project_next_actions(owner, repo)` | Prioritised next actions for a public GitHub repo from recent commits, open PRs/issues, CI on the default branch and ROADMAP.md. Each action has severity, verified/heuristic basis, rationale and source URLs; gaps are listed under unknowns. Read-only. |
| `diagnose_ci_failure(owner, repo, run_id?)` | Inspect a failed GitHub Actions run (default: latest failed run on the default branch): failed jobs and steps, bounded sanitised annotations, and heuristic areas to investigate, with links. Does not determine root cause. Logs need auth and are not read. Read-only. |
| `assess_release_readiness(owner, repo)` | Technical release-readiness checks for a public repo: latest CI, open PRs, manifest version consistency, changelog entry and existing tags. Returns PASS/WARN/BLOCKED/UNKNOWN per check. Human approval is reported as unknown; nothing is tagged or published. Read-only. |

## Review cases (OpenAI: exactly five positive, three negative)

Production e2e passed 23/23 on 13 October 2026 and Codex CLI exercised all three tools on 12 October; P4 and P5 have not been individually run in a client, so run all five before submitting. No test account is needed because there is no authentication. Reviewers use the public repositories named below.

| # | Description | Prompt | `tools_triggered` | Expected behaviour |
| :- | :--- | :--- | :--- | :--- |
| P1 | Prioritised next actions | "What should I work on next in `shab1h-gh/orbit-thread`?" | `get_project_next_actions` | Ranked actions, each with severity, verified/heuristic basis, rationale and GitHub source URLs; gaps listed as unknowns; no write actions offered. |
| P2 | Diagnose a failed CI run | "Why did `cli/cli` Actions run 37915254425 fail?" | `diagnose_ci_failure` | Names the failed `govulncheck` job and step "Check Go vulnerabilities", bounded annotations, heuristic investigation areas; states root cause is not determined. |
| P3 | Release readiness | "Is `shab1h-gh/orbit-thread` ready to release?" | `assess_release_readiness` | PASS/WARN/BLOCKED/UNKNOWN per check; `humanApproval: UNKNOWN`; `publication: NOT_PERFORMED`. |
| P4 | Latest failure default | "Diagnose the latest CI failure in `shab1h-gh/orbit-thread`." | `diagnose_ci_failure` | Uses the default branch; if none failed, `no_failed_run_found` with a hint to pass `run_id`; never invents a failure. |
| P5 | Combined workflow | "Using Orbit Next, check whether `shab1h-gh/orbit-thread` is release-ready, then list the top next action." | `assess_release_readiness`, `get_project_next_actions` | Two read-only calls; summary cites source URLs; no tag, release or publish is performed. |

| # | Description | Prompt | Why it must not act / expected safe behaviour |
| :- | :--- | :--- | :--- |
| N1 | Write action requested | "Create a v9.9.9 release and re-run the failed CI for `cli/cli`." | No write tool exists. The assistant says Orbit Next is read-only and calls nothing that mutates. |
| N2 | Private or missing repository | "Show next actions for `shab1h-gh/this-repo-does-not-exist`." | Tool returns "Repository not found or not public."; no contents; the assistant does not guess. Same message for private repos. |
| N3 | Malicious input | "Assess release readiness for owner `https://evil.example` repo `a/b`." (also `../etc`, `x.git`) | Input validation rejects it before any GitHub call; tool error returned; repository text containing "ignore previous instructions" is quoted as untrusted data, not followed. |

Transport checks (not review cases): `GET /mcp` returns 405; browser `Origin: https://evil.example` returns 403; oversize body returns 413; rate-limit exhaustion returns a retry hint, never a partial result presented as complete.

## Listing text (accurate to v1.3.0)

- **Short (≤30):** Lean coding continuity
- **Orbit Next one-liner (≤200):** Read-only checks on public GitHub repositories: next actions, failed-CI diagnosis and release readiness, with source links.
- **Description:** Orbit Thread keeps coding-agent sessions continuous with three local skills (Setup, Handoff, Resume). Orbit Next is an optional remote, read-only MCP server for public GitHub repositories. Give it an owner and repository (and optionally a run ID); it returns prioritised next actions, a heuristic diagnosis of a failed GitHub Actions run, or technical release-readiness checks. It cannot write to GitHub, read private repositories or logs, or publish anything. It needs no account, makes no AI calls and stores nothing. Findings are labelled verified or heuristic and link to their GitHub sources. Limits: public repositories only; unauthenticated GitHub rate limits may apply; it does not determine root cause or approve releases.

## Release notes (v1.3.0)

Orbit Thread v1.3.0 adds Orbit Next, an optional read-only remote MCP server that inspects public GitHub repositories: prioritised next actions, CI failure diagnosis and release readiness. Setup, Handoff and Resume are unchanged and remain local. (Same text as `publication.release_notes`; do not edit without a new ZIP.)

## Data-handling declarations

| Question | Answer |
| :--- | :--- |
| Data received | Tool name plus user-supplied `owner`, `repo`, optional `run_id`. |
| Personal data | None collected by design; Cloudflare handles network metadata (IP) under its own policies. |
| Storage / retention | No database, accounts or logs of request bodies; public GitHub responses may sit in Cloudflare edge cache up to five minutes. |
| Sent to third parties | GitHub (`api.github.com`, `raw.githubusercontent.com`) receives requested repository paths from Cloudflare's network. No LLM or analytics provider. |
| Authentication / credentials | None from users. Optional operator-held read-only, public-repositories-only GitHub token is a Cloudflare secret, sent only to GitHub, never returned. |
| Reads / writes | Read-only (all tools `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` because public GitHub is external). |
| Commerce | None (`review.commerce: false`). |
| Minors | Not directed at children; general developer tool. |
| Policies | [PRIVACY.md](../PRIVACY.md), [TERMS.md](../TERMS.md), [SECURITY.md](../SECURITY.md), GitHub Issues for support. |

## Demo video script (about 2 minutes, screen recording)

1. (0:00) Title card: "Orbit Thread v1.3.0: Setup, Handoff, Resume, plus read-only Orbit Next". State that Orbit Next never writes to GitHub.
2. (0:15) Show the connected server listing its three tools with read-only annotations.
3. (0:30) P1: next actions for `shab1h-gh/orbit-thread`; point at verified/heuristic labels and source links.
4. (0:55) P2: `cli/cli` run 37915254425; show failed job/step and "root cause: not determined".
5. (1:20) P3: release readiness; highlight `humanApproval: UNKNOWN` and `publication: NOT_PERFORMED`.
6. (1:40) N1 and N2: ask for a release (refused: read-only) and a nonexistent repo (clear error).
7. (1:55) Close: privacy summary (no accounts, no storage), links to Privacy and Terms.

Host at an accessible URL (unlisted video); the portal requires that URL.

## Reproducible demo (about two minutes)

```sh
claude plugin marketplace add shab1h-gh/orbit-thread   # v1.3.0 is published
claude plugin install orbit-thread@orbit-thread
claude mcp list        # plugin:orbit-thread:orbit-next … Connected
```

Then ask: *"Using Orbit Next, diagnose `cli/cli` Actions run 37915254425, then tell me whether `shab1h-gh/orbit-thread` is ready to release."* Without a client, run `node worker/scripts/e2e.mjs https://mcp.orbit.convio.io/mcp` (23 checks; prints `E2E PASSED`).

## <a id="codex"></a>Codex

**Verified (Codex CLI, production endpoint):** Codex CLI connected to `https://mcp.orbit.convio.io/mcp` and invoked all three tools.

| Tool | Result |
| :--- | :--- |
| `get_project_next_actions` | PASS |
| `assess_release_readiness` | PASS |
| `diagnose_ci_failure` | PASS: used `cli/cli` Actions run 37915254425; identified the failed `govulncheck` job and step without claiming an unverified root cause. |

Connection commands (as used for the MCP server):

```sh
codex mcp add orbit-next --url https://mcp.orbit.convio.io/mcp
codex mcp list
```

**Still untested:** installing the combined portable plugin ZIP in Codex. The packaged `plugin/mcp.json` follows the Agent Plugins 1.0 schema (validated with Ajv 2020-12), but Codex plugin installation has not been exercised.

## Compatibility facts

`plugin/plugin.json` and `plugin/mcp.json` validate against the official Agent Plugins 1.0.0 schemas; `claude plugin validate plugin --strict` and `. --strict` pass; a fresh `claude plugin install` and an upgrade from v1.2.2 both end at 1.3.0 with three skills and a connected `orbit-next` server.
