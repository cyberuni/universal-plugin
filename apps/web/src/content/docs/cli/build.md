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
5. Pin any `mcpServers` invocation marked `pinToPluginVersion` to the manifest's version
6. Translate `${PLUGIN_ROOT}` / `${PLUGIN_DATA}` env vars
7. Enforce required fields (fails build on missing)
8. Write to the vendor output path

Then, once per build: each repository-local marketplace catalog the repository **already carries**
has this plugin's entry re-derived, for the vendors just built, so a catalog entry's version follows
the canonical manifest instead of drifting. No catalog is created — that stays with
[`plugin init --vendor` and `marketplace init`](../marketplace/) — and nothing else in the file
changes. `--dry-run` reports the refresh as planned and writes nothing.

## Pinning an MCP server to the plugin version

A plugin whose MCP server is its own npm package launches it unpinned:

```json
{ "command": "npx", "args": ["-y", "my-server", "mcp"] }
```

A consumer on plugin 1.4.0 then gets 1.4.0's skills alongside whatever `npx` resolves as latest for
the server, and the two drift further with every release the consumer does not reinstall. The version
is known at build time and nowhere else — `mcp.json` expands only `${PLUGIN_ROOT}` and
`${PLUGIN_DATA}`, so a `${PLUGIN_VERSION}` placeholder would reach the client literally.

Mark the entry and the build stamps the version on:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "my-server", "mcp"],
      "pinToPluginVersion": true
    }
  }
}
```

The derived manifest carries `["-y", "my-server@1.4.0", "mcp"]`, and `pinToPluginVersion` is gone —
it is a build directive, not part of any vendor's schema.

The marker is **required**. The build never matches on name: a plugin may publish its server under a
package name that is not the plugin's, and an unrelated `npx -y widget-cli` sitting in the same
block must never be stamped with this plugin's version.

- An already-pinned specifier is **overwritten** with the manifest version, and the build warns naming
  the version it replaced. Do not hand-pin a marked entry.
- A marked entry the build cannot pin — the `command` is not `npx`/`upx`, the manifest declares no
  `version`, or `args` carry no package specifier — is warned about and left alone. The build stays
  green.
- A path declaration (`"mcpServers": "./mcp.json"`) with a marked entry gets a derived
  `<vendor-dir>/mcp.json` and the vendor's `mcpServers` repointed at it. Your authored `mcp.json` is
  never rewritten. With nothing marked, nothing is derived and the declaration passes through.
- `copilot-cli` reads the canonical manifest directly, so it has no derived manifest to receive the
  pin; the build warns rather than pretending otherwise.

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
