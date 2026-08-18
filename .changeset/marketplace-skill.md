---
'universal-plugin': minor
---

Add a `marketplace` skill: generate the repository's own marketplace catalogs, then write the README install section.

`marketplace init` has shipped for a while with no skill in front of it, so nothing surfaced it to an agent. The skill picks targets with the user, runs the generation, verifies it, and offers the install documentation that goes with it.

The install commands were verified against the shipped CLIs, not just against vendor documentation, and the two disagree in both directions:

- **One catalog covers three runtimes.** Claude Code, Codex, and GitHub Copilot CLI all read `.claude-plugin/marketplace.json`. Copilot CLI also reads `.github/plugin/marketplace.json`.
- **Codex's marketplace verbs exist but are undocumented.** `codex plugin marketplace add` and `codex plugin add` ship in codex-cli 0.147.0 and appear in no vendor page. Codex installs with `plugin add` where Copilot CLI uses `plugin install`.
- **`marketplace init --codex` writes an artifact Codex does not read.** A fixture carrying only `.agents/plugins/<name>.json` is rejected as an unsupported manifest, and the location is the whole problem: the same content is accepted at `.claude-plugin/marketplace.json`. Tracked in #42; until it is fixed the skill routes Codex users to `--claude`.
- **The portable catalog is the Claude shape.** Claude Code requires `owner`; Codex does not, but tolerates it. One file has to satisfy the stricter reader, so `name`, `owner`, and `./`-prefixed string sources is what the skill generates and documents.
- **Cursor has no repository-local marketplace.** The `--cursor` output is a submission handoff, and `cursor-agent` has no plugin subcommand.

`references/runtimes.md` is the only source of install commands, and every entry carries an evidence ID from `.research/local-marketplaces/`, where each row is direct observation or a vendor page.

`scripts/install-docs.mjs` derives the README section from the catalogs on disk, so the marketplace name, plugin names, and repository slug come from the repository. It emits JSON and writes nothing; the skill asks before editing the README.
