# Contributing

Thanks for helping improve Orbit Thread. Open an issue for a bug/focused proposal, or send a pull request with a clear explanation and relevant tests. Use synthetic repositories and credentials in reproductions.

Requirements: Node.js 20+, Python 3 for packaging, Git and a POSIX shell. The project has no npm runtime dependencies.

```sh
npm test
npm run validate
npm run scan:public
npm run build:plugin
npm pack
npm run smoke:pack
```

Keep canonical skills under:

```text
plugin/skills/handoff/
plugin/skills/orbit-setup/
```

Do not create divergent Codex and Claude implementations.

Handoff changes must preserve the 50-line cap, overwrite-only current state, validation before atomic replacement, secret backstop, failed-write preservation, no temporary residue, no network calls and no Git mutation.

Setup/configuration changes must preserve existing project docs and unrelated instructions, avoid duplicate root/docs files, stay idempotent, keep living docs as current truth rather than changelogs, and keep user-configured subagent preferences inside the managed Orbit Thread block.

Installer/update tests must cover migration from compatible Orbit Handoff installations, edited-file preservation and user-owned content.

Packaging changes should also be validated with current Claude Code:

```sh
claude plugin validate ./plugin --strict
claude plugin validate . --strict
```

Public-directory validation is separate from provider approval.

Use British English in documentation.

Orbit Next (`worker/`) changes must stay read-only and deterministic: GET-only requests to the fixed GitHub hosts, validated inputs, sanitised output, no credentials, storage or AI calls. Run `npm --prefix worker ci --ignore-scripts`, `npm run typecheck:worker` and `npm run test:worker` alongside the root checks.
