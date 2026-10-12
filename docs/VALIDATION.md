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

## Orbit Resume v1.2.0 validation

Release validation completed on 12 October 2026 on the `feature/orbit-resume` branch (PR #3) for v1.2.0. `orbit-thread@1.1.0` was confirmed published on the public npm registry before the version bump; v1.2.0 has not been tagged, published or merged.

### Verified locally for the v1.2.0 release candidate

- All 43 automated tests passed, including Codex and Claude project installation,
  reinstall, update, Doctor, missing/invalid/stale handoffs, branch changes,
  future dates, terminal-control sanitisation, secret redaction, and preservation
  of dirty working trees.
- `npm run validate`, `npm run scan:public`, `npm run build:plugin` and
  `git diff --check` passed.
- `claude plugin validate ./plugin --strict` and `claude plugin validate . --strict` passed.
- `npm pack` produced `orbit-thread-1.2.0.tgz` (28 files, including `lib/resume.mjs` and
  `plugin/skills/orbit-resume/`), and `npm run smoke:pack` passed against it in a disposable
  Git project: `resume`, install, setup, configure, Doctor, update and uninstall.
- `dist/orbit-thread-plugin-1.2.0.zip` contains 16 files: portable and Claude manifests,
  all three skills, icon, licence, privacy and security documents. Both archives report
  version 1.2.0 throughout, with no private paths or build residue.
- Release metadata (`package.json`, `plugin/plugin.json`, `plugin/.claude-plugin/plugin.json`
  and `.claude-plugin/marketplace.json`) is consistent at 1.2.0; `npm run validate` enforces this.

### Compatibility with v1.1.0 installations

Using the published `orbit-thread@1.1.0` from the npm registry, a disposable project was installed
and set up with `handoff` and `orbit-setup` only, then updated with the packed 1.2.0 CLI.
Update added `orbit-resume` for Codex and Claude, kept the existing `handoff` and `orbit-setup`
skills, `.orbit-thread/config.json`, local edits to living docs and user content in `AGENTS.md`, and
Doctor reported all three skills current at v1.2.0. A locally edited managed skill file was still
refused with an instruction to preserve changes. The 1.2.0 `resume` command ran read-only,
and uninstall preserved project docs and configuration.

### Reported native agent testing (not CI)

The maintainer reported successful authenticated native testing of the feature-branch skills in fresh
Codex and Claude Code sessions, using a disposable Git project: Setup, Doctor, handoff
validation and Resume recovery scenarios passed, and both automatic and explicit manual Resume
invocation worked in each agent. This was an interactive local test recorded from the
maintainer's report; it is not part of GitHub CI and was not re-run during release preparation.
Codex emitted macOS temporary-cache warnings during Git reads but still reported branch,
status and commit.

### Verified in GitHub CI

GitHub CI covers the macOS and Linux Node.js matrix, the test suite, package validation, the
public-source scan, plugin ZIP generation, `npm pack` and the packed-tarball smoke test. CI does not run
authenticated Codex or Claude sessions or `claude plugin validate`. The PR #3 CI run on the
previous commit passed; CI for the release commit is checked on the pull request after push.

### Security review

A security review identified a low-risk terminal-control injection through branch metadata in a
local handoff. Resume strips terminal control sequences from displayed repository and handoff text; a
regression test confirms they do not reach terminal output.

### Remaining release-gate checks

- Merge PR #3, then tag v1.2.0 from the merged release commit.
- Publish `orbit-thread@1.2.0` and repeat the public-registry smoke test described in
  [PUBLISHING.md](PUBLISHING.md).

## Orbit Resume v1.2.1 validation

Compatibility patch (`fix/resume-completed-heading`): Resume now accepts `## Completed this session` as an alias of the canonical `## Completed milestones`. The canonical section takes precedence when both exist; the handoff format is unchanged. The v1.2.0 section above is a historical record and is unchanged.

### Verified locally

Results are recorded in the release PR and final report; the checks run were `npm test` (including regression tests for both headings, precedence, missing sections and redaction under the legacy heading), `npm run validate`, `npm run scan:public`, `npm run build:plugin`, `npm pack`, `npm run smoke:pack`, `claude plugin validate ./plugin --strict`, `claude plugin validate . --strict` and `git diff --check`.

### Compatibility with v1.2.0 installations

A project installed with the published `orbit-thread@1.2.0` is updated in place by the 1.2.1 CLI; installed skills, `.orbit-thread/config.json`, living docs and existing handoffs are preserved.

## Orbit Thread v1.2.2 validation

Documentation and metadata release (`release/v1.2.2`) resolving OpenAI plugin submission findings. The v1.2.1 section above is a historical record and is unchanged.

### Changes under validation

- `TERMS.md` is the public Terms of Service, linked from `README.md` and declared as `termsOfServiceURL` in `plugin/plugin.json`.
- `defaultPrompt` now holds three conversation starters, each at most 128 characters.
- The stale `publication.release_notes` text (which described v1.1) now describes v1.2.2.
- `TERMS.md` is included in the npm tarball (29 files) and the plugin ZIP (17 files).
- `npm run validate` additionally enforces the Terms URL, the prompt count and the 128-character limit.
- No change to Setup, Handoff or Resume code, skill files, installer logic or the handoff format. No MCP server is added.

### Verified locally

Results are recorded in the release PR and final report. Checks run: `npm test`, `npm run validate`, `npm run scan:public`, `npm run build:plugin`, `npm pack`, `npm run smoke:pack`, `claude plugin validate ./plugin --strict`, `claude plugin validate . --strict` and `git diff --check`.

### Compatibility

Existing v1.2.x installations keep working; `orbit-thread update` refreshes managed skills to 1.2.2 without touching locally edited files. Authenticated native Codex and Claude sessions were not re-run for this metadata-only release.

## v1.3.0: Orbit Next (feature branch `feat/orbit-next-mcp`)

Run on 12 October 2026, macOS, Node.js 24.16.0. v1.2.2 files are unchanged apart from version metadata.

| Check | Result |
| :--- | :--- |
| `npm test` (CLI/skills + Orbit Next wiring) | 57 pass: the 52 existing tests plus 5 new, 0 fail |
| `npm run test:worker` (vitest, mocked GitHub) | 90 pass: validation, sanitisation, GitHub client, analysers, MCP via the official SDK client, HTTP hardening |
| `npm run typecheck:worker` | clean (`tsc --noEmit`, strict) |
| `npm audit` in `worker/` | 0 vulnerabilities |
| `npm run validate` / `scan:public` | pass (69 files); ZIP contents scanned separately (18 files) |
| `npm run build:plugin`, `npm pack`, `npm run smoke:pack` | pass; ZIP and tarball include `.mcp.json`; tarball (33 files) excludes `worker/`; smoke test covers install, setup, configure, doctor, resume, update and uninstall |
| `claude plugin validate ./plugin --strict` and `. --strict` | pass |
| Staging deploy `orbit-thread-mcp-staging` + `worker/scripts/e2e.mjs` | pass: initialize, `tools/list` (3 read-only tools), all three tools on a real repository, rejection of invalid owner/repo/run_id and a missing repository, 403 for a foreign Origin, 405 for GET |
| Real-data spot checks | `assess_release_readiness` correctly reported `v1.2.2` as already tagged; `diagnose_ci_failure` on a failed public Actions run returned the failed job/step and annotations without a root-cause claim |

Findings during validation: (1) `redirect: 'error'` is not usable in the Workers runtime and made every GitHub call fail on the deployed Worker while mocked tests passed; fixed with `redirect: 'manual'` plus an explicit redirect error and a test. (2) GitHub's unauthenticated limit was exhausted from the shared Cloudflare egress during testing; the tools returned a clear rate-limit error with a retry hint, as designed.

Production (2026-10-12): `orbit-thread-mcp` deployed to `https://mcp.orbit.convio.io/mcp`. DNS, TLS, `/health`, `initialize`, `tools/list`, input rejection, 403 foreign Origin and 405 GET passed. The three `tools/call` requests reached the Worker but returned the designed rate-limit error because GitHub's unauthenticated limit was exhausted for the shared egress IP, so a successful production tool result is not yet verified.

Not verified: Codex native MCP loading of `plugin/.mcp.json` (no Codex CLI available), and authenticated GitHub behaviour (out of scope).

### PR #7 repair (portable MCP packaging, Node 20 test glob)

| Check | Result |
| --- | --- |
| `npm test` (59), `npm run validate`, `npm run scan:public` | pass; new tests cover the unquoted test glob and portable `mcp.json` / `plugin.json` rules |
| Worker typecheck and tests (90) | pass |
| `build:plugin`, `npm pack`, `smoke:pack` | pass; ZIP contains `plugin.json` (no `mcpServers`), `mcp.json`, `.mcp.json`, `.claude-plugin/plugin.json` |
| `claude plugin validate --strict` (plugin and marketplace) | pass |
| MCP connectivity | local `wrangler dev --env staging`: Streamable HTTP `initialize` and `tools/list` returned the three tools |
| Node 20 | not run locally (`npx node@20` resolved to Node 24); covered by the CI matrix and a static regression test |

Not verified: the production endpoint (undecided), Codex native loading of `mcp.json`.
