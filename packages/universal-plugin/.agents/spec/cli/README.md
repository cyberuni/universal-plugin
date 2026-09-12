---
spec-type: behavioral
concept: [release]
---

# cli — the root program's own identity

The root `universal-plugin` program (`src/cli.ts`), before any subcommand dispatch: its name,
description, and `--version`/`-V` output. Distinct from every command node under `plugin/`,
`governance/`, `marketplace/`, and `config/` — those specify a verb's behavior; this specifies the
bootstrap `Command` instance itself.

## Use Cases

**Subject** — the root program answers `--version` / `-V` with the version of the installed
`universal-plugin` package, not a placeholder:

- **`--version` reports the installed package's version** — `universal-plugin --version` (and its
  alias `-V`) prints the `version` field of the `universal-plugin` `package.json` that ships beside
  the running bundle, exits 0. This holds for every install shape — local install, global install,
  and an unpinned or pinned `npx universal-plugin[@<version>]` invocation — and is independent of the
  working directory or the presence of a project `plugin.json` (the CLI's own version is never
  confused with a target plugin's `version` field).

**Non-goals** — the `plugin version` verb (moves a *plugin's* version, not this CLI's own); bare
`universal-plugin` with no subcommand (content-first dispatch is out of scope for this node — it
shows help, per [`../axi/`](../axi/README.md) principle #8, and carries no separate scenario here).

Every scenario in [`cli.feature`](./cli.feature) maps to one of these behaviors:

| Behavior | What it covers |
|---|---|
| **`--version` / `-V`** | prints the installed package's `version`, not a hardcoded placeholder; exits 0 |
