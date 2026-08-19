# marketplace skill

Make a repository installable on its own terms: generate the marketplace catalogs the runtimes read,
then write the README section that tells users what to type.

## What it does

`marketplace init` discovers the plugins under `plugins/` and derives one catalog per selected
runtime. This skill picks the targets with the user, runs the generation, validates every catalog
against the schema its runtime loads, and offers the install documentation that goes with it.

Nothing is published. The catalogs sit in the repository until someone adds it as a marketplace.

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
- [`marketplace init` spec](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/marketplace/init/README.md)
- [`marketplace validate` spec](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/marketplace/validate/README.md)
- [Official Claude Code marketplace schema](https://json.schemastore.org/claude-code-marketplace.json)
