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
| Codex | `.claude-plugin/marketplace.json` or `.agents/plugins/marketplace.json` | `codex plugin marketplace add <source>` | `codex plugin add <plugin>@<marketplace>` | High |
| GitHub Copilot CLI | `marketplace.json` in root, `.plugin/`, `.github/plugin/`, or `.claude-plugin/` | `copilot plugin marketplace add <spec>` | `copilot plugin install <plugin>@<marketplace>` | High |
| Cursor | none | not applicable | Customize sidebar, from a reviewed marketplace | High |

One file, `.claude-plugin/marketplace.json`, is read by three of the four, so a repository that
generates only the Claude catalog is installable from Claude Code, Codex, and Copilot CLI.

Codex reads two paths, `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`, so
either one covers it. Discovery is by the filename `marketplace.json` inside a supported directory;
a catalog named anything else is not found, whatever directory it sits in.

Where one file has to serve two runtimes, the Claude shape is the portable one: `name`, `owner`, and
`plugins` with `./`-prefixed string sources. Claude Code rejects a catalog without `owner`; Codex
requires no `owner` and tolerates extra fields, so the stricter schema wins.

## What follows for this project

- **Write `.claude-plugin/marketplace.json` and three runtimes are covered.** Copilot CLI also reads
  `.github/plugin/marketplace.json`, which `marketplace init --copilot` already writes.
- **`marketplace init --codex` is correct.** It writes `.agents/plugins/marketplace.json`, which
  Codex reads and installs from (E-CODEX-M11). An earlier round of this investigation concluded the
  opposite from a fixture named `<name>.json`; that was a filename error in the probe, not a defect
  in the command (E-CODEX-M4, retracted).
- **The Codex catalog's shape is Codex-only.** Its `interface`, `policy`, `category`, and object
  `source` are accepted by Codex anywhere it looks, but Claude Code rejects that content for the
  missing `owner` (E-CC-M5, E-CODEX-M9). That is an argument for keeping the two artifacts separate,
  which is what the command already does.
- **Codex's CLI verbs are real but undocumented.** `codex plugin marketplace add` and
  `codex plugin add` ship in codex-cli 0.147.0 and appear in no vendor page reviewed here. Note the
  asymmetry: Codex installs with `plugin add`, Copilot CLI with `plugin install`.
- **Cursor has no local marketplace.** Distribution is the reviewed marketplace or a team
  marketplace; local development is a symlink into `~/.cursor/plugins/local/<name>`. `cursor-agent`
  has no plugin subcommand at all. The `--cursor` scaffold is a submission handoff, not a catalog.

## How this was established

Documentation first, then the shipped CLIs, then a correction. The docs were right about Claude Code
and Copilot CLI and silent about Codex's marketplace verbs, which the CLI supplied.

The fixture round went wrong before it went right. The first set of probes varied the directory but
did not hold the filename constant, so `.agents/plugins/<name>.json` failed for its name and was read
as evidence that the directory was unsupported. Re-running with the real artifact name,
`.agents/plugins/marketplace.json`, reversed the finding. The lesson is in the method rather than the
result: a fixture has to differ from the artifact under test in exactly one dimension, and this one
differed in two.

## Confidence

High throughout, and the Codex rows now rest on the CLI rather than on documentation. Path support
and content validity were separated deliberately: Codex reports a bad manifest by naming the file and
the offending field, and an unsupported location by naming the directory (E-CODEX-M8). Every
"unsupported manifest" result is the second form.

Six directories were probed with the correct filename. Codex may read a seventh.

## Recheck triggers

- Codex publishes a plugin CLI reference, or adds support for a vendor-neutral catalog path.
- Cursor ships a repository-local marketplace.
- Claude Code changes the `.claude-plugin/marketplace.json` path or the `plugin@marketplace` grammar.
- A Codex release changes `plugin add` to `plugin install`, or moves the supported manifest path.
