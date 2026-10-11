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
| [`plugin version`](#plugin-version-stamps-every-place) | Stamp the version into every place it lives, then rebuild |
| [`plugin bundle`](../bundle/) | Deprecated alias of `plugin version` |
| [`config`](../config/) | Read and write plugin-registered config in `.agents/universal-plugin.json` |
| `prepare` / `sync` | Detect and apply cross-vendor sync actions for an installed plugin |
| `publish sync-version` | Deprecated. Runs `plugin version --from-package` |
| `publish check-version` | Fail when `package.json`, `plugin.json`, the vendor manifests, the catalogs, the skill pins, or a marked `mcpServers` entry carry different versions. A place still on `0.0.0-development` is reported as `unstamped`, not as drift. Read-only, for CI |
| [`marketplace init`](../marketplace/) | Generate repository-local marketplace metadata |
| [`marketplace add`](../marketplace/#marketplace-add-lists-a-plugin-that-lives-elsewhere) | List a plugin that lives elsewhere — a path, a GitHub repo, an npm package, or another marketplace's entry |
| [`marketplace validate`](../marketplace/#marketplace-validate-checks-what-the-repository-carries) | Check those catalogs against the schema each runtime loads |
| `clean` | Remove the asset store |
| `self-update` | Update the version pin in `universal-plugin` hook files |

Run `--help` on any group for its flags. The
[package readme](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/readme.md)
carries the full list with examples.

## Derive and stamp

Two commands share the version, and they never overlap.

- **`plugin build` derives.** It writes each runtime's files from the source and never decides a
  version. Vendor manifests copy whatever `plugin.json` carries, and an `mcpServers` entry marked
  `pinToPluginVersion: true` is copied as authored with only the marker stripped. Build can run at any
  time under any release tool.
- **`plugin version` stamps.** One call writes the version into every place, then re-derives through
  `plugin build`.

### `plugin version` stamps every place

```
universal-plugin plugin version [options] [bump]
```

The version comes from one of three sources:

| Source | Call | Used by |
|---|---|---|
| Author bump | `plugin version minor` | Plain repositories, with no `packagePath` |
| Explicit number | `plugin version 1.4.0` | semantic-release |
| The package's `package.json` | `plugin version --from-package` | changesets, release-please |

With `packagePath` declared in `.agents/universal-plugin.json`, a release type is refused. Bump the
package with the release tool, then run `--from-package`. An explicit number and `--from-package` stay
allowed. `--from-package` reads `<packagePath>/package.json`, or the plugin root's `package.json` when
no `packagePath` is declared, and refuses `0.0.0-development`.

It writes:

- `plugin.json`, and the `packagePath` `package.json` for a release type or an explicit number;
- every `npx`/`upx <pkg>@<version>` pin in the text files under the skills directory (Markdown,
  json/yaml, and `.js`, `.mjs`, `.cjs`, `.ts`, `.mts`, `.cts`, `.sh`, `.py` scripts). The plugin's own
  package moves to the new version, other pnpm-workspace CLIs to their workspace versions, and external
  packages are left alone. A skill with `metadata.pin-exempt: true` is skipped;
- `.plugin/pins.json`;
- each authored `mcpServers` entry marked `pinToPluginVersion`, inline or in the mcp file, keeping the marker.

| Flag | Description |
|---|---|
| `--from-package` | Take the version the package's `package.json` already holds |
| `--preid <id>` | Prerelease identifier for the `pre*` release types |
| `--force` | Allow a version that does not advance on the current one |
| `--no-build` | Skip re-deriving the vendor manifests |
| `--dry-run` | Print what would be written without writing |
| `--format <json\|toon>` | Output format |
| `--root <path>` | Plugin root directory |

Wire it into the release tool once:

| Tool | Wiring |
|---|---|
| changesets | `changeset version && universal-plugin plugin version --from-package --root <plugin>` as the root `version` script. `init --npm` writes it |
| release-please | `universal-plugin plugin version --from-package` after the release PR bumps the package |
| semantic-release | `@semantic-release/exec` with `prepareCmd: "universal-plugin plugin version ${nextRelease.version}"` |

semantic-release stamps files that exist only in the npm package unless `@semantic-release/git`
commits them back, with `assets` of `plugin.json`, the vendor manifests, `skills/**`,
`.plugin/pins.json`, and the mcp file. Git-sourced installs (Copilot CLI, GitHub-hosted marketplaces)
read `plugin.json` from the repository, so the commit-back is required for those channels. Without it
they are unsupported. See [ADR-0010](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/design/decisions/0010-version-policy.md) for the reasoning.

`doctor` and `publish check-version` report a place that still holds `0.0.0-development` as
`unstamped` (severity low), apart from `version-drift`. The repair for a package-sourced drift is
`universal-plugin plugin version --from-package`.

### Deprecated commands

`plugin bundle` and `publish sync-version` print a warning and are removed in the next minor release.
`sync-version` now runs `plugin version --from-package`. Pinning was never bundling, and "bundle" is
reserved for compiling skill scripts into one self-contained file.

## Fast alternative: upx

[`@repobuddy/upx`](https://github.com/repobuddy/upx) (`npm i -g @repobuddy/upx`) runs an
already-installed CLI directly instead of resolving one on every call. See
[Choosing a runner](../../concepts/npx-and-upx/) for the cases where `npx` is still the right
runner.

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

`--format json` returns more than the default view, including every warning.

stdout carries the result and nothing else. Next-step lines, warnings, and errors go to stderr, so
piping stdout into a parser stays clean.

`--json` is a deprecated alias for `--format json`.
