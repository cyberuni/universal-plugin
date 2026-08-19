# Conclusion — Local marketplaces and install instructions (August 2026)

## Last updated

2026-08-18

## Question

A repository can carry its own marketplace catalog so users install the plugin straight from it. For
Claude Code, Cursor, Codex, and GitHub Copilot CLI: what does each runtime read, what does a user
type to add the marketplace and install from it, and which of those commands can be stated as fact?

A second question, added August 2026 for `plugin install`: before any of that, how does an author put
the plugin they are **developing** into each runtime?

## Verdict

Three runtimes install from a repository-hosted catalog. All three read a catalog named
`marketplace.json`, and `.claude-plugin/marketplace.json` satisfies every one of them.

| Runtime | Catalog it reads | Add the marketplace | Install | Confidence |
|---|---|---|---|---|
| Claude Code | `.claude-plugin/marketplace.json` | `/plugin marketplace add <owner>/<repo>` | `/plugin install <plugin>@<marketplace>` | High |
| Codex | `.claude-plugin/marketplace.json` or `.agents/plugins/marketplace.json` | `codex plugin marketplace add <source>` | `codex plugin add <plugin>@<marketplace>` | High |
| GitHub Copilot CLI | `marketplace.json` in root, `.plugin/`, `.github/plugin/`, or `.claude-plugin/` | `copilot plugin marketplace add <spec>` | `copilot plugin install <plugin>@<marketplace>` | High |
| Cursor | `.cursor-plugin/marketplace.json` or `.claude-plugin/marketplace.json` | an admin imports the repository from the dashboard | Customize sidebar, or the local plugin directory below | High |

One file, `.claude-plugin/marketplace.json`, is read by three of the four, so a repository that
generates only the Claude catalog is installable from Claude Code, Codex, and Copilot CLI.

Codex reads two paths, `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`, so
either one covers it. Discovery is by the filename `marketplace.json` inside a supported directory;
a catalog named anything else is not found, whatever directory it sits in.

Where one file has to serve two runtimes, the Claude shape is the portable one: `name`, `owner`, and
`plugins` with `./`-prefixed string sources. Claude Code rejects a catalog without `owner`; Codex
requires no `owner` and tolerates extra fields, so the stricter schema wins.

`owner` is an object on Claude Code and on Cursor, and its `name` is required. A string there is a
schema error rather than a tolerated shorthand: `claude plugin validate` reports `owner: Invalid
input: expected object, received string` and fails (E-CC-M8).

### Installing a plugin under development

Two runtimes scan a directory for locally developed plugins. The other two have none, and go through
a local marketplace instead.

| Runtime | Local plugin directory | Symlink out of the tree | Then |
|---|---|---|---|
| Claude Code | `~/.claude/skills/<dir>` (user), `.claude/skills/<dir>` (project) | followed | restart; it loads as `<name>@skills-dir` |
| Cursor | `~/.cursor/plugins/local/<dir>` | **rejected** — copy instead | Developer: Reload Window |
| Codex | none | — | `codex plugin marketplace add <path>`, then `codex plugin add` |
| GitHub Copilot CLI | none | — | `copilot plugin marketplace add <path>`, then `copilot plugin install` |

Claude Code's directory is its **skills** directory, not `~/.claude/plugins/`: `~/.claude/plugins/local/`
does not exist and never did in the version examined (E-CC-M6). Cursor's directory is real, but its
scan resolves each symlink and refuses one that points outside the directory (E-CUR-M4), so the
`ln -s "$(pwd)"` recipe that circulated for both runtimes installs nothing in either. A copy loads in
both.

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
- **Cursor does have a local marketplace**, retracting this topic's earlier verdict. The shipped CLI
  reads `.cursor-plugin/marketplace.json` and `.claude-plugin/marketplace.json` (E-CUR-M5), so the
  Claude catalog covers Cursor too. `cursor-agent` still exposes no plugin subcommand, so nothing is
  installed from a terminal. Cursor's plugins reference documents the same file and its fields, which
  is the vendor page E-CUR-M1 was read as denying (E-CUR-M6): `name`, an object `owner`, `plugins`
  with repository-relative sources, and an optional `metadata.pluginRoot` prefixing them. The catalog
  reaches users when an admin imports the repository as a team marketplace (E-CUR-M7), so generate
  the file and write no Cursor install command.
- **A catalog entry may point at a canonical root `plugin.json`.** Claude Code accepts a `source`
  whose directory carries the Agent Plugins Spec manifest at its root rather than
  `.claude-plugin/plugin.json`, and accepts a `$schema` key on the catalog (E-CC-M9). That is what
  lets `plugin init` register the plugin it just scaffolded, which has no vendor manifest yet.
- **The symlink recipe was wrong for both runtimes it named.** `plugin install` replaces it: it reads
  each vendor's local plugin directory from the vendor registry, links where the vendor follows an
  out-of-tree symlink and copies where it does not, and names the reload step. When a vendor moves
  its directory, the registry is the one place that changes.

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

The Cursor catalog rows now rest on two independent sources — the shipped bundle and the vendor's
reference page — rather than on the bundle alone.

The August local-install rows are weaker than the catalog rows and are marked so. Claude Code's was
run end to end against a sandbox config directory. Cursor's two were **read from the shipped bundle
and not executed**: `cursor-agent` exposes no way to list what it loaded, and Cursor's IDE loader is
a separate program that was not inspected at all. Treat the Cursor symlink rejection as the safe
assumption it is — copying satisfies both a runtime that rejects symlinks and one that does not.

## Recheck triggers

- Cursor's local plugin scan starts following an out-of-tree symlink, or its containment check moves.
- Cursor ships a way for a developer to add a repository marketplace from their own machine, or
  changes the `.cursor-plugin/marketplace.json` fields.
- Claude Code stops accepting a catalog entry whose source carries only a canonical `plugin.json`.
- Claude Code moves the skills directory it adopts plugins from, or renames the `skills-dir` marketplace.
- Codex or Copilot CLI gains a local plugin directory.
- Codex publishes a plugin CLI reference, or adds support for a vendor-neutral catalog path.
- Claude Code changes the `.claude-plugin/marketplace.json` path or the `plugin@marketplace` grammar.
- A Codex release changes `plugin add` to `plugin install`, or moves the supported manifest path.
