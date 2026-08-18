---
'universal-plugin': minor
---

Add a `marketplace` skill: generate the repository's own marketplace catalogs, then write the README install section.

`marketplace init` has shipped for a while with no skill in front of it, so nothing surfaced it to an agent. The skill picks targets with the user, runs the generation, verifies it, and offers the install documentation that goes with it.

The install commands were verified against vendor documentation first, because the obvious way to write that section is to copy one from another project's README. Two of the four commands in the README that prompted this work do not appear in any vendor page:

- **Claude Code** and **GitHub Copilot CLI** are documented end to end. Both catalog paths the command already writes are on the documented read lists.
- **Codex** publishes no `plugin marketplace add` CLI verb. It installs through an in-CLI `/plugins` browser. The `.agents/plugins/` catalog this project writes for it has no published schema, so the skill refuses to claim Codex reads it.
- **Cursor** has no repository-local marketplace. The `--cursor` output is a submission handoff, not an install path.

`references/runtimes.md` is the only source of install commands, and every entry carries an evidence ID from `.research/local-marketplaces/`.

`scripts/install-docs.mjs` derives the README section from the catalogs on disk, so the marketplace name, plugin names, and repository slug come from the repository. It emits JSON and writes nothing; the skill asks before editing the README.
