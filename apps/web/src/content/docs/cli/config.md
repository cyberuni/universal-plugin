---
title: config
description: Read and write plugin-registered config in .agents/universal-plugin.json.
---

The `config` command group lets plugins register keyed metadata into
`.agents/universal-plugin.json` at install time, so other plugins can discover it lazily at runtime —
without coupling the consumer to specific plugin names or loading that knowledge every session.

Each key holds an **array of entry objects**. A plugin writes its entry with `config add`; a consumer
reads the whole array back with `config get`. The file is committed and intentional, not a build
artifact.

## config add

Append — or replace by `name` — one entry in the array at `<key>`.

```
universal-plugin config add --key <key> --entry '<json>'
```

### Options

| Flag | Description |
|---|---|
| `--key <key>` | The config key whose array to write (required) |
| `--entry <json>` | The entry object as JSON; **must** include a `name` field (required) |
| `--format json` | Output as JSON instead of the default TOON |
| `--root <path>` | Repo root to resolve `.agents/universal-plugin.json` from (default: cwd) |

`add` is **idempotent for re-installs**: it appends the entry when no existing element shares its
`name`, and replaces the existing element in place (same array position) when one does. Re-running an
install is a no-op-shaped update, never a duplicate.

The merge dedupes on `name`, so `--entry` must be a JSON object carrying a `name` field — that is the
operation's own precondition. No other field is inspected; each key's schema is its consumer's.

Writing never disturbs the rest of the file: `packagePath`, other plugins' keys, and unknown
top-level fields are all preserved. A missing file or missing key is created. The reserved key
`packagePath` (the CLI's own string config) is rejected — `--key packagePath` exits non-zero and
writes nothing.

## config get

Read the full array at `<key>`.

```
universal-plugin config get --key <key> [--format json]
```

| Flag | Description |
|---|---|
| `--key <key>` | The config key whose array to read (required) |
| `--format json` | Emit the raw stored array as JSON (default is TOON) |
| `--root <path>` | Repo root to resolve `.agents/universal-plugin.json` from (default: cwd) |

An absent key or absent file prints a definitive empty state; consumers parse the array themselves.

## Registering config from an install script

A plugin's install or `prepare` flow calls `config add` to announce its metadata. Because the script
runs an external CLI, **pin the runner to a known version** — never `@latest` — so the install is
reproducible:

```bash
# Pin to an exact version (npx)
npx universal-plugin@$(npm view universal-plugin version) \
  config add --key sdd-plugins --entry '{"name":"my-plugin","handles":["agent evaluation"]}'
```

If `universal-plugin` is installed globally, `upx` runs the same call ~10× faster, using a caret
range so one global install serves every caller at that major:

```bash
# Local-first (upx), caret range
upx universal-plugin@^1 \
  config add --key sdd-plugins --entry '{"name":"my-plugin","handles":["agent evaluation"]}'
```

Both forms are safe to re-run on every install: the append-or-replace-by-`name` merge makes a repeat
call an in-place update, not a duplicate. Keep the pin current with the
[`upgrade-universal-plugin`](../../getting-started/installation/) skill, which bumps every
`npx`/`upx universal-plugin@<version>` reference across a project at once.

> The consumer that reads a key (for example, the SDD plugin reading `sdd-plugins`) defines that
> key's entry schema. `config add` only requires valid JSON with a `name`.

## Examples

```bash
# Register (or idempotently update) a plugin's entry
universal-plugin config add --key sdd-plugins \
  --entry '{"name":"aces","handles":["agent evaluation"]}'

# Read every entry a consumer would see
universal-plugin config get --key sdd-plugins

# Machine-readable output for a pipeline
universal-plugin config get --key sdd-plugins --format json
```
