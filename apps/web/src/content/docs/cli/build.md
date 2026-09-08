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
| `copilot-cli` | `plugin.json` (repo root), plus the `com.github.copilot/` component tree |

## Copilot CLI reads its components from `com.github.copilot/`

Copilot CLI reads the canonical root `plugin.json` directly, so the build derives no manifest for it.
Its components are a different answer. Declaring the canonical `$schema` — which every plugin this
CLI builds does — puts the plugin into Copilot CLI's spec mode, and spec mode reads these **only**
under `com.github.copilot/`, no longer from the plugin root:

| Component | Where Copilot CLI reads it |
|---|---|
| agents | `com.github.copilot/agents/` |
| commands | `com.github.copilot/commands/` |
| rules | `com.github.copilot/rules/` |
| hooks | `com.github.copilot/hooks/hooks.json` |
| LSP servers | `com.github.copilot/lsp.json` |
| extensions (canvases) | `com.github.copilot/extensions/` |
| skills | `skills/` — **does not move** |
| MCP servers | `mcp.json` — **does not move** |

The namespace **replaces** the plugin root for the kinds that move; an explicit component path in the
manifest does not bring the root path back. So you keep authoring at the canonical locations, and
`plugin build` derives the tree: `agents/` is copied to `com.github.copilot/agents/` — renamed to
Copilot CLI's `.agent.md` convention, since the canonical `agents/` is the Claude Code-shaped `*.md`
and a file under the other name is ignored — the hooks file is translated into
`com.github.copilot/hooks/hooks.json`, and a declared `lspServers` path is copied to
`com.github.copilot/lsp.json`. Commands and rules keep their authored names. An inline `lspServers` map is not delivered — the file's top-level
shape is undocumented, so the build warns rather than guessing.

`com.github.copilot/extensions/` runs the other way: canvas extensions have no canonical root
location, so you author them there and the build passes them through untouched, including under
`--clean`.

The vendor reports `built` at `com.github.copilot/` when it derives any of this, and keeps reporting
`canonical` when the plugin declares none of the moved kinds. If you ship agents at the root and no
namespace copy exists, Copilot CLI loads none of them and says nothing — `/universal-plugin:doctor`
reports that as `copilot-root-components`.

## Build steps

For each vendor in `extensions["org.cyberuni.universal-plugin"].vendors`:

1. Start with all canonical fields from root `plugin.json`
2. Merge `extensions["org.cyberuni.universal-plugin"].harnesses.<vendor>` fields (vendor fields win on conflict)
3. Drop component fields and dependencies unsupported by the vendor (emits a warning)
4. Translate hook event names to vendor casing
5. Pin any `mcpServers` invocation marked `pinToPluginVersion` to the manifest's version
6. Translate `${PLUGIN_ROOT}` / `${PLUGIN_DATA}` env vars
7. Enforce required fields (fails build on missing)
8. Write to the vendor output path — and for `copilot-cli`, derive the `com.github.copilot/` component tree instead of a manifest

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
  pin — and `mcp.json` is one of the two paths its spec mode leaves at the plugin root, so there is no
  derived file either. The build warns rather than pretending otherwise.

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
