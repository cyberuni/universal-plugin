# 0020 — `plugin build` writes plugin-local launchers as `bin/<name>`

**Status:** superseded by [0021](./0021-skills-run-the-own-cli-through-compiled-scripts.md) on 2026-11-18
**Date:** 2026-11-17
**Builds on:** [0019](./0019-build-compiles-skill-scripts.md) — a derived file is committed and
reported as `missing` or `stale` by `--dry-run` and `--check`.
**Upstream:** [issue #276](https://github.com/cyberuni/universal-plugin/issues/276), and the design
comment on it.

> **Superseded, 2026-11-18:** launchers worked in Claude Code only, and were removed. Probes found no
> other runtime that puts a plugin's `bin/` on `PATH`: GitHub Copilot CLI 1.0.100 copies `bin/` into
> `~/.copilot/installed-plugins/`, but a bare `bin/<name>` call fails with `command not found`, and
> no plugin path is on `PATH`; Cursor (cursor-agent 2026.09.28), with `--plugin-dir` and with
> `~/.cursor/plugins/local/<name>`, loads the skill, but a bare call exits 127, and no plugin path is
> on `PATH`. A `plugin@marketplace` install was not tested on either. A launcher whose entry is
> `dist/` also fails in a git-sourced install, which has no `dist/`
> ([cyber-agentkit#319](https://github.com/cyber-uni/cyber-agentkit/pull/319)). `plugin build` no
> longer writes `bin/<name>`; it warns on a leftover `launchers` key and ignores it. A skill runs its
> plugin's own CLI through a compiled per-command script
> ([0021](./0021-skills-run-the-own-cli-through-compiled-scripts.md)). The record below is kept as it
> was decided.

## Context

A plugin that ships a CLI has no way to say "run my own CLI, at my own version" for its skills. When
the installed CLI is missing or older, agents fall back to `npx -y <pkg>@<version>`. That fetches and
runs code at call time, and a permission rule written for `<cli> ...` never matches the `npx` command.

Claude Code puts a plugin's `bin/` on the Bash tool's `PATH` while the plugin is enabled, after the
user's own `PATH`, so a launcher cannot shadow a system command
([Executables](https://code.claude.com/docs/en/plugins/components.md)). Checked on 2026-11-17 against
cyber-asana 0.28.0, installed from an `npm` source: its extensionless, mode 755 `bin/cyber-asana`
resolved bare, and failed with `env: 'node': No such file or directory` when `node` was not on `PATH`.
Hooks, MCP server processes, Cursor, Codex, Copilot CLI and Windows were not tested.

## Decision

1. **Launchers are declared in the extension.** `extensions["org.cyberuni.universal-plugin"].launchers`
   maps a command name to an entry inside the package, relative to the plugin root. It is build
   config and never reaches a derived manifest.
2. **Each launcher is `bin/<name>`:** extensionless, mode 755, a `#!/bin/sh` shim running
   `exec node "<plugin root>/<entry>" "$@"`. It resolves the root from its own location. A `sh` shim,
   rather than a `node` hashbang, because an extensionless file takes its module type from the nearest
   `package.json`, which the plugin does not control.
3. **A missing entry fails clearly.** Exit 127, a message naming the entry, and the pinned
   `npx -y <package>@<version>` that would run instead. The shim reads the version from `plugin.json`
   when it runs, so `plugin version` has nothing to stamp and the launcher never drifts on version.
4. **The output is committed and checked.** `--dry-run` reports `unchanged`, `missing` or `stale` (the
   content differs, or the file is not executable); `--check` exits 1 for the last two.
5. **A `files` list without `bin` warns,** because the launcher would be built and not published.
6. **Claims stop at what was checked.** Docs say Claude Code's Bash tool, from an npm-sourced install.
   The shim needs `node` on `PATH`.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| A `#!/usr/bin/env node` ESM file importing the entry | Its module type depends on the plugin's `package.json` `type` |
| Embed the version in the shim and stamp it | Touches `plugin version` and the drift check for a message read only on failure |
| Compile the entry into the launcher | That is [#177](https://github.com/cyberuni/universal-plugin/issues/177); a launcher can point at its output |
| Doctor warning for `npx <own package>` in skills | Separate unit; left open on #276, and settled by [0021](./0021-skills-run-the-own-cli-through-compiled-scripts.md) |
