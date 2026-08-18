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

**Codex.** The documentation describes installing through the in-CLI `/plugins` browser and using
`@plugin-creator` to add a folder to a local marketplace. It publishes no `codex plugin marketplace`
verb and no marketplace manifest format.

The CLI publishes both. `codex plugin marketplace add <SOURCE>` accepts "a local path,
owner/repo[@ref], HTTPS Git URL, or SSH Git URL", with `list`, `upgrade`, and `remove` beside it, and
installation is `codex plugin add <plugin>@<marketplace>`. Note that Codex installs with `plugin add`
where Copilot CLI installs with `plugin install`; the verbs are not interchangeable.

Which manifest Codex reads was settled by experiment rather than by reading. Four fixture
repositories were built, identical except for where the catalog sat:

| Fixture | Result |
|---|---|
| `.claude-plugin/marketplace.json` | added |
| `.agents/plugins/<name>.json` | "marketplace root does not contain a supported manifest" |
| `.codex-plugin/marketplace.json` | same error |
| root `marketplace.json` | same error |

Then the accepted fixture was installed from end to end: `codex plugin add demo@probe-claude` landed
the plugin in `~/.codex/plugins/cache/probe-claude/demo/1.0.0`, resolved through a `./`-prefixed
relative `source`, with the plugin itself carrying `.codex-plugin/plugin.json`. The probe marketplace
and plugin were removed afterwards.

This overturns the first pass twice. The README's Codex commands are real, and the catalog this
project writes for Codex is not merely unsourced, it is unread. `marketplace init --codex` emits
`.agents/plugins/<name>.json`, which is exactly the fixture Codex rejected.

**Cursor.** A clear negative, from both directions. `cursor-agent` 2026.07.01 has no plugin or
marketplace subcommand at all. Installation runs through the Customize sidebar against the reviewed
marketplace, cursor.directory, or a team marketplace. Local development is a symlink into
`~/.cursor/plugins/local/<name>`. There is no repository-local marketplace file, which is why the
`--cursor` output of `marketplace init` is a submission scaffold and a handoff document rather than
a catalog.

## What this changed in the product

`marketplace init --codex` writes an artifact no runtime reads, and that is now tracked as a defect
rather than a documentation gap. Until it is fixed, the honest advice for a user who wants Codex
support is to generate the Claude catalog, because Codex reads the same file.

## Open questions

- Does Codex read any manifest path outside the four probed here?
- Where did the `.agents/plugins/` shape come from? It predates this investigation, and nothing in
  the repository records a source for it.
- Do the Codex CLI verbs appear in a reference page not reviewed here? They are absent from the two
  plugin pages that do exist.
