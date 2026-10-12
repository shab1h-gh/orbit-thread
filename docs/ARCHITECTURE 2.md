# Architecture

Orbit Thread has two deliberately separate halves.

## Local half (unchanged)

- `bin/` + `lib/`: dependency-free Node ≥ 20 CLI (`install`, `setup`, `configure`, `doctor`, `resume`, `update`, `uninstall`).
- `plugin/skills/`: the three canonical skills (`orbit-setup`, `handoff`, `orbit-resume`), copied to Codex and Claude locations by the CLI or shipped via the plugin ZIP / Claude marketplace.
- State is local: `HANDOFF-STATE.md` (overwrite-only, ≤ 50 lines, git-ignored), `.orbit-thread/config.json`, living docs. No network.

## Remote half: Orbit Next (`worker/`, v1.3.0)

A stateless Cloudflare Worker, `orbit-thread-mcp`, exposing three read-only MCP tools at `POST /mcp` (Streamable HTTP, JSON responses, no sessions, no SSE). It has its own `package.json`, lockfile and exact-pinned dependencies; the npm CLI never imports or ships it.

```text
MCP client ──HTTPS──▶ Worker /mcp ──GET──▶ api.github.com        (metadata)
                          │         └─GET─▶ raw.githubusercontent.com (fixed paths @ commit SHA)
                          └─ cache.default (≤ 5 min, public data only)
```

| Module | Responsibility |
| :--- | :--- |
| `src/index.ts` | HTTP surface: routing, Origin allowlist, method/content-type/size checks, rate-limit binding, one fresh `McpServer` + `WebStandardStreamableHTTPServerTransport` per request. |
| `src/tools.ts` | Tool registration, zod input schemas, compact JSON results, error mapping. |
| `src/validate.ts` | `owner`, `repo`, `run_id` grammar. |
| `src/github.ts` | The only network code: GET-only, fixed hosts, no redirects, timeouts, size caps, request budget, caching, rate-limit detection and fast-fail, optional token, concurrency cap, file-path allowlist, source-URL builders. |
| `src/sanitize.ts` | Control/bidi stripping, secret redaction, bounding. |
| `src/nextActions.ts`, `ci.ts`, `release.ts` | Pure deterministic analysis over fetched data. |

### Data rules

- Every claim is `verified` (read from GitHub), `heuristic` (a labelled rule) or an **unknown** (could not be read or not determinable). Nothing else is emitted.
- Priority ordering is `severity → verified-before-heuristic → stable id`. No clock reads except for age thresholds, and no randomness.
- Workflow logs are never read (they require authentication even for public repositories): CI evidence is job/step results plus check annotations.
- Release readiness is technical only. `humanApproval` is always `UNKNOWN`; `publication` is always `NOT_PERFORMED`.

### Deployment

`wrangler.jsonc` defines the production name `orbit-thread-mcp` and a `staging` environment (`orbit-thread-mcp-staging`). Neither binds storage; the only binding is a Cloudflare rate limiter. Production (`orbit-thread-mcp`) is served only from the Custom Domain `mcp.orbit.convio.io` (`workers_dev` is off), deployed manually with `wrangler deploy --env=""`; this repository's CI never deploys.

### Plugin wiring

MCP packaging is split by client. `plugin/mcp.json` is the portable Agent Plugins 1.0 file (`$schema`, `streamable-http`, a literal HTTPS URL; discovered at the plugin root, never referenced from the portable `plugin.json`, which declares no `mcpServers`). `plugin/.mcp.json` is the Claude Code configuration (type `http`, URL `${ORBIT_NEXT_URL:-…}`), referenced only by `.claude-plugin/plugin.json`. Both point at the production endpoint `https://mcp.orbit.convio.io/mcp` (a Cloudflare Worker Custom Domain on the `orbit-thread-mcp` Worker); the Claude file keeps `ORBIT_NEXT_URL` as an override for staging or self-hosting.

### GitHub access and reliability

`src/github.ts` is the only network code. Reliability controls: 4 concurrent requests, a 14-request budget per tool call, 8 s timeouts, 1 MB JSON / 200 KB text caps, a 5-minute edge cache of public bodies (never bodies marked `private`), and a per-isolate memory of exhausted quotas so later calls fail fast with the same retry hint instead of hammering GitHub.

Optional authentication: the Cloudflare secret `GITHUB_TOKEN` (see [OPERATIONS](OPERATIONS.md)) is attached only to `api.github.com` requests. Authenticated and unauthenticated quotas are tracked separately; a 401 degrades to unauthenticated for ten minutes and logs only the constant `github_token_rejected`. The cache key is the URL, never the credential, so cached data is identical for every caller. Public-repository-only access is enforced twice: by the token's scope and by `loadRepo` refusing any repository without `private: false`. Portable plugin config never carries tokens.
