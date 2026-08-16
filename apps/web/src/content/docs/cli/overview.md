---
title: CLI Overview
description: The universal-plugin CLI, its command groups and output formats.
---

The `universal-plugin` CLI transforms a canonical root `plugin.json` into vendor-specific manifests.

## Invocation

Always pin to an exact version in hooks and CI:

```bash
# One-off
npx universal-plugin@latest --help

# Scripting (pin)
npx universal-plugin@$(npm view universal-plugin version) <command>
```

## Commands

Manifest authoring lives under the `plugin` command group. The other groups sit at the top level.

| Command | Purpose |
|---|---|
| [`plugin build`](../build/) | Generate vendor manifests from root `plugin.json` |
| `plugin init` | Scaffold a canonical `plugin.json` |
| `plugin version <bump>` | Move the version across every file that carries one |
| `plugin bundle` | Pin skill `npx` references to workspace versions |
| [`config`](../config/) | Read and write plugin-registered config in `.agents/universal-plugin.json` |
| `prepare` / `sync` | Detect and apply cross-vendor sync actions for an installed plugin |
| `publish sync-version` | Copy the package version into the canonical `plugin.json` |
| `marketplace init` | Generate repository-local marketplace metadata |
| `governance` | List and show the version-pinned agent-tool contracts |
| `clean` | Remove the asset store |
| `self-update` | Update the version pin in `universal-plugin` hook files |

Run `--help` on any group for its flags. The
[package readme](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/readme.md)
carries the full list with examples.

## Fast alternative: upx

A global install of `universal-plugin` also puts `upx` on PATH. It runs an already-installed CLI
directly instead of resolving one on every call. See [npx and upx](../../concepts/npx-and-upx/) for
the measurements and the cases where `npx` is still the right runner.

## Output formats

Most subcommands accept `--format`:

| Value | Consumer | Output |
|---|---|---|
| _(default)_ | Humans | Tables, aligned fields |
| `--format json` | Scripts / pipelines | Flat JSON |

`--json` is a deprecated alias for `--format json`.
