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
| `--strict-dependencies` | Fail when a refreshed catalog cannot resolve a declared dependency |
| `--check` | Write nothing; exit 1 when a vendor manifest, catalog, compiled script or forwarder is missing or stale, or a script is on another version |
| `--root <path>` | Plugin root directory (default: current directory) |
| `--format json` | Output as JSON |

## Checking the build in CI

Commit the files the build derives, and run `plugin build --check` in CI to keep them current. It
writes nothing. It exits 1, naming each file with its status, when:

- a vendor manifest is `missing` or `stale`. A vendor is stale when any file it derives (its manifest,
  a derived hooks or mcp file, a file under `com.github.copilot/`) would be written with other bytes;
- a repository catalog the build refreshes would change; or
- a compiled script or forwarder is behind (see [Compiling skill scripts](#compiling-skill-scripts)).

The comparison is by content, not by modification time, so a fresh checkout passes. To fix a failure,
run `universal-plugin plugin build` and commit the result. `--dry-run` reports the same statuses in its
`content` column and always exits 0.

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
namespace copy exists, Copilot CLI loads none of them and says nothing — `/universal-plugin:doctor-universal-plugin`
reports that as `copilot-root-components`.

## pnpm names for skill references

pnpm installs a skill as `pnpm-<package>-<skill>`, and a scoped `@scope/name` package becomes
`pnpm-@scope+name-<skill>`. A reference written as `/<plugin>:<skill>` resolves to nothing there, and
agents give up with "skill not found". Write the reference once, in the plugin form. The build adds the
pnpm name beside it, in every `SKILL.md` and Markdown file under a skill:

```md
Run `/my-plugin:doctor` (pnpm install: `pnpm-@scope+my-plugin-doctor`) first.
```

- **The name comes from the package.** The build reads `name` in the plugin root's `package.json`, not
  the plugin name. Without a package name, nothing is rewritten.
- **Only skills this package ships.** A reference to another plugin, or to a skill the plugin does not
  have, stays as written, without a warning.
- **A rebuild changes nothing.** A reference that already carries the suffix is skipped.
- **Fenced code is left alone**, because the added text would break a command. So is an inline span that
  holds more than the reference, such as `/my-plugin:doctor --fix`.

Consumers who install through pnpm can add one line to their `AGENTS.md` as a fallback for references
the build did not rewrite:

> When a skill is referenced as `/<pkg>:<skill>` and no skill by that name exists, use the pnpm-installed skill `pnpm-<pkg>-<skill>` (scoped `@scope/name` becomes `pnpm-@scope+name-<skill>`).

Skill names printed by a CLI script are not rewritten.

## Compiling skill scripts

A skill does not always travel with its package. pnpm 12.11 links the skills of a project's direct
dependencies into the agent's skill directory one folder at a time, and falls back to a copy
([pnpm docs](https://pnpm.io/agent-skills)). A plugin cache keeps only what the plugin ships. A script
that climbs out of the skill to reach the package's CLI finds nothing in a copy, and Node refuses to
run a TypeScript file from `node_modules`.

So declare each script a skill runs as an entry, and the build compiles it into one self-contained
`.mjs` inside the skill:

```json
{
  "extensions": {
    "org.cyberuni.universal-plugin": {
      "scripts": {
        "skills/doctor/scripts/doctor.mjs": "src/skills/doctor.ts",
        "skills/tasks/scripts/task-get.mjs": { "source": "src/skills/task-get.ts", "command": "task get" }
      }
    }
  }
}
```

Both paths are relative to the plugin root. The source, its tests and its stories stay in your
package; the skill gets only the built file.

- **Node built-ins stay imports; everything else is inlined.** An entry that imports only Node
  built-ins and its own files keeps readable output. One that inlines a dependency is minified. An
  import the build cannot inline (a package that is not installed) fails that entry and the build
  exits 1.
- **A dynamic import of a variable stays.** `import(id)` with a specifier known only at run time is
  left in the output for Node to resolve then, so a library that loads plugins this way still
  compiles.
- **Set bundle options per entry.** The object form also takes `alias`, a map from an import to the
  package specifier or plugin-root-relative path to bundle instead, and `keepNames`, which keeps
  function and class names for code that reads them at run time:

  ```json
  "skills/ref/scripts/ref.mjs": {
    "source": "src/skills/ref.ts",
    "alias": { "jsonc-parser": "jsonc-parser/lib/esm/main.js" },
    "keepNames": true
  }
  ```

- **Commit the output,** as you commit the vendor manifests, so a git-sourced install carries it too.
  `--dry-run` reports each script as `unchanged`, `missing`, `stale` (its source or imports moved on)
  or `version` (only its embedded version did), and exits 0. In CI, run `plugin build --check`: it
  writes nothing and exits 1 naming each script that is behind. `/universal-plugin:doctor-universal-plugin`
  reports a missing or stale script as `stale-script`.
- **Keep scripts small.** Over 150 KB the build warns. A skill that needs most of your CLI should call
  the CLI through a [forwarder](#running-the-plugins-own-cli-from-a-skill) instead.
- **No hidden characters.** rolldown prints a dependency's `'\u{FEFF}'` as the raw character, which
  skill checks reject because it can hide instructions. The build writes every invisible character
  inside a string, template or regular-expression literal back as a `\uXXXX` escape. One it cannot
  escape, such as one in a comment, warns with its file, line and code point.
- **The scripts declaration is build input.** It never reaches a vendor manifest, and `--vendor` does
  not narrow it.

Each compiled file starts with a header that names its source and embeds the script's data:

```js
globalThis.__SKILL_SCRIPT__ = {
  "package": "@acme/tasks", "bin": "tasks", "version": "1.4.0",
  "entry": "skills/tasks/scripts/task-get.mjs",
  "commands": { "task get": "skills/tasks/scripts/task-get.mjs" }
}
```

`package` and `bin` come from the `package.json` at `packagePath`. `version` comes from `plugin.json`,
never `package.json`, because the build never decides a version: `plugin version` stamps it into
`plugin.json` and into each compiled script's header in the same run. `commands`
maps every entry's declared command path to its file, so the code a script inlines can turn a pointer
to another command into a command line the agent can run: a sibling script as
`node <real path>`, else `pnpm exec <bin>`, else `npx <package>@<version>`. The build ships the data;
reading it is up to your script or the library it inlines.

`publish check-version` compares the embedded version like any other place the version lives. A
script that is behind only on its version is reported there, as `version-drift`, and not also as
`stale-script`.

## Running the plugin's own CLI from a skill

A skill runs a CLI through a forwarding script named after it
([ADR-0022](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/design/decisions/0022-skills-run-the-own-cli-through-a-forwarding-script.md)).
[Running your CLI from skills](../../concepts/running-your-cli-from-skills/) explains the approach, how
the forwarder picks a CLI, and the release wiring. This section lists what the build does with it.

```json
"scripts": {
  "skills/tasks/scripts/tasks.mjs": { "forward": "tasks" },
  "skills/tasks/scripts/other-cli.mjs": { "forward": "other-cli", "package": "other-pkg", "version": "2.1.0" }
}
```

- **The own form** names a bin of the `package.json` at `packagePath`. The forwarder embeds that
  package, the bin and `plugin.json`'s version, which `plugin version` restamps and
  `publish check-version` compares.
- **The pinned form** names another package and an exact version. No stamp moves it and no drift
  check compares it; a changed pin makes the file `stale` until the next build.
- **The file is written, not compiled.** It must be named `<bin>.mjs`, and it takes no `source`,
  `command`, `alias` or `keepNames`. It has no hashbang; the skill runs it with `node`.
- **Rows and `--check` treat it like any script:** `unchanged`, `missing`, `stale`, or `version`.
- **A malformed entry fails and writes nothing:** a bin the own package does not declare, another
  package without an exact `version`, a `version` on the own form, or a plugin that ships to no
  package.

### Launchers are gone

Earlier releases wrote a `bin/<name>` launcher for each entry under `launchers`. Only Claude Code puts
a plugin's `bin/` on `PATH`. Probes on 2026-11-18 found that GitHub Copilot CLI 1.0.100 and Cursor
(cursor-agent 2026.09.28) do not: a bare call failed with `command not found` or exit 127. The build
now warns on a leftover `launchers` key and ignores it. Remove the key and any `bin/<name>` it wrote,
and declare a forwarder instead.

### Links that leave the skill folder

For the same reason, a relative Markdown link in a skill that climbs out of the skill folder
(`../../readme.md`) resolves to nothing in a linked or copied skill. The build warns once per link,
naming the file and line. Copy the file into the skill, or link it by URL. Doctor reports it as
`skill-link-escapes`.

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

Then, once per build, every declared script entry is compiled into its `.mjs` (see
[Compiling skill scripts](#compiling-skill-scripts)), and each repository-local marketplace catalog the repository **already carries**
has this plugin's entry re-derived, for the vendors just built, so a catalog entry's version follows
the canonical manifest instead of drifting. No catalog is created — that stays with
[`plugin init --vendor` and `marketplace init`](../marketplace/) — and nothing else in the file
changes. `--dry-run` reports the refresh as planned and writes nothing.

## Governance copies are gone

Earlier releases copied each governance a skill declared into its `references/governances/` folder,
and `plugin build --check` failed CI when a copy drifted. Both are gone. A skill now loads a
reference by name with the `reference` skill in the `cyber-agentkit` plugin, which runs the
`cyber-agentkit` `reference load` command and falls back to the skill's own
`references/<name>.md`.

A `references/governances/` folder a skill already commits is left as it is. Remove `--check` from
CI: passing it now fails as an unknown option.

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
- a script entry's source does not exist, or imports something that cannot be inlined (the manifests are still written)

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
| `source` | Where the dependency is distributed from, as a catalog source such as `{ "source": "npm", "package": "cyber-asana" }`. Used to list it in your catalog; never reaches a vendor manifest. |

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

### Dependencies and your repository's catalog

A plain dependency (a bare name, or an object with no `marketplace`) resolves only against the
marketplace your plugin is installed from. If your repository carries
`.claude-plugin/marketplace.json` and that catalog does not list the dependency, nobody can install
your plugin from it. So while the build refreshes that catalog, it checks each dependency against it,
reading only files already on disk:

- A plain dependency the catalog does not list warns. Fix it by listing the dependency there
  (`universal-plugin marketplace add npm:<package>`), or by qualifying it with the marketplace that
  does list it and adding that marketplace to the catalog's `allowCrossMarketplaceDependenciesOn`
  (`universal-plugin marketplace set --allow-dependencies-on <marketplace>`).
- A name qualified with this catalog's own name is your explicit choice, and is not checked.
- A name qualified with another marketplace warns unless the catalog lists that marketplace in
  `allowCrossMarketplaceDependenciesOn`. Claude Code refuses the dependency otherwise.

The build stays green on these warnings. Pass `--strict-dependencies` to fail it instead, for
example in CI.

Give the dependency a `source` and the build lists it in the catalog for you, the same way it keeps
your plugin's own entry current:

```json
{ "name": "cyber-asana", "source": { "source": "npm", "package": "cyber-asana" } }
```

Without a `source` the build never adds an entry, because it cannot know where the dependency comes
from.

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
