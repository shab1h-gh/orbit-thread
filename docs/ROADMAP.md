# Roadmap

## Now

- [x] v1.3.0: Orbit Next read-only MCP (next actions, CI diagnosis, release readiness) on a staging Worker.
- [x] Production endpoint `https://mcp.orbit.convio.io/mcp` deployed on a Worker Custom Domain and set in both `plugin/mcp.json` and `plugin/.mcp.json`.
- [x] All three tools verified on the live endpoint (rate limit had reset); `worker/scripts/e2e.mjs` now separates protocol/security from functional checks and can never report a rate-limited run as a pass.
- [x] Optional operator-held `GITHUB_TOKEN` support implemented in the Worker (not yet configured in production; manual step in [OPERATIONS](OPERATIONS.md)).
- [ ] Deploy the token-aware Worker to production and set the secret (owner action).
- [ ] Review and merge the v1.3.0 pull request; tag and publish only after human approval.

## Next

- [ ] Workflow-log excerpts (needs a token with Actions read scope and bounded redaction; not planned while the token is public-only).
- [ ] Pagination for PRs and issues beyond the first page.
- [ ] Non-GitHub-Actions CI signals (commit statuses, check runs from other providers).
- [ ] Codex and Claude directory submissions for the MCP server, after the endpoint is stable.

## Later

- [ ] Monorepo-aware version checks (workspace manifests, Cargo, pyproject).
- [ ] Per-tool response-size budgets configurable by the caller.

## Not planned

- Write actions (comments, tags, releases, re-runs), private-repository access, persistent user data, or LLM inference inside the service.
