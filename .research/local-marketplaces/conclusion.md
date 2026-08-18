# Conclusion — Local marketplaces and install instructions (August 2026)

## Last updated

2026-08-18

## Question

A repository can carry its own marketplace catalog so users install the plugin straight from it. For
Claude Code, Cursor, Codex, and GitHub Copilot CLI: what does each runtime read, what does a user
type to add the marketplace and install from it, and which of those commands can be stated as fact?

## Verdict

Three runtimes install from a repository-hosted catalog. All three read a catalog named
`marketplace.json`, and `.claude-plugin/marketplace.json` satisfies every one of them.

| Runtime | Catalog it reads | Add the marketplace | Install | Confidence |
|---|---|---|---|---|
| Claude Code | `.claude-plugin/marketplace.json` | `/plugin marketplace add <owner>/<repo>` | `/plugin install <plugin>@<marketplace>` | High |
| Codex | `.claude-plugin/marketplace.json`, and no other probed path | `codex plugin marketplace add <source>` | `codex plugin add <plugin>@<marketplace>` | High |
| GitHub Copilot CLI | `marketplace.json` in root, `.plugin/`, `.github/plugin/`, or `.claude-plugin/` | `copilot plugin marketplace add <spec>` | `copilot plugin install <plugin>@<marketplace>` | High |
| Cursor | none | not applicable | Customize sidebar, from a reviewed marketplace | High |

One file, `.claude-plugin/marketplace.json`, is read by three of the four. The vendor-neutral name
for it would be nicer, but the path is what ships.

## What follows for this project

- **Write `.claude-plugin/marketplace.json` and three runtimes are covered.** Copilot CLI also reads
  `.github/plugin/marketplace.json`, which `marketplace init --copilot` already writes.
- **`marketplace init --codex` writes a file nothing reads.** It emits
  `.agents/plugins/<name>.json`. A fixture carrying only that file is rejected by Codex with
  "marketplace root does not contain a supported manifest" (E-CODEX-M4, E-CODEX-M5). The target
  should write, or defer to, the Claude catalog instead.
- **Codex's CLI verbs are real but undocumented.** `codex plugin marketplace add` and
  `codex plugin add` ship in codex-cli 0.147.0 and appear in no vendor page reviewed here. Note the
  asymmetry: Codex installs with `plugin add`, Copilot CLI with `plugin install`.
- **Cursor has no local marketplace.** Distribution is the reviewed marketplace or a team
  marketplace; local development is a symlink into `~/.cursor/plugins/local/<name>`. `cursor-agent`
  has no plugin subcommand at all. The `--cursor` scaffold is a submission handoff, not a catalog.

## How this was established

Documentation first, then the shipped CLIs. That order mattered: the docs were right about Claude
Code and Copilot CLI, silent about Codex's marketplace verbs, and would have left this project
shipping a Codex artifact that no runtime reads. Four identical fixtures differing only in manifest
location settled which path Codex accepts, and an end-to-end `add` proved the install path.

## Confidence

High throughout, and the Codex rows now rest on the CLI rather than on documentation. The one
remaining unknown is whether Codex reads any manifest path not among the four probed.

## Recheck triggers

- Codex publishes a plugin CLI reference, or adds support for a vendor-neutral catalog path.
- Cursor ships a repository-local marketplace.
- Claude Code changes the `.claude-plugin/marketplace.json` path or the `plugin@marketplace` grammar.
- A Codex release changes `plugin add` to `plugin install`, or moves the supported manifest path.
