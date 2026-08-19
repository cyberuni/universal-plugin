---
title: build
description: Generate vendor manifests from root plugin.json.
---

Read root `plugin.json`, validate it, and write a spec-conformant vendor manifest for each vendor declared in `extensions["org.cyberuni.universal-plugin"].vendors`.

## Usage

```
universal-plugin plugin build [options]
```

## Options

| Flag | Description |
|---|---|
| `--vendor <id>` | Build only the named vendor |
| `--dry-run` | Print what would be written without writing |
| `--verbose` | Print field-by-field transformation decisions |
| `--clean` | Delete generated manifests before building |
| `--root <path>` | Plugin root directory (default: current directory) |
| `--format json` | Output as JSON |

## Vendor identifiers

| `--vendor` | Output path |
|---|---|
| `claude-code` | `.claude-plugin/plugin.json` |
| `cursor` | `.cursor-plugin/plugin.json` |
| `codex` | `.codex-plugin/plugin.json` |
| `copilot-cli` | `plugin.json` (repo root) |

## Build steps

For each vendor in `extensions["org.cyberuni.universal-plugin"].vendors`:

1. Start with all canonical fields from root `plugin.json`
2. Merge `extensions["org.cyberuni.universal-plugin"].harnesses.<vendor>` fields (vendor fields win on conflict)
3. Drop component fields and dependencies unsupported by the vendor (emits a warning)
4. Translate hook event names to vendor casing
5. Translate `${PLUGIN_ROOT}` / `${PLUGIN_DATA}` env vars
6. Enforce required fields (fails build on missing)
7. Write to the vendor output path

Then, once per build: each repository-local marketplace catalog the repository **already carries**
has this plugin's entry re-derived, for the vendors just built, so a catalog entry's version follows
the canonical manifest instead of drifting. No catalog is created — that stays with
[`plugin init --vendor` and `marketplace init`](../marketplace/) — and nothing else in the file
changes. `--dry-run` reports the refresh as planned and writes nothing.

## Validation

The build fails (exit 1) if:

- `name` is missing
- `version` or `description` is missing when targeting `codex`
- root `plugin.json` does not exist at the plugin root
- `--vendor` names a vendor not in `extensions["org.cyberuni.universal-plugin"].vendors`
- `dependencies` is not an array, names a plugin the runtime cannot parse, or carries a `version` that is not a semver range

Unrecognized vendor keys in `extensions["org.cyberuni.universal-plugin"].harnesses` emit a warning and are skipped.

## Plugin dependencies

Declare the plugins your plugin needs once, under
`extensions["org.cyberuni.universal-plugin"].dependencies`:

```json
{
  "extensions": {
    "org.cyberuni.universal-plugin": {
      "dependencies": [
        "cyber-asana",
        { "name": "cyber-notion", "marketplace": "cyberuni", "version": "^0.9.0" }
      ]
    }
  }
}
```

An entry is a plugin name, optionally `@marketplace`-qualified, or an object carrying that name with a
constraint beside it:

| Key | Notes |
|---|---|
| `name` | Required. |
| `marketplace` | Which marketplace to resolve `name` in. A bare name resolves against the declaring plugin's own marketplace. |
| `version` | Semver range, checked against the installed plugin's version. |
| `sha` | Commit sha to pin a git-sourced dependency to. |

Claude Code is the only runtime that reads a dependency, and it acts on one: it installs a missing
dependency, enables it alongside the plugin that needs it, and refuses to load a plugin whose declared
range the installed version does not satisfy. Cursor, Codex, and Copilot CLI read no such field, so the
build leaves it out of their manifests and warns once per vendor, naming what did not reach it. The
build still succeeds — targeting a runtime that ignores dependencies is not an error, but a plugin that
loads there without its dependency is worth saying in your README.

Write a range in the object form. `"cyber-asana@^0.9.0"` is accepted by the runtime, which then
discards the range, so the build warns and names the object to write instead. `"cyber-asana@>=1.0.0"`
is not a legal name and fails the build, as does an npm-style `{"cyber-asana": "^0.9.0"}` map.

The build checks the shape of a declaration, not whether the plugin it names exists. Resolving,
fetching, and installing a dependency is the runtime's job.

## Examples

```bash
# Build all declared vendors
universal-plugin plugin build

# Build only Cursor
universal-plugin plugin build --vendor cursor

# Preview without writing
universal-plugin plugin build --dry-run --verbose

# Clean rebuild
universal-plugin plugin build --clean
```
