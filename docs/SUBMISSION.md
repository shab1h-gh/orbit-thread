# Directory submission

Updated 13 October 2026. v1.3.0 (Orbit Thread plus the Orbit Next remote MCP) is released on npm, GitHub (tag `v1.3.0`) and at `https://mcp.orbit.convio.io/mcp`. **Nothing in v1.3.0 has been submitted to OpenAI or Anthropic.** Provider dashboards are authoritative; this file records requirements and prepared material, not live review state. Requirements below were checked against the official OpenAI ([submission](https://developers.openai.com/plugins/deploy/submission)) and Anthropic ([plugins](https://claude.com/docs/plugins/submit), [connectors](https://claude.com/docs/connectors/building/submission), [publishing](https://claude.com/docs/directory/publish)) pages on 13 October 2026. Re-check them before submitting.

Historical identifiers (preserve; not stored in this repo, owner to keep them in the private tracker): OpenAI support case **17008860**; earlier OpenAI submission IDs for v1.2.x; any Anthropic Console/portal submission reference.

## OpenAI / ChatGPT Plugins Directory: With MCP route

Artifact: `dist/orbit-thread-plugin-1.3.0.zip` (SHA-256 `20a611de03e83890b2f86ed08f534c2a945e0cc958c31e74e91f274473a6619a`, matches `dist/SHA256SUMS-1.3.0`). Rebuild with `npm run build:plugin` only from the release tag.

**Blocking constraint:** OpenAI states you cannot add an MCP server to an existing skills-only plugin; With MCP must be in the initial ZIP. If the v1.2.x skills-only listing is submitted or published under the name `orbit-thread`, the owner must ask OpenAI (reply on case 17008860) whether v1.3.0 can replace it or must be a new plugin. Do not rename the plugin or change the ZIP without a decision (a rename changes release artefacts and needs a new version).

Package checks against the current rules (all pass unless noted):

| Item | Status |
| :--- | :--- |
| `name` lowercase/hyphen, `version` 1.3.0, `description` ≤4000, `author.name`, `$schema` | Pass |
| `displayName` ≤30, `shortDescription` ≤30 (22), `longDescription` ≤4000, `developerName`, `category` | Pass |
| `logo` and `composerIcon`: `./assets/icon.png`, 512×512 square PNG, 3 KB | Pass |
| `defaultPrompt` ≤3, each ≤128 chars | Pass |
| Website, support, privacy, terms URLs: HTTPS, public (HTTP 200), same publisher | Pass |
| No hooks, no `apps`/`.app.json`, no secrets in ZIP | Pass |
| `mcp.json` (Agent Plugins 1.0) remote `streamable-http`, no auth, no headers | Pass |
| `publication.release_notes` | Pass (text in [REVIEW.md](REVIEW.md)) |
| `brandColor` `#4338CA` contrast | Not checked by the portal here; the portal validates it |
| `.claude-plugin/plugin.json` and `.mcp.json` present for Claude Code; OpenAI reads `plugin.json`/`mcp.json` | Pass; confirm which manifest the portal reads |

**Portal-side items (not in the ZIP):** the five positive and three negative review cases, demo recording URL, reviewer information, commerce declaration (`false`: no commerce) and policy attestations are entered in the portal's review step. OpenAI's page also says cases can be declared in the MCP configuration; adding them to `mcp.json` would alter release artefacts, so prefer portal entry. Ready-to-paste text: [REVIEW.md](REVIEW.md).

**Account:** the submitter must be an organization owner or hold Apps Management Write, with individual or business verification completed. Third-party guides report that organizations with EU data residency cannot submit MCP plugins; check the project's residency in the dashboard.

**Authentication:** none (public read-only). Select "none" in the portal; no reviewer credentials are needed, so state that in reviewer information.

### Domain verification (manual, not done)

OpenAI issues a token in the portal. It must be served as plain text (the token only, no JSON) at `https://<host>/.well-known/openai-apps-challenge` on `mcp.orbit.convio.io` or an eligible parent origin. Currently that path returns 404, as expected before a token exists. After approval, the Worker needs a small route returning the token (a Worker secret/var, not committed). Per AGENTS.md rules and the task brief, no verification endpoint is deployed without explicit approval.

### Submission flow (owner)

1. Resolve the replace-vs-new-plugin question above.
2. Open the OpenAI Plugins dashboard, upload the ZIP, confirm validation and skill scans pass.
3. Connect `https://mcp.orbit.convio.io/mcp`; obtain the token; approve deployment of the challenge route; verify; wait for the tool scan.
4. Enter test cases, demo URL, release notes and reviewer information; complete attestations; **Submit for review**.
5. Track Review status; after approval choose **Publish plugin**. Only one review can be active per plugin. Metadata or skill changes later need a new ZIP; MCP tool changes are rescanned daily; changing the MCP URL needs support.

## Anthropic / Claude public directory

Anthropic's portal is `https://claude.ai/directory/manage`. It has two submission kinds, and Anthropic says to submit a remote MCP server as an **MCP connector** even when a plugin references it:

| Submission | Source | Notes |
| :--- | :--- | :--- |
| Plugin bundle | GitHub `shab1h-gh/orbit-thread`, plugin path `plugin`, tracked branch/tag (suggest tag `v1.3.0`) | One submission per repo+folder per organization; the directory scans each new commit. Later versions arrive by push/tag, not a new submission. |
| MCP connector | URL `https://mcp.orbit.convio.io/mcp` | Public data, so "no authentication"; every tool needs a `title` plus `readOnlyHint`/`destructiveHint`; needs documentation URL, privacy URL, support contact, icon, listing text, data-handling answers and test and access instructions. Pair with the plugin from the same organization. |

**Avoiding a duplicate:** the portal refuses a second submission for the same repo+folder. First check **Submissions** in the portal, and Console **Plugin submissions** (`platform.claude.com/plugins/submissions`) for the earlier submission. If one exists and is pending, do not create another: open it, and let the tracked branch/tag deliver v1.3.0 (change the tracked tag to `v1.3.0` in Settings if it follows a tag). A Console submission with no Withdraw button is moved by emailing `directory@anthropic.com`; one with Withdraw must be withdrawn and resubmitted. Do not withdraw a pending review without the owner's decision.

**Local pre-checks:**

```sh
claude plugin validate ./plugin --strict
claude plugin validate . --strict
```

Also confirm no tool name exceeds 64 characters (they do not) and that the listing text, README and `plugin.json` agree. A GitHub marketplace install does not imply directory approval.

## Submission checklist (13 October 2026)

**Ready**
- v1.3.0 release, tag, npm latest and production MCP (e2e 23/23 on 13 Oct); tests 64, validate, public scan pass.
- ZIP contents and checksum; icon; manifest limits; four policy URLs return 200.
- Review cases, data declarations, release notes, demo script ([REVIEW.md](REVIEW.md)).
- Codex CLI verified against production for all three tools.

**Blockers**
- OpenAI: cannot add MCP to an existing skills-only plugin; replace-vs-new decision needed (case 17008860).
- OpenAI: domain-verification token and challenge endpoint (needs approval to deploy).
- Anthropic: unknown whether a pending submission exists; check portal and Console before acting.
- Anthropic: connector submission needs the portal step "Test & launch" confirmation (you must run each tool yourself; e2e already does) and a support contact decision.

**Owner actions**
1. Reply on case 17008860 asking about the combined With MCP route.
2. Decide OpenAI plugin identity (replace vs new) and EU-residency check.
3. Record the demo video from the script and host it at an accessible URL.
4. Approve the challenge-route deploy once OpenAI issues the token.
5. Inspect Anthropic portal/Console, then submit connector and plugin bundle (or update the pending one).
6. Optional: redeploy production for the rate-limit wording fix; review stray npm `0.0.0-stage`; Codex ZIP install test.
7. Only advertise public availability after each dashboard shows published.

Related: [REVIEW.md](REVIEW.md), [OPERATIONS.md](OPERATIONS.md), [PUBLISHING.md](PUBLISHING.md).
