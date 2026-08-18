# Conclusion — Local marketplaces and install instructions (August 2026)

## Last updated

2026-08-18

## Question

A repository can carry its own marketplace catalog so users install the plugin straight from it. For
Claude Code, Cursor, Codex, and GitHub Copilot CLI: what does each runtime read, what does a user
type to add the marketplace and install from it, and which of those commands can be stated as fact?

## Verdict

Two runtimes have a documented local-marketplace path end to end. Two do not.

| Runtime | Catalog the repo carries | User adds the marketplace with | User installs with | Confidence |
|---|---|---|---|---|
| Claude Code | `.claude-plugin/marketplace.json` | `/plugin marketplace add <owner>/<repo>` | `/plugin install <plugin>@<marketplace>` | High |
| GitHub Copilot CLI | `marketplace.json` in root, `.plugin/`, `.github/plugin/`, or `.claude-plugin/` | `copilot plugin marketplace add <spec>` | `copilot plugin install <plugin>@<marketplace>` | High |
| Codex | not documented | not documented as a CLI verb | `/plugins` browser, after a marketplace is configured | Low |
| Cursor | none — no local marketplace file format | not applicable | Customize sidebar, from a reviewed marketplace | High |

## What follows for this project

- **Claude Code and Copilot CLI can be documented as commands.** Both have a published `marketplace
  add` verb and a documented catalog path, and the paths `marketplace init` already writes
  (`.claude-plugin/marketplace.json`, `.github/plugin/marketplace.json`) are both on the documented
  read lists.
- **Codex must not be documented as a command.** The Codex plugin docs describe installing through
  the `/plugins` browser and using `@plugin-creator` (`$plugin-creator` in Codex) to add a folder to a
  local marketplace. They do not publish a `codex plugin marketplace add` verb. A widely-copied
  third-party README states that command; it is not corroborated by vendor documentation.
- **The Codex catalog this project writes is unverified.** `marketplace init` writes
  `.agents/plugins/<name>.json` with an `interface`/`policy`/`category` shape. No vendor
  documentation reviewed here describes that path or that schema. Treat the artifact as a local
  convention until a source is found, and do not tell a user Codex will read it.
- **Cursor has no local marketplace.** Distribution is the reviewed marketplace or a team
  marketplace; local development uses a symlink into `~/.cursor/plugins/local/<name>`. The
  submission scaffold `marketplace init --cursor` writes is a handoff document, not something a
  runtime reads.

## Confidence

High for Claude Code and Copilot CLI: both commands and both catalog paths come from current vendor
documentation. High for the Cursor negative. Low for Codex, where the absence is an absence of
documentation rather than documented absence.

## Recheck triggers

- Codex publishes a `plugin marketplace` CLI reference, or documents the marketplace manifest format.
- Cursor ships a repository-local marketplace file.
- Claude Code changes the `.claude-plugin/marketplace.json` path or the `plugin@marketplace` install
  grammar.
