# Roadmap

## Now

- [x] v1.3.0: Orbit Next read-only MCP (next actions, CI diagnosis, release readiness) on a staging Worker.
- [x] Production endpoint `https://mcp.orbit.convio.io/mcp` deployed on a Worker Custom Domain and set in both `plugin/mcp.json` and `plugin/.mcp.json`.
- [ ] Re-verify all three tools on the live endpoint once GitHub's shared-egress rate limit has reset (it was exhausted during the first production check).
- [ ] Review and merge the v1.3.0 pull request; tag and publish only after human approval.

## Next

- [ ] Optional operator-held GitHub token (Worker secret, never in the repo) to lift the 60/hour unauthenticated limit and unlock workflow logs, with bounded redaction.
- [ ] Pagination for PRs and issues beyond the first page.
- [ ] Non-GitHub-Actions CI signals (commit statuses, check runs from other providers).
- [ ] Codex and Claude directory submissions for the MCP server, after the endpoint is stable.

## Later

- [ ] Monorepo-aware version checks (workspace manifests, Cargo, pyproject).
- [ ] Per-tool response-size budgets configurable by the caller.

## Not planned

- Write actions (comments, tags, releases, re-runs), private-repository access, persistent user data, or LLM inference inside the service.
