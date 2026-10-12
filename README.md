<h1 align="center">🧵 Orbit Thread</h1>
<p align="center"><strong>Pick up where you left off. Not where the chat ended.</strong></p>
<p align="center">Lightweight project context, verified handoffs and fresh-session recovery for <strong>Codex</strong> and <strong>Claude Code</strong>.</p>
<p align="center">
  <a href="https://www.npmjs.com/package/orbit-thread"><img alt="npm version" src="https://img.shields.io/npm/v/orbit-thread?label=npm"></a>
  <a href="https://github.com/shab1h-gh/orbit-thread/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/shab1h-gh/orbit-thread/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT licence" src="https://img.shields.io/badge/licence-MIT-blue.svg"></a>
</p>
<p align="center"><a href="#quick-start"><strong>Quick start</strong></a> · <a href="#orbit-next-remote-github-intelligence">Orbit Next</a> · <a href="#how-it-works">How it works</a> · <a href="#orbit-resume-starting-a-fresh-session">Orbit Resume</a> · <a href="#command-reference">Commands</a> · <a href="#troubleshooting">Troubleshooting</a></p>

---

Orbit Thread prepares small living docs, captures meaningful progress and helps your next coding session recover only the context it needs. **Your repository and Git remain the source of truth.** There is no hosted memory account or giant session diary.

### Three skills, one workflow

| Skill | What it does | When to use it |
| :--- | :--- | :--- |
| 🧭 **[Orbit Setup](#what-setup-creates)** | Prepares project docs, agent instructions and subagent preferences without replacing existing knowledge. | Starting or onboarding a project. |
| 💾 **[Handoff](#when-to-save-a-handoff)** | Writes a concise, verified checkpoint to `HANDOFF-STATE.md`. | After meaningful milestones or before a fresh chat. |
| ▶️ **[Orbit Resume](#orbit-resume-starting-a-fresh-session)** | Recovers progress, open tasks and the next action from the handoff and read-only repository evidence. | Once at the start of a new coding conversation. |

## Orbit Next: remote GitHub intelligence

**Orbit Next** (new in v1.3.0) is an optional, read-only [MCP](https://modelcontextprotocol.io) server that looks at a **public GitHub repository** and tells your coding agent what is blocking progress. It never writes anything, never needs your code, and never uses an AI model: every result comes from deterministic rules over GitHub's public metadata.

| Tool | Answers | Inputs |
| :--- | :--- | :--- |
| `get_project_next_actions` | What should happen next? Prioritised actions from recent commits, open PRs and issues, CI on the default branch and `ROADMAP.md`, each with severity, rationale, source URLs and a **verified / heuristic** label. Gaps are listed as **unknowns**. | `owner`, `repo` |
| `diagnose_ci_failure` | Why is CI red? Failed jobs and steps, bounded and sanitised check annotations, and heuristic areas to investigate. It **never claims a root cause**. | `owner`, `repo`, optional `run_id` (default: latest failed run on the default branch) |
| `assess_release_readiness` | Is it technically ready to release? `PASS` / `WARN` / `BLOCKED` / `UNKNOWN` for repository state, CI, open PRs, version consistency across manifests, changelog entry and existing tags. | `owner`, `repo` |

> [!IMPORTANT]
> **Local Resume and remote Orbit Next are different things.** Resume reads your local `HANDOFF-STATE.md` and Git state and sends nothing anywhere. Orbit Next runs on a Cloudflare Worker and only fetches public GitHub data about the `owner/repo` you name. It cannot see local files, uncommitted changes, private repositories or `HANDOFF-STATE.md`. Release readiness is **technical** evidence only: human approval and publication are always reported as not determined or not performed.

### Example (illustrative output, abridged)

```text
You:    Is shab1h-gh/orbit-thread ready to release?
Agent:  (calls assess_release_readiness {"owner":"shab1h-gh","repo":"orbit-thread"})
        → technicalReadiness: WARN
          ci PASS · open_prs PASS · version_consistency PASS (1.2.2) · changelog PASS
          tags WARN (v1.2.2 already exists: bump the version for a new release)
          humanApproval UNKNOWN · publication NOT_PERFORMED
```

```text
You:    Why did CI fail on my repo?
Agent:  (calls diagnose_ci_failure {"owner":"you","repo":"app"})
        → failed job "test (ubuntu)", step "Run npm test", annotation src/a.test.ts:9
          investigate (heuristic): "Test step failed: inspect the failing test output…"
          rootCause: not determined · logs need authentication and are not read
```

### Connect

The plugin ships an MCP configuration (`plugin/.mcp.json`, server name `orbit-next`) that reads the endpoint from the `ORBIT_NEXT_URL` environment variable. **No public endpoint has been published yet** (see [Status](#status-and-costs)); until then run your own (below) and point at it:

```bash
export ORBIT_NEXT_URL="https://<your-worker-host>/mcp"
# Claude Code, without the plugin:
claude mcp add --transport http orbit-next "$ORBIT_NEXT_URL"
```

For Codex or any other Streamable HTTP MCP client, add a server of type HTTP with the same URL. The Orbit Thread skills (Setup, Handoff, Resume) work with or without Orbit Next.

### Run your own endpoint

The Worker lives in [`worker/`](worker) with its own `package.json`, so the npm CLI keeps zero dependencies.

```bash
cd worker
npm ci --ignore-scripts
npm test                       # 90 mocked-GitHub tests, real MCP client included
npx wrangler deploy --env staging   # needs your own Cloudflare login
node scripts/e2e.mjs https://<your-worker-host>/mcp   # end-to-end check
```

### Status and costs

- **Costs:** none for users. The Worker uses no paid AI APIs, database or storage; it runs on Cloudflare's free tier for modest traffic.
- **GitHub rate limits:** Orbit Next sends **no credentials**, so GitHub's unauthenticated limit (60 requests/hour per IP, shared by all callers from the same Cloudflare egress) applies. Each call uses roughly 4–9 requests, with a 5-minute cache. When the limit is hit, the tool returns a clear rate-limit error with a retry hint. Expect this to bite during busy periods.
- **Limits:** public repositories only; first page of PRs (30) and issues (50); GitHub Actions only; workflow logs need authentication and are not read; no write actions; no private data.
- **Not included:** an authenticated mode (see [roadmap](docs/ROADMAP.md)), a published production endpoint, and any directory listing for the MCP server.

Architecture and threat model: [ARCHITECTURE](docs/ARCHITECTURE.md) · [SECURITY](SECURITY.md) · [PRIVACY](PRIVACY.md).

## Quick start

> **Run these commands from the project root.** Requires Node.js 20+ on macOS or Linux.

```bash
npx orbit-thread install
npx orbit-thread setup
```

Choose Codex, Claude Code or both when prompted. To skip the questions:

```bash
npx orbit-thread install --agent both --scope project --yes
npx orbit-thread setup --agent both --yes
```

Once installed, call the skills in your coding agent:

| Where you're working | Set up a project | Save a handoff | Resume a fresh chat |
| --- | --- | --- | --- |
| Codex | `$orbit-setup` | `$handoff` | `$orbit-resume` |
| Claude Code | `/orbit-setup` | `/handoff` | `/orbit-resume` |
| Claude marketplace plugin | `/orbit-thread:orbit-setup` | `/orbit-thread:handoff` | `/orbit-thread:orbit-resume` |

The commands in the table are **skill invocations in your coding agent's chat**, not Terminal commands. The agent can also save a handoff after a verified milestone, where its host supports automatic skill invocation.

## How it works

Orbit Thread keeps **lasting project knowledge** separate from **the task you're doing right now**.

```mermaid
flowchart LR
    A["🧭 Setup<br/>Docs + agent rules"] --> B["Build and verify<br/>Real project work"]
    B --> C["💾 Handoff<br/>Local checkpoint"]
    C --> D["▶️ Resume<br/>Fresh chat + Git state"]
    D --> B
```

| Source | Role |
| :--- | :--- |
| **Git** | Code history, active branch and working-tree truth. |
| **Living docs** | The current product, design, architecture, security and roadmap. |
| **`HANDOFF-STATE.md`** | Short local checkpoint of verified progress and unfinished work. |
| **Resume** | Reconciles that checkpoint with current Git and only the relevant docs. |

> [!IMPORTANT]
> A handoff isn't a changelog or synchronised chat history. **Current repository evidence overrides stale notes.**

## What setup creates

Orbit Setup can prepare a new project or add the workflow to an existing one. It creates missing files without duplicating equivalent documents already in the repository root or `docs/`.

```text
project/
├── AGENTS.md
├── CLAUDE.md                 # if Claude Code is selected
├── .orbit-thread/
│   └── config.json           # tracked project preferences
└── docs/
    ├── PRODUCT.md
    ├── DESIGN.md
    ├── ARCHITECTURE.md
    ├── SECURITY.md
    └── ROADMAP.md
```

The first successful Handoff also creates `HANDOFF-STATE.md`. That file and Orbit Thread's local ownership state are ignored by Git.

### Which document should change?

| Work completed | Update |
| --- | --- |
| Product behaviour, copy or scope | `PRODUCT.md` |
| Interface, layouts or user experience | `DESIGN.md` |
| Runtime, data flow or integrations | `ARCHITECTURE.md` |
| Authentication, permissions or secrets handling | `SECURITY.md` |
| Plans that have not been implemented | `ROADMAP.md` |

The generated instructions ask coding agents to read only the documents and source files they need. After verified changes, they should **update the relevant sections in place**, not pile new notes underneath old ones.

They also tell agents to preserve applied migrations, leave history to Git and run an appropriate check before claiming work is finished.

## Handoff and Resume

### When to save a handoff

Save a Handoff **after verified work**, before clearing a chat or when nearing a context/usage limit. It is useful after a meaningful milestone or a completed coding task, not for every question or trivial edit. Each checkpoint **overwrites** the previous one.

### What gets saved?

The local, Git-ignored `HANDOFF-STATE.md` records a compact checkpoint, usually about 30 lines, with a **50-line maximum**:

```markdown
# Handoff State

Updated: 12-10-2026 08:30

## Current objective
- Complete account security settings.

## Completed milestones
- Added the settings route.
- Connected password changes and session revocation.

## In progress
- Passkey management UI.

## Current state
- Branch: feature/security-settings

## Open issues / risks
- Passkey removal needs browser verification.

## Immediate next steps
1. Finish passkey management.
2. Run the authentication suite.

## Verification
- Typecheck passed.
- Unit tests passed: 42/42.
```

**v1.2.1 compatibility:** Resume also recognises `## Completed this session`, while keeping `## Completed milestones` canonical. If both have entries, it uses the canonical heading without duplicates. It handles **multiple entries, blank lines and subheadings**, showing up to six entries per section to keep the summary compact.

Handoff validates the replacement, checks recognisable secret patterns and writes atomically. It makes no network requests or Git changes. Never put credentials or sensitive personal/production details in a handoff.

### Orbit Resume: starting a fresh session

**Orbit Resume turns a previous checkpoint into an evidence-based starting point for a new chat.** It reads the latest usable handoff, current Git status and only the living docs relevant to the next task. You don't need to paste your old conversation into the new one.

After Setup, your project instructions ask the agent to run Resume **once at the start of a fresh coding session**. Automatic invocation varies by host; the reliable fallback is a manual skill call:

| Where | Type in the **agent chat** |
| :--- | :--- |
| **Codex** | `$orbit-resume` |
| **Claude Code** | `/orbit-resume` |
| **Claude GitHub marketplace plugin** | `/orbit-thread:orbit-resume` |

**Terminal-only summary:** run this from your project's root:

```bash
npx orbit-thread@latest resume
```

That CLI command is read-only and **does not launch a coding agent**. Running `npx` may fetch the package from npm if needed; the Resume **skill itself never runs `npx` or installs tools**. Don't rerun the skill repeatedly in the same conversation.

#### What Resume recovers

| Signal | What it tells you |
| :--- | :--- |
| **Objective and milestones** | Previously recorded goals and verified achievements, with explicit unknowns where evidence is missing. |
| **Unfinished work** | In-progress tasks, risks, verification notes and recorded next actions. |
| **Current Git state** | Branch and dirty/untracked changes, without modifying your work. |
| **Relevant living docs** | Pointers to `PRODUCT.md`, `DESIGN.md`, `ARCHITECTURE.md`, `SECURITY.md` or `ROADMAP.md` when the task needs them. |

Missing, invalid or **possibly outdated** handoffs are reported instead of trusted blindly. A changed branch, a handoff date in the future or a newer Git commit date may flag a checkpoint as outdated. Current Git and tracked docs take priority; Resume never invents missing objectives or verification.

#### Common Resume use cases

| Situation | Recommended action |
| :--- | :--- |
| **Fresh chat after a long task** | Write `$handoff` or `/handoff` after verified progress, then Resume in the next chat. |
| **Context or usage limit** | Checkpoint before the limit when possible, then restart a conversation in the same project. |
| **Switching Codex ↔ Claude Code** | Install for both agents in the **same local repo**; either agent can Resume from the same checkpoint and Git state. |
| **Returning after days away** | Resume, review any stale-branch or commit warning, then consult only current relevant docs. |
| **Working tree has uncommitted edits** | Resume identifies current changes **without** reset, clean, stash, stage or commit. |
| **No handoff yet / new clone** | Resume reports what's unknown; give the agent the current task and let it inspect relevant current files. |

#### Example: carry on without your old conversation

**1. Save a checkpoint.** After completing and verifying part of a feature, type `$handoff` in Codex or `/handoff` in Claude Code.

**2. Start a fresh chat** in the same project. If Resume doesn't start automatically, type `$orbit-resume` or `/orbit-resume`.

**3. Continue from the recovered context.** For example:

> Continue the unfinished account settings feature. Preserve my uncommitted changes, check current Git state, and read only the files needed for the next step.

#### Safety and limitations

- **Read-only:** Resume does not modify files or Git, reset, clean, stash, stage, commit, checkout, deploy or push.
- **Selective context:** The skill checks the handoff, Git summaries and task-relevant living docs; it doesn't read `.env`, `.dev.vars`, private keys or unrelated files.
- **Conservative redaction:** Secret-looking values and paths are hidden. Benign lines mentioning `token` or `secret` may also be redacted.
- **Bounded input/output:** Handoff is capped at 50 lines; the terminal CLI refuses symlinks, invalid dates and files larger than 32 KB.
- **Local state:** `HANDOFF-STATE.md` is Git-ignored, so it doesn't automatically transfer to a different machine or clean clone.
- **Evidence first:** Resume cannot recover facts nobody recorded or prove an unverified test passed. Current repository state overrides stale notes.

## Configure subagents

Orbit Thread only **records preferences**. It does not launch subagents itself.

By default, agents should use helpers only when the work warrants them. The configured maximum is **two**, and helpers should not spawn further helpers.

**Set the limit:**

```bash
npx orbit-thread configure --max-subagents 2
```

**Turn subagents off:**

```bash
npx orbit-thread configure --max-subagents 0
```

**Save preferred models and reasoning:**

```bash
npx orbit-thread configure --agent codex --model "GPT-6 Luna" --reasoning high
npx orbit-thread configure --agent claude --model "Claude Sonnet 5.5" --effort medium
```

**Check the saved settings:**

```bash
npx orbit-thread configure --show
```

**Reset one agent's preferences:**

```bash
npx orbit-thread configure --agent claude --reset-subagents
```

The settings live in `.orbit-thread/config.json` and are reflected in Orbit Thread's managed section of `AGENTS.md`. They are preferences, not requirements. If a named model is unavailable, the agent can use a suitable alternative.

## Check your setup

> 🩺 **Doctor** checks Orbit Thread itself. It does not test whether your application works.

Run it after installing, updating, changing configuration or moving to a fresh checkout:

```bash
npx orbit-thread doctor --agent both --scope project
```

Or check each integration separately:

```bash
npx orbit-thread doctor --agent codex --scope project
npx orbit-thread doctor --agent claude --scope project
```

Doctor checks skill versions (including Resume), project configuration, managed instruction blocks, living docs, Git ignore rules and handoff size.

**How do you know it passed?** A successful command exits with status `0`. To print a clear confirmation:

```bash
npx orbit-thread doctor --agent both --scope project && echo "Orbit Thread Doctor passed"
```

A nonzero result means the continuity setup needs attention. It does **not** necessarily mean your app or deployment is broken.

For a quicker check of installed managed skills only:

```bash
npx orbit-thread check
```

## Installation options

### Requirements

- **Node.js 20 or later**
- **Git** for normal repository work
- **POSIX shell and standard Unix tools** for the handoff writer

Orbit Thread supports **macOS and Linux**. For Windows, use **WSL**; native Windows is not currently supported.

### npm for Codex or Claude Code

```bash
npx orbit-thread install
```

| Agent | Project skill directories |
| --- | --- |
| Codex | `.agents/skills/handoff/`, `.agents/skills/orbit-setup/` and `.agents/skills/orbit-resume/` |
| Claude Code | `.claude/skills/handoff/`, `.claude/skills/orbit-setup/` and `.claude/skills/orbit-resume/` |

A user level install uses the equivalent directories under `~/.agents/skills/` or `~/.claude/skills/`.

### Claude GitHub marketplace

In **Claude Code**, run:

```text
/plugin marketplace add shab1h-gh/orbit-thread
/plugin install orbit-thread@orbit-thread
```

Or use these Terminal commands:

```bash
claude plugin marketplace add shab1h-gh/orbit-thread
claude plugin install orbit-thread@orbit-thread
```

This GitHub marketplace route is separate from the **official Anthropic public directory**. Installing from GitHub does not mean the plugin has been approved for that directory.

## Command reference

| Command | Purpose |
| --- | --- |
| `npx orbit-thread install` | Install the three skills for selected agents. |
| `npx orbit-thread setup` | Prepare or update project docs and managed instructions. |
| `npx orbit-thread resume` | Print a concise, read-only project and Git summary; takes no extra options. |
| `npx orbit-thread configure` | Save project subagent preferences. |
| `npx orbit-thread doctor` | Check the project's continuity setup. |
| `npx orbit-thread check` | Check managed skill installation only. |
| `npx orbit-thread@latest update` | Update managed skills that have not been locally changed. |
| `npx orbit-thread uninstall` | Remove managed skills and blocks, preserving project docs and state. |
| `npx orbit-thread init` | Older alias for `setup`. |

Common options:

```text
--agent codex|claude|both
--scope project|user
--yes
```

### Update an existing installation

```bash
npx orbit-thread@latest update --agent both --scope project --yes
npx orbit-thread@latest setup --agent both --yes
npx orbit-thread doctor --agent both --scope project
```

The update command protects locally edited managed skill files. Setup updates managed project instructions and creates missing living docs without replacing existing equivalents.

### Moving from Orbit Handoff 1.0.x

Orbit Thread is the successor to **Orbit Handoff**. The v1.1 and later CLI recognises compatible older managed installations and state while preserving local edits.

```bash
npx orbit-thread@latest update --agent both --scope project --yes
npx orbit-thread@latest setup --agent both --yes
npx orbit-thread doctor --agent both --scope project
```

The old `orbit-handoff` binary name remains an alias inside the new package. Earlier npm releases remain unchanged.

If you installed the Claude GitHub marketplace plugin, update or reinstall it from `shab1h-gh/orbit-thread` and run `/orbit-thread:orbit-setup`.

## Troubleshooting


<details>
<summary><strong>Resume did not start automatically or the skill is missing</strong></summary>

Automatic invocation depends on the coding host and its skill discovery. Use `$orbit-resume`, `/orbit-resume` or `/orbit-thread:orbit-resume` **in the agent chat**.

If the skill is not found, verify the correct installation and scope:

```bash
npx orbit-thread doctor --agent both --scope project
```

You may need a fresh agent session to load new skills. A working `npx orbit-thread resume` Terminal command doesn't itself prove native skill discovery.

</details>

<details>
<summary><strong>Resume reports a missing, invalid or outdated handoff</strong></summary>

`HANDOFF-STATE.md` is local and Git-ignored; a fresh clone may not contain it. An invalid handoff might have a malformed date or heading, missing objective, excessive size or unsupported file type. An outdated warning may reflect a changed branch, future handoff date or newer Git commit. Check current repository evidence, preserve any unfinished work and save a new verified checkpoint when appropriate.

</details>

<details>
<summary><strong>Resume missed a milestone or redacted harmless text</strong></summary>

Use `## Completed milestones` for new checkpoints; v1.2.1 also reads `## Completed this session` and multiple entries per section. When both headings exist, the canonical one wins. Outdated handoffs are not accepted as verified progress. Privacy safeguards can redact an innocent sentence containing terms such as `secret` or `token`. Verify against the local handoff and Git without exposing sensitive data.

</details>

<details>
<summary><strong>Doctor reports a changed AGENTS.md or CLAUDE.md block</strong></summary>

A Markdown formatter can change whitespace inside an Orbit Thread managed block. That can fail the integrity check even when the text looks fine.

Inspect the changes first:

```bash
git diff -- AGENTS.md CLAUDE.md
```

**Only if those files have no work you need to keep**, restore them and rerun setup:

```bash
git restore -- AGENTS.md CLAUDE.md
npx orbit-thread setup --agent both --yes
npx orbit-thread doctor --agent both --scope project
```

If you have intentional edits, do **not** restore the whole files. Repair only the affected managed block, then rerun setup and Doctor. Consider excluding `AGENTS.md` and `CLAUDE.md` from Prettier using `.prettierignore`.

</details>

<details>
<summary><strong>Setup refuses to overwrite a managed block</strong></summary>

That protection is deliberate. Orbit Thread will not replace a block it can no longer confirm it owns.

Review the block and its markers, preserve your own instructions, repair the managed portion and run:

```bash
npx orbit-thread setup --agent both --yes
npx orbit-thread doctor --agent both --scope project
```

Do not delete `.orbit-thread/state.json` or remove markers to get around the check.

</details>

<details>
<summary><strong>My handoff was rejected</strong></summary>

Keep `HANDOFF-STATE.md` at **50 lines or fewer**. Remove credentials, tokens, keys and sensitive personal or production information, then retry. The previous successful handoff is preserved when validation fails.

</details>

<details>
<summary><strong>Does Orbit Thread synchronise chats across agents?</strong></summary>

No. It keeps project documents and a local handoff that agents can read. It does not copy conversation history between Codex and Claude Code. A fresh session should check the handoff and Git rather than assume it has the earlier chat's context.

</details>

<details>
<summary><strong>What if a configured model is unavailable?</strong></summary>

The subagent model and reasoning values are suggestions, not enforced settings. Use an appropriate available model and keep the configured helper limit.

```bash
npx orbit-thread configure --show
```

</details>

<details>
<summary><strong>npm reports a cache permission error</strong></summary>

Try the Doctor command in your normal Terminal and check npm's cache before changing any permissions:

```bash
npm config get cache
npm cache verify
```

A restricted coding environment may report a permissions error even when your Mac's cache is healthy. Do not run npm with `sudo` or change ownership without identifying the failing path.

</details>

## Security and privacy

> 🔒 Orbit Thread's skills and CLI run locally. The handoff writer does not send files to an Orbit Thread service, collect telemetry or alter Git. The optional **Orbit Next** MCP is the only networked component: it reads public GitHub data and stores nothing.

The installer protects unmanaged skills and locally modified managed files. Setup leaves unrelated instructions and existing project documents alone. Resume is read-only and conservatively redacts sensitive-looking text and paths in its report.

The secret checker catches some recognisable patterns, **not every type of sensitive information**. Do not include passwords, API keys, recovery codes, personal data or production secrets in handoffs or living docs.

Installing packages or using a coding agent can still involve **npm, GitHub, OpenAI or Anthropic** under those providers' own terms and privacy policies.

Read [Security](SECURITY.md), [Privacy](PRIVACY.md) and [Terms of Service](TERMS.md) for the details.

## Provider directories

The repository includes a portable skills plugin ZIP for the OpenAI upload flow and a Claude plugin manifest for Anthropic and GitHub distribution.

**Submission, approval and publication are separate steps.** A working npm or GitHub installation does not establish that a plugin is publicly listed by OpenAI or Anthropic. See [directory submission notes](docs/SUBMISSION.md).

## Contributing

Bug reports, documentation improvements and focused pull requests are welcome.

See [CONTRIBUTING.md](CONTRIBUTING.md), or [open an issue](https://github.com/shab1h-gh/orbit-thread/issues).

## Licence

[MIT](LICENSE). Created by **Shabih Anwar**.
