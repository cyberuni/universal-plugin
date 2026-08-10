# universal-plugin

[![npm version](https://img.shields.io/npm/v/universal-plugin.svg)](https://www.npmjs.com/package/universal-plugin)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Universal AI agent plugin build tool. Author one canonical plugin manifest (root `plugin.json`) and generate vendor-specific manifests for Claude Code, Cursor, Codex, and GitHub Copilot CLI.

## Specification

This package follows the [Agent Plugins Specification](https://github.com/agentplugins/agent-plugins-spec).
Consult that repository's versioned specification and releases before changing manifest
or component compatibility behavior; it is the canonical reference for the current standard.

## Usage

No install required — run with `npx`:

```sh
npx universal-plugin <command>
```

Or pin to an exact version for reproducible builds:

```sh
npx universal-plugin@0.2.0 <command>
```

## upx — the fast package runner

`npm i -g universal-plugin` also puts a second bin, `upx`, on PATH. `upx <pkg>@^<major>` finds an
already-installed version satisfying the range (local `node_modules` first, then global) and runs
it directly — about 10× faster than `npx`'s ~1s per-call resolve+spawn cost — falling back to
`npx` when nothing installed matches:

```sh
npm i -g universal-plugin
upx cyber-skills@^2 audit validate
```

Use a caret range on the major, not an exact pin, so one global install serves every caller. `upx`
needs to be installed to be on PATH; `npx` always ships with npm, so `npx` remains the safe default
where `universal-plugin` isn't installed globally.

## Commands

### plugin — author the canonical manifest

```sh
# Generate vendor manifests from root plugin.json
npx universal-plugin plugin build
```

`validate` and `init` are specified but implementation is deferred.

### sync — cross-vendor plugin sync

```sh
# Detect cross-vendor sync actions from a vendor's manifest
npx universal-plugin prepare <vendor-id>              # e.g. claude-code
npx universal-plugin prepare <vendor-id> --scope project --root <path>
npx universal-plugin prepare <vendor-id> --dry-run    # print action count without writing state

# Apply a pending sync action
npx universal-plugin sync apply <action-id>
```

### publish

```sh
# Sync version from packagePath/package.json into root plugin.json
npx universal-plugin publish sync-version
```

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

## License

MIT
