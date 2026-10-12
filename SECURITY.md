# Security

Orbit Thread keeps handoff and project-continuity state local.

The Handoff writer makes no network requests and does not mutate Git. It validates a temporary file before replacing the previous handoff with a same-directory atomic rename. Failed validation leaves the previous file intact and removes temporary residue. New handoffs inherit `mktemp`'s restrictive permissions.

The secret check is a backstop for recognisable credential/private-key patterns, not a complete DLP system. Rejection messages include line numbers rather than matched content.

The npm CLI copies the same canonical skills to supported agents. It records file hashes, refuses unmanaged skill collisions or locally edited managed installations, preserves edited files during uninstall and rejects symlinked destinations. Setup uses ownership-tracked instruction blocks, preserves unrelated instructions and existing living docs, and writes project subagent preferences only into Orbit Thread's managed AGENTS.md block.

There are no runtime npm dependencies or postinstall hooks in the npm CLI.

## Orbit Next (remote MCP)

Orbit Next is the only networked component. It is a stateless Cloudflare Worker (`worker/`) that reads **public** GitHub data. Its security model:

- **Read-only.** The GitHub client issues only `GET` requests and sends no cookies. There are no write tools. Tool annotations declare `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`.
- **Optional operator token.** Without configuration the Worker is unauthenticated. If the operator sets the Cloudflare secret `GITHUB_TOKEN` (a fine-grained token with *Public repositories (read-only)* access and no other permissions, short expiry), it is sent as `Authorization` only to `api.github.com` (never to `raw.githubusercontent.com`), never logged, cached, echoed in results, errors or headers, and never accepted from clients. Every tool still verifies `private: false` and refuses anything else; responses marked private are never cached. A rejected token (401) degrades to unauthenticated access for ten minutes. Rotation and revocation: [docs/OPERATIONS.md](docs/OPERATIONS.md).
- **No SSRF or arbitrary fetch.** Hosts are fixed (`api.github.com`, `raw.githubusercontent.com`). URLs are built only from validated inputs; `owner` (GitHub name grammar), `repo` (`[A-Za-z0-9._-]`, no `.`/`..`/`.git`) and `run_id` (positive safe integer) are validated before use. Redirects are never followed. API paths must start with `/repos/`.
- **No path traversal or local access.** Only eight fixed repository paths (manifests, `CHANGELOG.md`, `ROADMAP.md`) can be fetched, pinned to a full commit SHA. `HANDOFF-STATE.md` and arbitrary paths are never requested. The Worker has no filesystem, database or storage bindings.
- **Untrusted content.** Commit messages, titles, labels, annotations and documents are treated as data: never executed, never used to choose URLs, stripped of control and bidi characters, redacted for secret-like values, flattened to one line and length-bounded. Every result carries a notice that repository text is not instructions. Workflow logs are not read.
- **Abuse limits.** 16 KiB request bodies, POST-only stateless `/mcp`, `application/json` required, `Origin` allowlist (DNS-rebinding protection; non-browser clients send no Origin), a per-IP Cloudflare rate-limit binding (30 requests/minute; if the limiter itself errors the Worker fails open, because GitHub quota, the request budget and the concurrency cap still bound the damage), 8 s upstream timeouts, size-capped responses, a per-call upstream request budget (14), at most four concurrent GitHub requests, a fast-fail once a GitHub quota is known to be exhausted, and a 5-minute response cache of public data.
- **Honest failure.** GitHub rate limits, missing or private repositories and upstream errors produce explicit tool errors; upstream bodies and stack traces are not echoed.
- **Supply chain.** Worker dependencies are separate from the CLI, pinned exactly, installed with `--ignore-scripts` in CI, and audited with `npm audit`.

Limits: public data only; sanitisation and redaction are best-effort, not DLP; sanitised repository text can still be misleading, so agents should keep treating it as untrusted.

`npx` and plugin installation may access their registries or GitHub. Your coding agent uses its own provider and permissions; Orbit Thread does not expand those permissions or sandbox the host agent.

Please report vulnerabilities privately through the repository security advisory form after the repository rename:
`https://github.com/shab1h-gh/orbit-thread/security/advisories/new`

Use synthetic data in reports. Never put live secrets or private project state in public issues.
