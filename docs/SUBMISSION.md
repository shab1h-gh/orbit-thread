# Directory submission

Updated 7 October 2026.

Provider-directory review is separate from npm, GitHub and standalone installation.

## OpenAI / ChatGPT Plugins Directory

Orbit Thread v1.1.0 is submitted as:

```text
dist/orbit-thread-plugin-1.1.0.zip
```

Build it with:

```sh
npm run build:plugin
```

The ZIP contains portable `plugin.json`, all three canonical skills, OpenAI interface metadata, the Orbit Setup onboarding skill, listing icon and compatibility metadata. Orbit Thread needs no MCP server or external account.

### Submission flow

1. Complete release validation and build the final v1.1.0 ZIP from the release commit/tag.
2. Open the OpenAI Plugins publisher dashboard:
   `https://platform.openai.com/plugins`
3. Upload `orbit-thread-plugin-1.1.0.zip`.
4. Complete automated checks and resolve genuine findings.
5. Review listing metadata and required policy/data-handling declarations.
6. Choose **Submit for review**.
7. Track **Review status** in the same dashboard.
8. After approval, choose **Publish plugin** when ready.

Changing bundled skills or plugin metadata requires a newly uploaded ZIP; changing GitHub alone does not update an already uploaded package.

Only advertise public availability after the dashboard says the plugin is published.

## Anthropic / Claude public directory

The GitHub marketplace route and Anthropic's public Claude directory are separate.

After the repository rename, direct GitHub installation is:

```text
/plugin marketplace add shab1h-gh/orbit-thread
/plugin install orbit-thread@orbit-thread
```

or:

```sh
claude plugin marketplace add shab1h-gh/orbit-thread
claude plugin install orbit-thread@orbit-thread
```

For public-directory publication, use Anthropic's developer directory submission portal. Anthropic announced that developers on paid Claude plans can submit plugins, track review and see usage after publication.

Before submission:

```sh
claude plugin validate ./plugin --strict
claude plugin validate . --strict
```

Then use the directory management/submission surface in Claude, connect the GitHub account that owns `shab1h-gh/orbit-thread`, select the repository/plugin, complete the listing details and submit it for review. Use the immutable v1.1.0 release/tag once created.

A successful GitHub marketplace installation does not mean the plugin is approved for Anthropic's public directory.

## General rule

Provider dashboard state wins over repository documentation. Update these instructions in place if either provider changes its submission flow; Git history already records the old process.
