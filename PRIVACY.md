# Privacy Policy

Last updated: 7 October 2026

## Overview

Orbit Thread is a local-first developer tool for project setup, coding-session continuity and verified handoffs.

The Orbit Thread skills and npm CLI run locally and contact no Orbit Thread service. Orbit Thread does not require an account or collect telemetry or analytics.

The optional **Orbit Next** MCP server (v1.3.0) is a separate, remote, read-only service. It is described in the next section; nothing in it applies to Setup, Handoff or Resume.

## Orbit Next (remote MCP service)

When you or your coding agent calls an Orbit Next tool, the request (tool name plus the `owner`, `repo` and optional `run_id` you supplied) is sent over HTTPS to a Cloudflare Worker. The Worker uses those values to fetch **public** data from GitHub's API and `raw.githubusercontent.com` and returns a summary to your agent.

- **Not sent or readable:** local files, `HANDOFF-STATE.md`, uncommitted changes, private repositories or your credentials. The service has no access to them and accepts no credentials from you. If the operator configured the optional GitHub token, it is the operator's own read-only, public-repositories-only token; it is used to call GitHub, is not logged and is never returned to you.
- **Not stored:** Orbit Next has no database, accounts or user storage and does not log request bodies. Public GitHub responses may be cached in Cloudflare's edge cache for up to five minutes; the cache holds public GitHub data only.
- **Telemetry:** Orbit Next adds no analytics or tracking. Application observability/logging is disabled in the Worker configuration.
- **Processors:** Cloudflare (hosting; handles network metadata such as IP addresses under its own policies, including for rate limiting) and GitHub (receives the requested repository paths from Cloudflare's network; it does not receive your identity). Your coding agent's provider also sees the tool results as part of your conversation.
- **Public repository names are not secrets, but your interest in them may be.** Do not use Orbit Next with repository names you consider confidential.

## Data Orbit Thread processes

Orbit Thread's local skills and CLI do not collect or transmit user or repository content to an Orbit Thread-operated server.

When used in a coding project, Orbit Thread may process information that the user or coding agent makes available locally in order to:

- create or update project documentation and managed agent instructions;
- create and overwrite `HANDOFF-STATE.md`;
- store project configuration and local ownership state;
- record hashes and exact managed instruction blocks for safe updates and uninstall operations.

This information may include project names, source-code context, technical decisions and other information intentionally included in project documentation or handoffs.

Orbit Thread is not designed to collect or process payment-card information, protected health information, government identifiers, passwords, API keys, authentication tokens, MFA/OTP codes, recovery codes or other authentication secrets. Users should not place this information in Orbit Thread handoffs or living project documents.

Secret-pattern checks are a limited safety backstop and are not a data-loss-prevention system.

## Purposes of processing

Orbit Thread processes local project information only as necessary to:

- prepare a project for coding-agent continuity;
- maintain concise project and execution state;
- safely install, update and uninstall Orbit Thread-managed files;
- verify ownership of managed content and avoid overwriting unrelated or locally modified files.

Orbit Thread does not use project information for advertising, behavioural profiling, analytics, model training or sale to third parties.

## Sharing and recipients

Orbit Thread's skills and CLI do not transmit repository content, handoffs or local project documentation to the developer of Orbit Thread or to an Orbit Thread-operated service. The optional Orbit Next service receives only the public `owner/repo` (and optional run ID) you ask it to inspect.

Installation or distribution may involve third-party services such as npm, GitHub, OpenAI or Anthropic. Those services process information according to their own privacy policies and service settings.

When Orbit Thread is used through a coding agent, information intentionally provided to that agent may be processed by the agent provider under that provider's privacy settings and terms. Orbit Thread's local scripts do not independently transmit repository content to those providers.

## Data retention

Orbit Thread does not retain user or project data on developer-operated servers. The optional Orbit Next Worker is stateless and keeps nothing between requests apart from the short-lived public-data cache described above.

Local data remains on the user's device or project until the user removes it or the relevant file is overwritten.

`HANDOFF-STATE.md` is overwrite-only and is replaced when a new successful checkpoint is created.

Project documentation and `.orbit-thread` configuration may remain after Orbit Thread is uninstalled so that project-owned information is not destroyed automatically. Users may delete these files at any time.

Retention by npm, GitHub, OpenAI, Anthropic or other third-party services is governed by those services' own policies.

## User controls

Users control the project information made available to Orbit Thread.

Users may inspect, edit or delete Orbit Thread-created local files at any time, including `HANDOFF-STATE.md`, project documentation and `.orbit-thread` configuration.

Orbit Thread can also be uninstalled using its CLI. Uninstall intentionally preserves project-owned documentation and configuration unless the user chooses to delete them separately.

Orbit Thread setup Git-ignores `HANDOFF-STATE.md` and local ownership state. Adding an already tracked file to `.gitignore` does not remove it from Git history or stop Git from tracking it.

## Security and sensitive information

Do not place passwords, authentication secrets, private keys, recovery codes, personal data or sensitive production information in handoffs or living project documents.

Orbit Thread includes limited pattern checks intended to reduce accidental inclusion of obvious secrets, but these checks do not guarantee detection of sensitive data.

## Changes to this policy

This policy may be updated when Orbit Thread's functionality or data practices change. Material changes will be reflected in this document and its Git history.

## Contact

Privacy or security questions can be raised through the Orbit Thread GitHub repository:

https://github.com/shab1h-gh/orbit-thread/issues
