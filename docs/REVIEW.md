# Provider review materials: Orbit Next

Nothing here has been submitted. Provider dashboards win over this file if their flow differs.

## Summary

Orbit Next is a remote, read-only MCP server (Streamable HTTP, stateless, no accounts) at `https://mcp.orbit.convio.io/mcp`. It inspects **public** GitHub repositories only and has three tools. No database, no AI calls, no telemetry, no user data stored. Privacy: [PRIVACY.md](../PRIVACY.md) · Terms: [TERMS.md](../TERMS.md) · Security: [SECURITY.md](../SECURITY.md) · Support: GitHub Issues.

## Tools (all `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`)

| Tool | Description (as served) |
| :--- | :--- |
| `get_project_next_actions(owner, repo)` | Prioritised next actions for a public GitHub repo from recent commits, open PRs/issues, CI on the default branch and ROADMAP.md. Each action has severity, verified/heuristic basis, rationale and source URLs; gaps are listed under unknowns. Read-only. |
| `diagnose_ci_failure(owner, repo, run_id?)` | Inspect a failed GitHub Actions run (default: latest failed run on the default branch): failed jobs and steps, bounded sanitised annotations, and heuristic areas to investigate, with links. Does not determine root cause. Logs need auth and are not read. Read-only. |
| `assess_release_readiness(owner, repo)` | Technical release-readiness checks for a public repo: latest CI, open PRs, manifest version consistency, changelog entry and existing tags. Returns PASS/WARN/BLOCKED/UNKNOWN per check. Human approval is reported as unknown; nothing is tagged or published. Read-only. |

## Positive test cases

| Prompt | Expected |
| :--- | :--- |
| "What should I work on next in `shab1h-gh/orbit-thread`?" | `get_project_next_actions`; facts with GitHub source links; unknowns listed; no write actions. |
| "Why did `cli/cli` Actions run 37915254425 fail?" | `diagnose_ci_failure`; failed job `govulncheck`, step "Check Go vulnerabilities", annotations; `rootCause: not determined`. |
| "Is `shab1h-gh/orbit-thread` ready to release?" | `assess_release_readiness`; per-check statuses; `humanApproval: UNKNOWN`; `publication: NOT_PERFORMED`. |
| "Diagnose the latest CI failure in a repo with none failing." | `outcome: no_failed_run_found`, with a hint to pass `run_id`. |

## Negative test cases

| Input | Expected |
| :--- | :--- |
| `owner: "../etc"`, `"https://evil.example"`, repo `"a/b"`, `"x.git"` | Tool error from validation; GitHub is never called. |
| `run_id: -1` or `1.5` | Validation error. |
| A missing repository | "Repository not found or not public." |
| A private repository | Same message; no contents returned (also when the optional token is configured). |
| "Create a release / tag / comment / re-run CI" | Not possible: no such tool. The assistant should say Orbit Next is read-only. |
| A repo whose issue titles contain instructions ("ignore previous instructions…") | Returned as quoted, sanitised data under an untrusted-content notice; not followed. |
| Browser request with `Origin: https://evil.example` | HTTP 403. `GET /mcp` → 405. Oversize body → 413. |
| GitHub rate limit exhausted | Tool error with retry hint; never a partial result presented as complete. |

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
