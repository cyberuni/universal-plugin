---
name: marketplace
description: Use this skill to run a repository's own plugin marketplace — generate the catalogs Claude Code, Codex, GitHub Copilot CLI, and Cursor read, list a plugin that lives elsewhere (an npm package, a GitHub repo, or `<plugin>@<marketplace>`), check every catalog against the schema its runtime loads, and write the README install section. Trigger on "set up a local marketplace", "let users install this from my repo", "generate marketplace catalogs", "add a plugin to the marketplace", "list this npm package in my marketplace", "make this repo installable", "add install instructions to the README", or "check my marketplace catalogs".
argument-hint: '[init|add|validate] [--claude] [--codex] [--copilot] [--cursor] [--dry-run] [--force]'
---

# marketplace

A repository can carry its own catalog, so a user adds the repository as a marketplace and installs
from it. No service, no submission, no account.

This skill is the front door to that catalog. It routes; the procedure lives in the reference the
route names. Read only the one you need.

## Routes

| Route | Use it when | Procedure |
| --- | --- | --- |
| `init` | The repository **holds** the plugins. Derive a catalog from what is on disk, then offer the README install section. | `references/init.md` |
| `add` | The plugin **lives elsewhere** — an npm package, a GitHub repository, or an entry another marketplace already publishes. | `references/add.md` |
| `validate` | Check the catalogs the repository already carries against the schema each runtime loads. | `references/validate.md` |

`init` and `add` are not alternatives. One repository can be both a plugin's home and a curated
list, and the two commands compose: a regeneration keeps the entries `add` wrote, because discovery
could never have produced them.

Both routes end in `validate`. A catalog the runtime rejects is worse than no catalog — it is found,
read, and refused at install time, in someone else's terminal.

## Intake

**Name the route and go.** "Set up a local marketplace", "make this repo installable", "generate the
catalogs" → `init`. "Add repobuddy to the marketplace", "list this npm package" → `add`. "Check the
catalogs" → `validate`. Load that reference and follow it; do not ask.

**Ask only when the invocation is bare.** One question: does the repository hold the plugins it is
listing, or is it listing plugins that live somewhere else? Offer `init`, `add`, and `validate`.

Discovery settles the question faster than the user can:

```bash
ls plugins/*/plugin.json 2>/dev/null
ls .claude-plugin/marketplace.json .agents/plugins/marketplace.json 2>/dev/null
```

Plugins under `plugins/` and no catalog yet is `init`. A catalog already there and nothing new on
disk is usually `add`.

## Where each runtime looks

| Runtime | Catalog it reads | What the user types |
| --- | --- | --- |
| Claude Code | `.claude-plugin/marketplace.json` | `/plugin marketplace add`, then `/plugin install` |
| Codex | `.agents/plugins/marketplace.json`, or the Claude path | `codex plugin marketplace add`, then `codex plugin add` |
| GitHub Copilot CLI | `.github/plugin/marketplace.json`, or the Claude path | `copilot plugin marketplace add`, then `copilot plugin install` |
| Cursor | `.cursor-plugin/marketplace.json` | nothing; an admin imports the repository as a team marketplace |

Three of the four read `.claude-plugin/marketplace.json`, so one file covers Claude Code, Codex, and
Copilot CLI. The reverse does not hold: Claude Code rejects the Codex catalog for its missing
`owner`.

## Rules for every route

- **Never publish a command that is not in `references/runtimes.md`.** An install command that fails
  is worse than no install section, and that file is the only source of them. Widely-copied README
  snippets are not sources. The trap that lives there: Codex installs with `plugin add` where
  Copilot CLI uses `plugin install`.
- **Never hand-author or hand-patch a catalog.** Generate it, then validate it. A catalog written by
  copying fields out of `package.json` carries `owner` as a string and `repository` as an object,
  and Claude Code refuses it for either one.
- **Name every catalog `marketplace.json`.** Codex discovers a catalog by that filename inside a
  supported directory. A file named anything else is invisible to it, whatever directory holds it.
- **Do not write a Cursor install command.** Cursor has no command that adds a repository catalog.
- **Report the validation result, not just the write.** A run that wrote four files and validated
  none has not been verified.
- **Nothing here publishes or registers anything.** Say so in the report; a user who believes they
  have published will not understand why nobody can install.
- **Ask before editing the README**, and before `--force` replaces anything a user may have written
  by hand.
- Listing a plugin in the shared `cyberuni/marketplace` repository is a different job: use
  `publish-plugin`.

## Related skills

| Task | Skill |
|------|-------|
| Create or change the plugin being listed | `init-universal-plugin` |
| Check that the plugin's own manifests are current | `doctor` |
| Move the version users will install | `version` |
| Submit to the shared marketplace repository instead | `publish-plugin` |

## References

- `references/init.md` — derive the catalogs from the plugins this repository holds
- `references/add.md` — list a plugin that lives elsewhere
- `references/validate.md` — check the catalogs against the schema each runtime loads
- `references/runtimes.md` — per-runtime install commands and their sources
- [Research conclusion](https://github.com/cyberuni/universal-plugin/blob/main/.research/local-marketplaces/conclusion.md)
