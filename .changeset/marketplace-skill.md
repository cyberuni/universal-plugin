---
'universal-plugin': minor
---

Add a `marketplace` skill: generate the repository's own marketplace catalogs, then write the README install section.

`marketplace init` has shipped for a while with no skill in front of it, so nothing surfaced it to an agent. The skill picks targets with the user, runs the generation, verifies it, and offers the install documentation that goes with it.

The install commands were verified by running the CLIs, because the documentation is incomplete and a third-party README was the alternative source:

- **Claude Code, Codex, and Copilot CLI each install from a catalog the repository carries.** Each reads its own path, and all three read `.claude-plugin/marketplace.json`, so one file covers them when a repository wants fewer.
- **Codex's marketplace verbs exist but are undocumented.** `codex plugin marketplace add` and `codex plugin add` ship in codex-cli 0.147.0 and appear in no vendor page. Codex installs with `plugin add` where Copilot CLI uses `plugin install`.
- **Codex discovers a catalog by the filename `marketplace.json`** inside a supported directory. `.claude-plugin/` and `.agents/plugins/` are read; `.codex-plugin/`, `.plugin/`, `.github/plugin/`, and the repository root are not.
- **A shared catalog must carry `owner`.** Claude Code rejects one without it; Codex does not require it and tolerates extra fields, so the Claude shape is the portable one.
- **Cursor has no repository-local marketplace.** The `--cursor` output is a submission handoff, and `cursor-agent` has no plugin subcommand.

`references/runtimes.md` is the only source of install commands, and every entry carries an evidence ID from `.research/local-marketplaces/`. The skill also documents the Codex local-development loop, where an install is cached by plugin version and a source edit needs a reinstall and a new session.

`scripts/install-docs.mjs` derives the README section from the catalogs on disk, so the marketplace name, plugin names, and repository slug come from the repository. It emits JSON and writes nothing; the skill asks before editing the README.
