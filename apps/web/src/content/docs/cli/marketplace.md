---
title: Local marketplace
description: Carry a marketplace catalog in the repository so the plugin can be installed from it before it is published.
---

A repository can carry its own marketplace catalog. Users then add the repository as a marketplace
and install the plugin from it — no service, no submission, no account. During development it is how
you install the plugin the way a user eventually will.

Two commands write these catalogs. [`plugin init`](#plugin-init-registers-one-plugin) registers the
plugin it scaffolds, and `marketplace init` derives a catalog for every plugin a repository holds.
Both write the same files; neither publishes anything.

For the shorter loop that skips the catalog entirely — the working copy dropped straight into a
runtime's local plugin directory — see [`plugin install`](../install/).

## Where each runtime looks

| Runtime | Catalog it reads | Add the marketplace | Install |
|---|---|---|---|
| Claude Code | `.claude-plugin/marketplace.json` | `/plugin marketplace add <owner>/<repo>` | `/plugin install <plugin>@<marketplace>` |
| Codex | `.agents/plugins/marketplace.json`, or the Claude path | `codex plugin marketplace add <source>` | `codex plugin add <plugin>@<marketplace>` |
| GitHub Copilot CLI | `.github/plugin/marketplace.json`, or the Claude path | `copilot plugin marketplace add <spec>` | `copilot plugin install <plugin>@<marketplace>` |
| Cursor | `.cursor-plugin/marketplace.json`, or the Claude path | an admin imports the repository as a team marketplace | Customize sidebar |

Three of the four read `.claude-plugin/marketplace.json`, so one file covers Claude Code, Codex, and
Copilot CLI if you want fewer. Two traps: Codex installs with `plugin add` where Copilot CLI uses
`plugin install`, and Codex finds a catalog only when the file is named `marketplace.json`.

Cursor is the exception. It reads a repository catalog, but nothing on the command line adds one:
a developer tests through `plugin install`, and users get the plugin when an admin imports the
repository from the Cursor dashboard. Generate the file; write no Cursor install command.

## `plugin init` registers one plugin

```bash
universal-plugin plugin init --vendor claude-code --vendor cursor
```

Beside the canonical `plugin.json`, this writes a catalog for each selected vendor at the
**repository** root, each carrying an entry for this plugin:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-marketplace.json",
  "name": "acme-widgets-local",
  "owner": { "name": "acme" },
  "plugins": [{ "name": "my-plugin", "source": "./packages/my-plugin" }]
}
```

The catalog belongs to the repository, not to the plugin: it sits at the repository root and lists
every plugin the repository develops. So it is named after the repository, `<owner>-<repo>-local`,
with `-local` separating it from a published marketplace of the same plugins. `source` is the path
from the repository root to the plugin.

`owner` comes from the canonical manifest's author, else the `package.json` that ships it, else the
account the repository lives under. Every runtime requires it, so a repository offering none of the
three gets no catalog and a line on stderr saying why. The same happens outside a repository, and
for Codex until the manifest carries a `version`, which is what its install cache is keyed by.

Pass `--no-marketplace` to skip the step. An `init` with no `--vendor` writes no catalog either.

Re-running `init` folds the entry back in rather than replacing the file. The marketplace name, the
owner, and every other plugin's entry stay as they are, including edits you made by hand — only this
plugin's entry is re-derived.

## `marketplace init` covers a repository

```bash
universal-plugin marketplace init --claude --codex --copilot --cursor
```

This one discovers plugins instead of registering a single one: every `<scan-root>/<dir>/plugin.json`
below `plugins/`, or below each `--plugin-scan-dir` you name. With no target flags it writes all
four catalogs. `--dry-run` prints the plan, and a catalog that differs from what would be generated
stops the run until you pass `--force`, so a hand-edited file is never replaced silently.

## The version is derived, never written

A catalog entry's version is copied from the canonical manifest of the plugin its `source` resolves
to, at generation time. It is not a second number to maintain: on Claude Code the manifest's version
overrides the entry's silently, and an entry whose manifest declares no version carries none. A
version left behind on an entry is removed the next time the entry is derived.

Move the version with `plugin version <bump>`, or with `publish sync-version` where changesets owns
it. See [ADR-0010](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/design/decisions/0010-version-policy.md).

## Nothing here is published

These commands write files into the repository. No marketplace is registered, no plugin installed,
nothing authenticated or provisioned. The catalog does its job when someone adds the repository as a
marketplace.

Sources for the per-runtime facts above, including which were run end to end and which were read out
of a shipped build, are in
[`.research/local-marketplaces/`](https://github.com/cyberuni/universal-plugin/tree/main/.research/local-marketplaces).
