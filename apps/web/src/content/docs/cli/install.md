---
title: plugin install
description: Install the plugin you are developing into the runtimes it targets.
---

Put the plugin in the current directory into the local plugin directory of every runtime its
canonical `plugin.json` declares, so a runtime loads it before it is published anywhere. `plugin
uninstall` takes it back out.

This is local development only. Installing a *published* plugin by name is the runtime's own job —
`/plugin marketplace add` in Claude Code, `codex plugin add`, `copilot plugin install`.

## Usage

```
universal-plugin plugin install [options]
universal-plugin plugin uninstall [options]
```

## Options

| Flag | Description |
|---|---|
| `--vendor <id>` | Install only the named vendor; repeatable |
| `--link` | Symlink the plugin root, failing a vendor that will not load one |
| `--copy` | Copy the plugin root instead of linking it |
| `--force` | Replace a destination this plugin does not own |
| `--list` | Print the resolved targets and destinations without writing |
| `--root <path>` | Plugin root directory (default: current directory) |
| `--format json` | Output as JSON |

`uninstall` takes `--vendor`, `--force`, `--list`, `--root`, and `--format`.

## Where each runtime looks

Two runtimes scan a directory for plugins under development. The other two do not, and are reported
as `unsupported` rather than failed — reach them through a
[repository-local marketplace](../marketplace/).

| Vendor | Destination | Symlink | After installing |
|---|---|---|---|
| `claude-code` | `~/.claude/skills/<name>` | followed | restart Claude Code; it loads as `<name>@skills-dir` |
| `cursor` | `~/.cursor/plugins/local/<name>` | rejected, so a copy is used | run **Developer: Reload Window** |
| `codex` | none | — | `codex plugin marketplace add .`, then `codex plugin add` |
| `copilot-cli` | none | — | `copilot plugin marketplace add .`, then `copilot plugin install` |

`<name>` is the canonical manifest's `name`. These paths come from the vendor registry, so a machine
with a runtime configured elsewhere can override them in
`~/.agents/universal-plugin-vendors.json` without waiting for a release.

## Link or copy

A **link** is live: the next edit is installed already, which is what you want while developing. A
**copy** is a snapshot of the working tree without `.git` and `node_modules`, which is what you want
to see roughly what a consumer receives — and it is the only form Cursor loads, because its scan
rejects a symlink pointing outside its own directory.

The default picks per vendor, and the result row names the mode each vendor got. `--copy` forces a
snapshot everywhere. `--link` forces a link and **fails** a vendor that will not load one, rather
than quietly copying when you asked for a live link.

## What it refuses

- **A destination this plugin does not own** — another plugin's directory, or a symlink pointing
  somewhere else. `--force` replaces it. An install of *this* plugin is always replaced, so
  re-running never stacks.
- **A vendor whose derived manifest is missing** — run [`plugin build`](../build/) first. Installing
  before building hands the runtime a half-built plugin, and the only symptom is silence.
- **A vendor the manifest does not declare** — `install` reads `plugin build`'s target set and never
  widens it.

`uninstall` applies the same ownership test, and reports a destination that was never installed as
`missing` rather than failing, so it is safe to run twice.

## Examples

```bash
# Install into every runtime the manifest declares
universal-plugin plugin install

# See where it would go, without writing
universal-plugin plugin install --list

# One runtime, as a snapshot
universal-plugin plugin install --vendor cursor --copy

# Remove it again
universal-plugin plugin uninstall
```

Sources for the per-runtime facts above, including which were run end to end and which were read out
of a shipped build, are in
[`.research/local-marketplaces/`](https://github.com/cyberuni/universal-plugin/tree/main/.research/local-marketplaces).
