# Terms of Service

**Effective date:** 12 October 2026  
**Project:** Orbit Thread  
**Maintainer:** Shabih Anwar

## 1. About Orbit Thread

Orbit Thread is a free, open-source, local-first developer tool for preparing project documentation, recording verified coding checkpoints, and recovering useful context in new Codex or Claude Code sessions. It is distributed through its [GitHub repository](https://github.com/shab1h-gh/orbit-thread), npm and supported plugin marketplaces.

Orbit Thread does not provide a hosted account, cloud storage, remote memory service, or service-level availability commitment. Use of the software is subject to the open-source licence described below.

## 2. Open-source licence

Orbit Thread's source code is distributed under the [MIT Licence](LICENSE). The MIT Licence governs your rights to use, copy, modify and distribute the software, including its warranty and liability provisions. These terms describe the project and its operation; they do **not** replace or restrict rights granted by the MIT Licence.

## 3. Your projects and responsibilities

You remain responsible for your own repositories, code, files, project decisions, and use of coding agents. In particular:

- Review proposed code, file changes and generated documentation before relying on them.
- Verify important tests, security decisions, deployments and other actions independently.
- Keep suitable backups and follow your organisation's policies when using Orbit Thread with shared or confidential projects.
- Do not put passwords, API keys, recovery codes, personal data or other sensitive information into handoffs or living project documents.

Orbit Thread includes safeguards for common secret patterns and accidental overwrites, but no automated check can guarantee that all sensitive material or mistakes will be detected.

## 4. Local processing and third-party services

Orbit Thread's local scripts operate on files in your project. Orbit Thread does not operate a data-collection service or collect telemetry. The optional Orbit Next MCP server is a stateless, read-only service that fetches public GitHub data for repositories you name; it is provided as-is, may be rate-limited or unavailable, and is described in the [Privacy Policy](PRIVACY.md). The local handoff file is designed to be ignored by Git, but you are responsible for checking what your repository or coding agent actually shares.

Installing Orbit Thread, using Git hosting, or invoking Codex, Claude Code and plugin marketplaces may involve **npm, GitHub, OpenAI, Anthropic or other providers**. Their separate terms, permissions, billing arrangements and privacy practices apply to those services. Orbit Thread does not control how third-party coding agents process information you choose to provide.

For details, see the [Privacy Policy](PRIVACY.md) and [Security Policy](SECURITY.md).

## 5. Software availability and limitations

Orbit Thread is provided **"as is"**, without warranties, as described in the MIT Licence. There is no guarantee of uninterrupted availability, compatibility with every environment, particular token savings, perfect recovery of previous context, or detection of every error.

A handoff is a compact checkpoint, not a complete conversation archive or a substitute for the current repository state. Resume may report missing or outdated information; it cannot verify work that was never recorded.

## 6. Updates to these terms

These terms may be revised when the project or its distribution changes. The effective date above will be updated for material revisions, and prior versions remain available in the public Git history.

## 7. Support and contact

For general questions and support, use [GitHub Issues](https://github.com/shab1h-gh/orbit-thread/issues). For security vulnerabilities, use [private GitHub security reporting](https://github.com/shab1h-gh/orbit-thread/security/advisories/new) rather than posting sensitive information publicly.
