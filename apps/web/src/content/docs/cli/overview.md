---
title: CLI Overview
description: The universal-plugin CLI — commands and output formats.
---

The `universal-plugin` CLI transforms a canonical `.plugin/plugin.json` into vendor-specific manifests.

## Invocation

Always pin to an exact version in hooks and CI:

```bash
# One-off
npx universal-plugin@latest --help

# Scripting (pin)
npx universal-plugin@$(npm view universal-plugin version) <command>
```

## Commands

| Command | Purpose |
|---|---|
| [`build`](/cli/build/) | Generate vendor manifests from `.plugin/plugin.json` |

## Fast alternative: upx

Alongside the `universal-plugin` CLI, `npm i -g universal-plugin` also installs `upx` — a lean,
local-first package runner. `upx <pkg>@^<major>` resolves the range against an already-installed
version and spawns it directly (~10× faster than `npx`, which pays ~1s of resolve+spawn overhead
per call even when cached), falling back to `npx` when nothing local satisfies the range. Requires
`upx` on PATH (a global install), so it's an opt-in swap, not a drop-in replacement for `npx`.

## Output formats

Most subcommands accept `--format`:

| Value | Consumer | Output |
|---|---|---|
| _(default)_ | Humans | Tables, aligned fields |
| `--format json` | Scripts / pipelines | Flat JSON |

`--json` is a deprecated alias for `--format json`.
