# 🧵 Orbit Thread

**Pick up where you left off, without carrying an entire coding conversation into the next session.**

[![npm version](https://img.shields.io/npm/v/orbit-thread?label=npm)](https://www.npmjs.com/package/orbit-thread)
[![CI](https://github.com/shab1h-gh/orbit-thread/actions/workflows/ci.yml/badge.svg)](https://github.com/shab1h-gh/orbit-thread/actions/workflows/ci.yml)
[![MIT licence](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)

Orbit Thread helps **Codex** and **Claude Code** keep their place during long projects. It gives each project a small set of useful documents and saves a short handoff when the agent reaches a verified checkpoint.

No giant session diary. No separate account or hosted memory service. Your repository and Git history remain the source of truth.

| Skill | What it does |
| --- | --- |
| 🧭 **Orbit Setup** | Prepares project docs, agent instructions and optional subagent preferences. |
| 🔁 **Handoff** | Records the current objective, completed work, risks and next actions in `HANDOFF-STATE.md`. |
| ▶️ **Resume** | Reconstructs concise current context from the handoff and read-only Git state. |

**Jump to:** [Quick start](#quick-start) · [How it works](#how-it-works) · [Setup files](#what-setup-creates) · [Handoff and Resume](#handoff-and-resume) · [Subagents](#configure-subagents) · [Doctor](#check-your-setup) · [Commands](#command-reference) · [Help](#troubleshooting)

## Quick start

> 🚀 Run these commands **inside the project** you want to set up.

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

The commands above are **skill invocations**, not Terminal commands. You can also ask the agent to run a handoff after a verified milestone.

## How it works

Orbit Thread keeps **lasting project knowledge** separate from **what the agent is doing right now**.

```text
Existing project
      │
      ▼
Orbit Setup
      │
      ├── Living docs and agent instructions
      └── Project preferences
      │
      ▼
Agent completes verified work
      │
      ▼
Handoff rewrites HANDOFF-STATE.md
      │
      ▼
Next session checks handoff + Git + relevant docs
      │
      ▼
Continue from the last verified point
```

The important distinction:

- **Git** keeps the history of code and decisions.
- **Living docs** describe the project as it stands today.
- **`HANDOFF-STATE.md`** says where the current task stands and what needs doing next.

The handoff is a checkpoint, **not** another changelog or a substitute for Git. If the handoff is stale, the current repository state wins.

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

Handoff is intended for moments that matter:

- After a verified milestone that changes the repository or lasting project information.
- At the end of a coding task that made those changes.
- Before clearing a session or stopping because of a usage or context warning.

It is not necessary for ordinary questions or tiny edits with no lasting effect. Each successful checkpoint **replaces** the previous handoff.

### What gets saved?

Handoffs are usually around 30 lines, with a **hard limit of 50 lines**.

```markdown
# Handoff State

Updated: 07-10-2026 00:30

## Current objective
- Finish account security settings.

## Completed milestones
- Added the settings route.
- Connected password changes and session revocation.

## In progress
- Passkey management UI.

## Open issues / risks
- Passkey removal still needs a browser test.

## Immediate next steps
1. Finish passkey management.
2. Run the authentication suite.

## Verification
- Typecheck passed.
- Unit tests passed: 42/42.
```

The writer validates the replacement before saving it, checks for recognisable secret patterns and writes the file atomically. **It makes no network requests and does not change Git.** Secret detection is a safety net, not a guarantee; never put sensitive data in a handoff.

### Starting a fresh session

Start each new coding task in a fresh chat. Orbit Setup asks the agent to invoke Resume once when the session starts (automatically where the host supports it). If it does not start automatically, use `$orbit-resume`, `/orbit-resume`, or `/orbit-thread:orbit-resume` in Claude marketplace installs. Do not invoke it repeatedly in the same session.

For a terminal summary, run:

```bash
npx orbit-thread resume
```

Resume prints the handoff objective, verified milestones, unfinished work, risks, verification, current branch and working-tree status, next steps and relevant living-doc paths. It is read-only: it does not modify files or Git, install tools, deploy, or inspect secret files. It uses current repository evidence over stale handoff details, flags a handoff that appears older than the latest commit, and preserves dirty changes. If the handoff is absent or invalid, it says what is unknown rather than guessing.

This lightweight checkpoint saves tokens by replacing repeated conversation history with a short summary and only the project documents the next task needs. It cannot recover details that were never recorded, prove that an unrecorded check passed, or determine the user's next goal when none was stated. Use the current request as the objective and say when evidence is missing.

The project instructions ask the agent to:

1. Use the Resume summary or read `HANDOFF-STATE.md` once if no summary was supplied.
2. Check the branch, working tree, diff summary and recent Git history.
3. Read only living docs relevant to the current task.
4. Inspect only source needed for the next action.
5. Preserve unfinished work and continue from the latest verified point.

You do not need to paste an old conversation into the next session.

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
| `npx orbit-thread resume` | Print a concise, read-only project and Git summary. |
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

> 🔒 Orbit Thread's handoff writer runs locally. It does not send files to an Orbit Thread service, collect telemetry or alter Git.

The installer protects unmanaged skills and locally modified managed files. Setup leaves unrelated instructions and existing project documents alone.

The secret checker catches some recognisable patterns, **not every type of sensitive information**. Do not include passwords, API keys, recovery codes, personal data or production secrets in handoffs or living docs.

Installing packages or using a coding agent can still involve **npm, GitHub, OpenAI or Anthropic** under those providers' own terms and privacy policies.

Read [Security](SECURITY.md) and [Privacy](PRIVACY.md) for the details.

## Provider directories

The repository includes a portable skills plugin ZIP for the OpenAI upload flow and a Claude plugin manifest for Anthropic and GitHub distribution.

**Submission, approval and publication are separate steps.** A working npm or GitHub installation does not establish that a plugin is publicly listed by OpenAI or Anthropic. See [directory submission notes](docs/SUBMISSION.md).

## Contributing

Bug reports, documentation improvements and focused pull requests are welcome.

See [CONTRIBUTING.md](CONTRIBUTING.md), or [open an issue](https://github.com/shab1h-gh/orbit-thread/issues).

## Licence

[MIT](LICENSE). Created by **Shabih Anwar**.
