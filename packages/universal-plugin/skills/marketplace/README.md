# marketplace skill

Run a repository's own plugin marketplace: generate the catalogs the runtimes read, list plugins
that live elsewhere, and check that what is on disk is what each runtime will load.

## A gateway over three routes

`SKILL.md` holds no procedure. It classifies the request and loads one reference:

| Route | Covers | Reference |
| --- | --- | --- |
| `init` | The repository holds the plugins. Derive a catalog from `plugins/`, then offer the README install section. | `references/init.md` |
| `add` | The plugin lives elsewhere — an npm package, a GitHub repo, or `<plugin>@<marketplace>`. | `references/add.md` |
| `validate` | Check the catalogs against the schema each runtime loads. Both other routes end here. | `references/validate.md` |

The split exists because the two writing routes answer different questions and share almost no
steps. A single document had to hedge every instruction with "unless the plugin is not in this
repository", and the `add` half did not exist at all.

`init` and `add` compose on one repository. A regeneration keeps the entries `add` wrote, because
discovery could never have produced them — and keeps a non-local source on a plugin it *does*
discover, so a plugin shipped through npm is not rewritten to a repository path holding gitignored
build output.

## Support is uneven, and the skill says so

| Runtime | Reality |
| --- | --- |
| Claude Code | a catalog plus two documented commands; works end to end |
| GitHub Copilot CLI | same, with `copilot plugin marketplace add` |
| Codex | a catalog plus `codex plugin marketplace add` and `codex plugin add`, both shipped and undocumented; works end to end |
| Cursor | a catalog Cursor reads, but no command that adds it locally; users get it through a team marketplace an admin imports |

`references/runtimes.md` is the only source of install commands, and every command in it carries an
evidence ID. That constraint exists because the obvious way to write an install section is to copy
one from another project's README, and two of the four commands in the README that prompted this
skill are not in any vendor documentation.

The unevenness reaches `add` as well: only a repository path installs everywhere. An npm source
reaches Claude Code and Codex, and the other two are reported skipped rather than written a source
they refuse.

## The validation half

`scripts/validate.mjs` checks each catalog against the shape its runtime actually loads and names the
key at fault. It exists because a broken catalog fails silently here and loudly at install time, in
someone else's terminal. Two shapes reach a repository unnoticed, both of them what `package.json`
carries: `owner` as a `"Name <email>"` string, and `repository` as a `{ type, url }` object. Claude
Code refuses the catalog for either. Generation now reduces what it can (an npm `repository` becomes
its URL) and validation catches the rest, including a `./` source pointing at a directory that is not
there.

## The README half

`scripts/install-docs.mjs` reads the catalogs on disk and emits the section as JSON, so the
marketplace name, the plugin names, and the repository slug come from the repository rather than
from a model retyping them. The skill asks before editing the README, because it is the user's
document.

## References

- [Research: local marketplaces](https://github.com/cyberuni/universal-plugin/blob/main/.research/local-marketplaces/conclusion.md)
- [`marketplace add` spec](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/marketplace/add/README.md)
- [`marketplace init` spec](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/marketplace/init/README.md)
- [`marketplace validate` spec](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/marketplace/validate/README.md)
- [Official Claude Code marketplace schema](https://json.schemastore.org/claude-code-marketplace.json)
