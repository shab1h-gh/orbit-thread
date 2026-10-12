# Release validation record

Checks performed on 5 October 2026, using disposable Git repositories.

## Original v1.0.0 checks

### Automated tests

All 26 tests passed locally on macOS with Node.js 24. Tests cover first creation,
overwrite, exactly 50 lines, 51-line rejection, final lines with and without a
newline, empty and synthetic secret/private-key rejection, preservation of the
old file, paths with spaces, cleanup after validation and rename failures, and
unchanged Git index/refs with network-command guards.

CLI tests cover Codex, Claude and both-agent project installs, identical copies,
reinstall, check, update across package versions, uninstall, user-scope locations
in a disposable home, init idempotency and block upgrades, ignore rules, existing
instructions, edited files/blocks, unrelated files/directories, symlinks and
invalid ownership paths. No live user installation is altered by these tests.

CI ran the suite, local package validation, source scan, ZIP build and npm pack
on macOS/Linux with Node.js 20 and 24. All four jobs passed in the
[initial public CI run](https://github.com/shab1h-gh/orbit-handoff/actions/runs/37254076291).

### Native discovery and packaging

- Codex CLI 0.160.0 returned the installed `handoff` from its native `skills/list`
  API, with display name Orbit Handoff and a `$handoff` default prompt.
- Claude Code 2.1.289 passed `claude plugin validate ./plugin --strict` and
  `claude plugin validate . --strict`.
- A local marketplace install succeeded. `claude plugin details orbit-handoff`
  reported one `handoff` skill, zero agents/hooks/MCP/LSP servers.
- A second isolated configuration installed `orbit-handoff@orbit-handoff` from
  `shab1h-gh/orbit-handoff` on GitHub and reported version 1.0.0 enabled.
- Claude startup's `slash_commands` and `skills` arrays contained
  `orbit-handoff:handoff`; its plugin metadata reported version 1.0.0.
- A standalone Claude project install registered and loaded `handoff`, confirming
  the `/handoff` command independently of the plugin namespace.
- The attempted Claude model run ended with **Not logged in**. Registration and
  installation are verified; an authenticated agent-driven handoff is untested.
- The portable manifest passed the official Agent Plugins 1.0.0 JSON Schema
  using Ajv's draft-2020 validator. Local checks cover OpenAI listing limits,
  real PNG assets, skill metadata and the absence of MCP/hooks.
- `npm pack` was inspected and the packed CLI installed both agents through
  `npx --package` in a clean disposable project.
- The interactive installer was exercised in a terminal: agent selection,
  project scope selection, destination preview and confirmation all completed.
- Public-source scans passed. Archives are inspected separately for unwanted
  paths, credentials, test output and build residue before release.

## Publication limits

`orbit-handoff@1.0.0` was successfully published manually. Public registry
verification on 5 October 2026 confirmed version 1.0.0, `latest` resolving to
1.0.0 before the patch release, and repository/homepage/issue metadata pointing
to `shab1h-gh/orbit-handoff`. The previous failed publication attempt is stale
history; the registry package is available.

Neither OpenAI nor Anthropic public directory submission has been made.
Provider review, identity verification and portal checks remain publisher steps.
Native Windows, WSL-specific operation and ordinary ChatGPT execution are
unverified; the supported runtime is macOS/Linux with a POSIX shell.

## v1.0.1 patch verification

The patch changes documentation and release version metadata only. No installer,
canonical skill, writer, tests or packaging logic changed.

### Public v1.0.0 smoke test

Downloaded the actual public package with an isolated npm cache and ran
`npx orbit-handoff@1.0.0 install --agent both --scope project --yes` in a disposable
Git repository on macOS with Node.js 24.16.0 and npm 12.0.2. Verified:

- Codex and Claude installs contain byte-identical skill files and ownership metadata.
- The npm CLI has executable permissions. Installed writers are mode 0644 and
  execute through `sh`, matching the canonical skill's invocation contract.
- `check` succeeds after install; `init` preserves existing AGENTS.md, CLAUDE.md
  and .gitignore content, records ownership and ignores HANDOFF-STATE.md.
- Reinstall and repeated init preserve bytes and add no duplicate blocks.
- Init creates no handoff. The writer creates and atomically replaces the file
  with restrictive permissions; empty and 51-line inputs preserve the valid file.
- No writer temporary files remain. Uninstall restores original configuration,
  removes unchanged owned skills, and preserves unrelated files and the handoff.
- Edited skills and continuity blocks survive uninstall; check and reinstall
  report edited files with failure status rather than overwriting them.

This smoke test exercises the CLI and shell workflow. It does not claim a new
native agent discovery test or an authenticated agent-driven handoff.

### Local checks and packed v1.0.1 smoke test

- All 26 existing tests passed on macOS with Node.js 24.16.0.
- `npm run validate`, `npm run scan:public` and `npm run build:plugin` passed.
- Claude Code 2.1.289 passed both `claude plugin validate ./plugin --strict` and
  `claude plugin validate . --strict` for the updated manifests.
- The portable manifest passed the official Agent Plugins 1.0.0 JSON Schema
  with Ajv's draft-2020 validator and format checks.
- `npm pack --dry-run` and `npm pack` succeeded using a disposable cache.
  The tarball contains 20 intended files, an executable CLI, version 1.0.1 and
  the corrected README. No dependencies, credentials or build residue are included.
- The submission ZIP passed its integrity check and both extracted archives
  passed the public/privacy scanner. No private paths or unwanted files were found.
- The packed 1.0.1 CLI passed the same disposable-repository install, check,
  init, reinstall, handoff and uninstall smoke test described above, including
  edited-content preservation and executable permissions.
- Complete diff review confirmed that runtime code and canonical skill bytes
  are unchanged. The v1.0.0 tag and release remain untouched.

These are pre-publication checks. After publication, verify `latest` resolves to
1.0.1 and repeat the public-registry smoke test; report its result in the GitHub
release. The original CI result above covers v1.0.0; it is not a new 1.0.1 CI claim.


## v1.1.0 feature validation

Validation completed on 7 October 2026 for the Orbit Thread feature release.

### Verified in GitHub CI

The final feature-branch workflow passed on macOS and Linux with Node.js 20 and 24.

The workflow verified:

- the complete Node test suite;
- package/manifest validation;
- public/privacy source scanning;
- deterministic OpenAI/plugin ZIP generation;
- `npm pack`;
- a packed-tarball smoke test in a disposable Git repository.

The packed smoke test exercised the actual `orbit-thread-1.1.0.tgz` through:

- install for Codex and Claude;
- setup;
- Claude and Codex subagent configuration;
- doctor;
- update;
- uninstall;
- preservation of living project docs/config after uninstall.

It also verified both canonical skills, the expected living-document templates, `.orbit-thread/config.json`, and that setup does not create `HANDOFF-STATE.md`.

### Behaviour verified by tests

Coverage includes:

- Orbit Setup creation/idempotency and preservation of existing project docs/instructions;
- selective project state and Git-ignore management;
- Orbit Handoff → Orbit Thread project-state migration;
- managed skill ownership/update/uninstall safeguards;
- subagent model/reasoning configuration and AGENTS.md reflection;
- doctor detection of duplicate root/docs living documents;
- Handoff atomic overwrite, 50-line limit, secret-pattern rejection, failure preservation and no Git/network mutation.

### Invocation policy

The canonical Handoff skill intentionally omits Claude's former
`disable-model-invocation: true` restriction and keeps OpenAI metadata
`allow_implicit_invocation: true`.

Configured Orbit Thread projects therefore permit proactive checkpoints after meaningful verified milestones and completed coding tasks, while manual `$handoff` / `/handoff` invocation remains supported.

Orbit Setup remains separately exposed as `$orbit-setup` / `/orbit-setup`.

### Remaining release-gate checks

Before publishing/tagging v1.1.0:

- validate the final plugin with a current Claude Code installation using `claude plugin validate`;
- verify native Claude and Codex skill discovery against the final package where those CLIs are available;
- publish `orbit-thread@1.1.0` and repeat the public-registry smoke test.

Those native CLIs are not part of GitHub CI, so CI success does not claim those checks.

### Provider directories

OpenAI and Anthropic public-directory review is separate from npm/GitHub distribution. Their publisher dashboards are authoritative after submission; local validation does not imply approval.

## Orbit Resume feature validation

Validation completed on 11 October 2026 on the `feature/orbit-resume` branch.

- All 43 automated tests passed, including Codex and Claude project installation,
  reinstall, update, Doctor, missing/invalid/stale handoffs, branch changes,
  future dates, terminal-control sanitisation, secret redaction, and preservation
  of dirty working trees.
- `npm run validate`, `npm run scan:public`, `npm run build:plugin`, and
  `git diff --check` passed.
- Claude Code `claude plugin validate ./plugin --strict` passed.
- `npm pack` produced the expected 28-file v1.1.0 tarball, and
  `npm run smoke:pack` passed against the packed CLI in a disposable project,
  including `resume`, installation, setup, configure, Doctor, update, and
  uninstall checks.
- A security review identified a low-risk terminal-control injection through
  branch metadata in a local handoff. Resume now strips terminal control
  sequences from displayed repository and handoff text; the regression test
  confirms those sequences do not reach terminal output.

These are local pre-publication checks. The feature branch has not been merged
or published to npm. Native skill discovery inside an authenticated Codex or
Claude conversation was not exercised; manual `$orbit-resume`, `/orbit-resume`,
and `/orbit-thread:orbit-resume` invocations remain the documented fallback.

