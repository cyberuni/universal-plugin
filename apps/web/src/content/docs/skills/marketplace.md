---
title: marketplace
description: Generate the catalogs that let users install this plugin from the repository, and write the README install section.
---

Fronts [`marketplace init`, `marketplace add`, and `marketplace validate`](../../cli/marketplace/). It
generates the catalogs that let users install from this repository, and writes the README install
section from what those catalogs carry.

## Which runtimes a local marketplace reaches

All four runtimes read a catalog the repository carries. Each has its own path, and
`.claude-plugin/marketplace.json` is read by the three that install from one directly, so that file
covers them if you want fewer.

| Runtime | Catalog it reads | The user runs |
|---|---|---|
| Claude Code | `.claude-plugin/marketplace.json` | `/plugin marketplace add`, then `/plugin install` |
| Codex | `.agents/plugins/marketplace.json`, or the Claude path | `codex plugin marketplace add`, then `codex plugin add` |
| GitHub Copilot CLI | `.github/plugin/marketplace.json`, or the Claude path | `copilot plugin marketplace add`, then `copilot plugin install` |
| Cursor | `.cursor-plugin/marketplace.json` | nothing; a team admin imports the repository |

Two traps are worth knowing before you write install instructions by hand. Codex installs with
`plugin add` while Copilot CLI uses `plugin install`. And Codex publishes neither verb in its
documentation, so the commands above come from the shipped CLI.

A shared catalog has to satisfy the strictest reader. Claude Code rejects one without an `owner`
field, while Codex requires no `owner` and accepts extra fields, so the Claude shape is the portable
one. Codex also finds a catalog only when it is named `marketplace.json`.

Cursor is the fourth runtime and the exception. It reads a repository catalog, but no command adds
one from a local path: a developer tests through `~/.cursor/plugins/local/<name>`, and users get the
plugin when an admin imports the repository as a team marketplace. So the skill generates the file
and writes no install command for it. Every command it does emit carries an evidence ID in
[the research record](https://github.com/cyberuni/universal-plugin/blob/main/.research/local-marketplaces/conclusion.md).

The README section is generated from the catalogs on disk, so the marketplace name, the plugin
names, and the repository slug come from the repository rather than from a model retyping them.

## See also

- [Local marketplace](../../cli/marketplace/) — the full command reference for `marketplace init`, `add`, and `validate`
- [`publish-plugin`](../publish-plugin/) — lists a packaged plugin in a *shared* marketplace repository instead of the repository's own catalog
