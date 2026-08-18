# Topic — Local marketplaces and install instructions

## Why this was opened

A user pointed at a plugin repository whose README lists install commands for four runtimes and
asked for the same treatment here: set up local marketplaces across harnesses, then offer to write
the README section. Publishing an install command that does not work is worse than publishing none,
so every command was traced to vendor documentation before anything was written.

## What was checked

Four vendor documentation sets, on 2026-08-18:

- Claude Code, "Create and distribute a plugin marketplace" (code.claude.com). Reached through a 301
  from the older docs.claude.com path.
- GitHub Copilot CLI plugin reference (docs.github.com).
- Codex plugins and build-plugins pages (learn.chatgpt.com). Reached through a 308 from
  developers.openai.com/codex/plugins.
- Cursor plugins documentation (cursor.com/docs).

## What each said

**Claude Code.** Complete and unambiguous. The catalog is `.claude-plugin/marketplace.json` at the
repository root. Users run `/plugin marketplace add <owner>/<repo>` and then
`/plugin install <plugin>@<marketplace>`. Both verbs also exist as `claude plugin …` for
non-interactive use, where `--yes` accepts the command string an install prints. One detail matters
for a repository that hosts its own catalog: plugin `source` paths resolve against the marketplace
root, the directory containing `.claude-plugin/`, and they do not resolve at all when a user adds
the marketplace by direct URL to the JSON file.

**GitHub Copilot CLI.** Also complete. `copilot plugin marketplace add <spec>` registers a
marketplace, and the marketplace's own `name` becomes the registration key, so a repository cannot
offer users a custom local alias. `copilot plugin install` accepts `plugin@marketplace` along with
`OWNER/REPO`, a Git URL, and a local path. Marketplace manifests are read from the root, `.plugin/`,
`.github/plugin/`, or `.claude-plugin/`, which means the `.github/plugin/marketplace.json` this
project already writes is on the documented list.

**Codex.** Plugins and marketplaces exist, but the install path documented is the `/plugins` browser
inside the CLI, and marketplace management is described through `@plugin-creator` rather than a
`codex plugin marketplace` command. The build-plugins page documents `.codex-plugin/plugin.json` as
the plugin manifest and documents no marketplace manifest format at all.

The README that prompted this investigation states `codex plugin marketplace add` and
`codex plugin add`. Neither appears in the vendor pages reviewed. That does not prove the commands
are wrong: a CLI reference not reviewed here may publish them, or the docs may lag the CLI. It does
mean this project cannot state them.

A second gap surfaced while checking. `marketplace init` writes a Codex catalog to `.agents/plugins/`
with an `interface`/`policy`/`category` shape, and nothing in the documentation reviewed here
describes that path or that schema. The artifact may still be useful as a local convention, but a
user should not be told Codex reads it.

**Cursor.** A clear negative. Installation runs through the Customize sidebar against the reviewed
marketplace, cursor.directory, or a team marketplace. Local development is a symlink into
`~/.cursor/plugins/local/<name>`. There is no repository-local marketplace file, which is why the
`--cursor` output of `marketplace init` is a submission scaffold and a handoff document rather than
a catalog.

## Open questions

- Does a Codex CLI reference page publish marketplace verbs? The pages reviewed link to a fuller
  builder documentation set that was not read.
- Where did the `.agents/plugins/` Codex catalog shape come from? It predates this investigation.
