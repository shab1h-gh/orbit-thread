# Operations: Orbit Next

Production: Worker `orbit-thread-mcp` at `https://mcp.orbit.convio.io/mcp` (Custom Domain, `workers_dev` off). Staging: `orbit-thread-mcp-staging` (`--env staging`, `workers_dev` on). They share no bindings, secrets or rate-limiter namespaces. CI never deploys. Deploys, secrets and rollbacks are owner actions.

## Deploy

```sh
cd worker && npm ci --ignore-scripts
npm run typecheck && npm test
npx wrangler deploy --env staging                    # staging
node scripts/e2e.mjs https://<staging-host>/mcp      # must print E2E PASSED
npx wrangler deploy --env=""                         # production, after owner approval
node scripts/e2e.mjs https://mcp.orbit.convio.io/mcp
```

Acceptance: exit 0 and `E2E PASSED`. Exit 2 (`INCONCLUSIVE`) means GitHub quota or missing evidence prevented real results; it is not a pass. Exit 1 is a failure. The script paces itself under the 30 requests/minute limiter, so a run takes about a minute.

Confirm production matches source: `npx wrangler deployments list --env=""` shows the latest deployment; compare its time with the merge commit, and check `/health` reports the expected `version`.

## Optional GitHub token (owner action)

Without it the Worker works unauthenticated (60 GitHub requests/hour shared per egress IP). To raise the limit:

1. GitHub → Settings → Developer settings → Fine-grained tokens → Generate. Resource owner: your account. Expiration: 90 days or less. Repository access: **Public repositories (read-only)**. Permissions: **none** (add nothing).
2. Store it as a Worker secret. Paste when prompted; never put it in a file, command line, chat or commit:

```sh
cd worker
npx wrangler secret put GITHUB_TOKEN --env staging   # try staging first
npx wrangler secret put GITHUB_TOKEN --env=""        # production
```

3. Re-run `node scripts/e2e.mjs <endpoint>`. Secrets apply on the next request; no code deploy is needed (the token-aware code must already be deployed).

**Rotate:** create a new token, run `wrangler secret put` again, then delete the old token in GitHub. **Revoke/disable:** delete the token in GitHub (the Worker falls back to unauthenticated access within ten minutes and logs only `github_token_rejected`), and `npx wrangler secret delete GITHUB_TOKEN --env=""`. If a token may have leaked, revoke it in GitHub first.

## Monitoring

No telemetry is added (`observability` is disabled, nothing is stored). Use:

- `curl -s https://mcp.orbit.convio.io/health` → `{"ok":true,...}`.
- `node worker/scripts/e2e.mjs https://mcp.orbit.convio.io/mcp` after deploys and weekly. Cloudflare's built-in aggregate analytics (requests, errors) are in the dashboard.
- Live debugging only: `npx wrangler tail --env=""` (streams, stores nothing).

## Rate limits

| Layer | Limit | Behaviour |
| :--- | :--- | :--- |
| Per IP (Cloudflare binding) | 30 requests/60 s | HTTP 429 with `retry-after: 30`; if the limiter errors the Worker fails open |
| Per tool call | 14 GitHub requests, 4 concurrent, 8 s timeout | `budget` / `upstream` tool errors |
| GitHub quota | 60/h unauthenticated, 5,000/h with token | Tool error "rate limit is exhausted; retry in about N minute(s)"; later calls fail fast without calling GitHub |
| Cache | 5 minutes, public data only | Repeats are free |

## Troubleshooting

| Symptom | Check |
| :--- | :--- |
| Tools return "rate limit is exhausted" | Wait for the stated time, or configure the token. Not a defect. |
| `e2e.mjs` exits 2 | Same cause, or no failed CI run found; pass `--run-id`/`--ci-repo`. |
| 403 "Origin not allowed" | Browser client origin is not in `ALLOWED_ORIGINS` (`wrangler.jsonc`). Non-browser clients send no Origin. |
| 429 from `/mcp` | Per-IP limiter; slow down. |
| "Repository not found or not public" | Typo, private repo, or renamed repository (redirects are rejected; use the current name). |
| Everything returns "Could not reach GitHub" | GitHub outage or egress block; check githubstatus.com. |
| Token set but limits unchanged | Token expired/revoked (look for `github_token_rejected` in `wrangler tail`), or the secret was set on the wrong environment. |

## Rollback

```sh
cd worker
npx wrangler deployments list --env=""
npx wrangler rollback <version-id> --env="" --message "rollback"   # previous known-good version
```

Then run `e2e.mjs`. Users need no action. To take the service offline entirely, remove the Custom Domain route in the Cloudflare dashboard (owner action); local skills are unaffected. Released npm and plugin versions are immutable; ship fixes as new versions.
