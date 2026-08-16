# universal-plugin

[![npm version](https://img.shields.io/npm/v/universal-plugin.svg)](https://www.npmjs.com/package/universal-plugin)
[![node](https://img.shields.io/node/v/universal-plugin.svg)](https://www.npmjs.com/package/universal-plugin)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/cyberuni/universal-plugin/blob/main/LICENSE)

Write one canonical plugin manifest (root `plugin.json`). Generate the vendor manifests for Claude
Code, Cursor, Codex, and GitHub Copilot CLI.

## Usage

No install required:

```sh
npx universal-plugin <command>
```

Pin an exact version for reproducible builds:

```sh
npx universal-plugin@0.3.1 <command>
```

## Specification

This package follows the [Agent Plugins Specification](https://github.com/agentplugins/agent-plugins-spec).
That repository is the canonical reference. Consult its versioned specification and releases before
you change manifest or component compatibility behavior.

## Commands

### plugin

Author the canonical manifest and derive everything from it.

```sh
npx universal-plugin plugin init                 # scaffold plugin.json
npx universal-plugin plugin init --npm           # also wire an npm package to ship it
npx universal-plugin plugin build                # generate vendor manifests
npx universal-plugin plugin version <bump>       # move the version across every file carrying one
npx universal-plugin plugin bundle               # pin skill npx references to workspace versions
```

`build` writes `.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json`, and
`.codex-plugin/plugin.json`. Copilot CLI reads the canonical root `plugin.json` directly, so no
fourth file is derived.

Each command writes JSON with `JSON.stringify`. Your repository decides how JSON looks, so run your
formatter after any command that writes a manifest.

### sync

Move an installed plugin from the runtime that installed it to the others.

```sh
npx universal-plugin prepare <vendor-id>              # e.g. claude-code
npx universal-plugin prepare <vendor-id> --scope project --root <path>
npx universal-plugin prepare <vendor-id> --dry-run    # print the action count without writing state
npx universal-plugin sync apply <action-id>
```

### publish

```sh
npx universal-plugin publish sync-version             # copy packagePath/package.json version into plugin.json
```

This writes the canonical `plugin.json` only. Run `plugin build` afterwards, or the vendor manifests
keep their previous version.

### marketplace

```sh
npx universal-plugin marketplace init --codex --root .
```

Codex caches a local plugin install by its marketplace entry version. After you change packaged
plugin files: update the canonical `plugin.json` version, regenerate the catalog (add `--force` to
replace an existing one), reinstall the plugin, then start a new Codex session. The installed copy
and its marketplace entry then carry the same version.

### config

Read and write plugin-registered config in `.agents/universal-plugin.json`.

```sh
npx universal-plugin config get --key sdd-plugins
npx universal-plugin config add --key sdd-plugins --entry '{"name":"aces","handles":["agent evaluation"]}'
```

`add` appends the entry, or replaces the existing entry with the same `name`. Both commands print
TOON by default; pass `--format json` for JSON.

### governance

Version-pinned agent-tool contracts, read at runtime.

```sh
npx universal-plugin governance list
npx universal-plugin governance show plugin-design
```

### Housekeeping

```sh
npx universal-plugin clean                            # remove the asset store
npx universal-plugin self-update <version>            # update the version pin in hook files
```

## upx, the fast package runner

`npm i -g universal-plugin` puts a second bin, `upx`, on PATH.

`upx <pkg>@^<major>` looks for an already-installed version satisfying the range, checking local
`node_modules` first and then global. It spawns that binary directly, skipping the resolve step that
costs `npx` roughly 1s per call. When nothing installed matches, it falls back to `npx`.

```sh
npm i -g universal-plugin
upx cyber-skills@^2 audit validate
```

Use a caret range on the major rather than an exact pin, so one global install serves every caller.

`upx` only works once `universal-plugin` is installed globally. `npx` ships with npm, so keep `npx`
as the default anywhere you cannot guarantee that install.

## Related

This package publishes a plugin. To set up the agent configuration of a repository you work in, use
[`buddy-agent-harness`](https://github.com/repobuddy/buddy-agent-harness).

## License

[MIT](https://github.com/cyberuni/universal-plugin/blob/main/LICENSE)
