# npm publication and releases

Orbit Thread v1.3.0 adds Orbit Next (an optional remote MCP server in `worker/`, never part of the npm package). It is released (tag `v1.3.0`, npm latest, production endpoint live) and has **not been submitted to provider directories**; see [SUBMISSION.md](SUBMISSION.md). Orbit Thread v1.2.2 was a documentation and metadata release that resolves OpenAI plugin submission findings (Terms of Service URL and conversation-starter length). It does not change skill behaviour. v1.2.1 was a compatibility patch for Orbit Resume; v1.2.0 added Resume, and the Orbit Thread line succeeded Orbit Handoff v1.0.x in v1.1.0.

`orbit-thread@1.2.1` is already published; v1.2.2 is released. v1.3.0 is a new, unreleased version.

Historical `orbit-handoff@1.0.0`, `orbit-handoff@1.0.1`, `orbit-thread@1.1.0`, `orbit-thread@1.2.0` and `orbit-thread@1.2.1` releases are immutable. Do not republish, unpublish or move their release tags.

The new primary package is:

```text
orbit-thread
```

## Release checks

Before publication:

```sh
npm test
npm run validate
npm run scan:public
npm run build:plugin
npm pack
npm run smoke:pack
```

Also validate the Claude plugin with the currently installed Claude Code release:

```sh
claude plugin validate ./plugin --strict
claude plugin validate . --strict
```

Inspect:

```text
orbit-thread-1.2.2.tgz
dist/orbit-thread-plugin-1.2.2.zip
```

The npm tarball should contain 36 files (version 1.3.0, including `docs/OPERATIONS.md`, `docs/REVIEW.md`, `TERMS.md`, `lib/resume.mjs` and `plugin/skills/orbit-resume/`). The plugin ZIP should contain 19 files: the portable `plugin.json`, `mcp.json`, `.mcp.json`, `.claude-plugin/plugin.json`, the three canonical skills, the listing icon and the licence, privacy, security and terms documents. Neither should contain tests, `dist/`, credentials or other build residue.

Confirm all three canonical skills are present:

```text
plugin/skills/handoff/
plugin/skills/orbit-setup/
plugin/skills/orbit-resume/
```

and that the packed CLI can install, setup, configure, doctor, update and uninstall in a disposable repository.

## Publish

After release checks pass:

```sh
npm publish ./orbit-thread-1.2.2.tgz --access public --registry https://registry.npmjs.org/
```

Complete npm's normal browser/2FA challenge if prompted. Never weaken npm account security to automate publication.

If interactive authentication is unavailable to the release agent, stop with the verified tarball and give the publisher the exact command above.

## Verify public distribution

After publication:

```sh
npm view orbit-thread@latest version repository --registry https://registry.npmjs.org/
mkdir /tmp/orbit-thread-public-smoke
cd /tmp/orbit-thread-public-smoke
git init
npx orbit-thread@latest install --agent both --scope project --yes
npx orbit-thread@latest setup --agent both --yes
npx orbit-thread@latest doctor --agent both --scope project
npx orbit-thread@latest uninstall --agent both --scope project --yes
```

Also confirm `npx orbit-thread@latest resume` runs read-only in the disposable repository. Verify `latest` resolves to `1.2.2` and package metadata points to `shab1h-gh/orbit-thread`.

## Existing Orbit Handoff users

Because the npm package name changes, users should migrate through the new package explicitly:

```sh
npx orbit-thread@latest update --agent both --scope project --yes
npx orbit-thread@latest setup --agent both --yes
npx orbit-thread doctor --agent both --scope project
```

The v1.1 and later CLI accepts compatible Orbit Handoff ownership/project state and migrates it while refusing locally edited managed files.

After Orbit Thread is publicly verified, the old package may be deprecated with a migration message, but must not be unpublished:

```sh
npm deprecate 'orbit-handoff@<=1.0.1' 'Renamed to orbit-thread. Install orbit-thread@latest.'
```

That command also requires publisher authentication and is optional.

## Claude GitHub-marketplace users

After the repository is renamed:

```sh
claude plugin marketplace add shab1h-gh/orbit-thread
claude plugin install orbit-thread@orbit-thread
```

Then run:

```text
/orbit-thread:orbit-setup
```

Public OpenAI and Anthropic directory publication is separate from npm/GitHub distribution. See [SUBMISSION.md](SUBMISSION.md).
