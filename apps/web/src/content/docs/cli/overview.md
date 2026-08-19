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
| `plugin init` | Scaffold a canonical `plugin.json`, and register it in the [local marketplace](../marketplace/) |
| [`plugin install`](../install/) | Install the plugin under development into the runtimes it targets (and `plugin uninstall`) |
| `plugin version <bump>` | Move the version across every file that carries one |
| `plugin bundle` | Pin skill `npx` references to workspace versions |
| [`config`](../config/) | Read and write plugin-registered config in `.agents/universal-plugin.json` |
| `prepare` / `sync` | Detect and apply cross-vendor sync actions for an installed plugin |
| `publish sync-version` | Copy the package version into the canonical `plugin.json` |
| [`marketplace init`](../marketplace/) | Generate repository-local marketplace metadata |
| [`marketplace validate`](../marketplace/#marketplace-validate-checks-what-the-repository-carries) | Check those catalogs against the schema each runtime loads |
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
| _(default)_, `--format toon` | Agents | [TOON](https://toonformat.dev/), roughly 40% fewer tokens than JSON |
| `--format json` | Scripts and pipelines | The full structured result |

A TOON result carries three or four fields per row plus a `summary` line with the counts, so no
follow-up call is needed to learn how the run went:

```
vendors[2]{vendor,path,status}:
  claude-code,.claude-plugin/plugin.json,built
  cursor,.cursor-plugin/plugin.json,built
summary: "built 2, skipped 0, failed 0"
```

`--format json` returns more than the default view, including every warning. `governance show`
prints the governance document itself, so its default stays plain text.

stdout carries the result and nothing else. Next-step lines, warnings, and errors go to stderr, so
piping stdout into a parser stays clean.

`--json` is a deprecated alias for `--format json`.
