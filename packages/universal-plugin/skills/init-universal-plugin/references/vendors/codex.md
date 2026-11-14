# Codex

Reads `.codex-plugin/plugin.json`. **The build derives it** — never hand-edit it.

```bash
npx universal-plugin plugin build --vendor codex
```

## Extra requirements — the build enforces these

Targeting Codex requires `version` **and** `description` on the canonical manifest. Without either,
`plugin build` fails loudly and writes nothing:

```
plugin.json validation failed:
  - description is required when targeting codex
  - version is required when targeting codex
```

The check is scoped to the vendors actually being built, so a Codex block that is not a selected
target never blocks a build of the others.

## Shared metadata forms

Codex 0.159.3 (November 2026) has two loaders, and which one runs decides what it accepts.
Verified by installing a probe plugin from a local marketplace, and read from
`codex-rs/core-plugins/src/agent_plugin_manifest.rs` and `manifest.rs` at `rust-v0.159.3`.

- **The canonical manifest carries an Agent Plugins `$schema`** (any `https://agent-plugins.org/schemas/...`
  URL). Codex reads root `plugin.json` itself and uses `.codex-plugin/plugin.json` only as an overlay.
  It types `repository` as a string, so an object there fails the load: `codex plugin add` reports
  `missing or invalid plugin.json` and the plugin is not installed. `author` with every sub-field
  optional and `keywords` as a string array are accepted.
- **No Agent Plugins `$schema`.** Codex reads `.codex-plugin/plugin.json`, which does not read
  `repository` or `author` at all, so any form loads.

No derived file can repair the first case, so the build warns, naming the field and `codex`:

```
codex reads the canonical plugin.json and rejects repository as an object, so it will not load this
plugin — write repository as the URL string in plugin.json
```

`doctor-universal-plugin` reports it as `unaccepted-metadata`. The derived `.codex-plugin/plugin.json`
gets the `url` string either way.

## Vendor-specific fields

Codex's presentation metadata goes under its `harnesses` entry:

```json
"codex": {
  "interface": {
    "displayName": "<Human Name>",
    "category": "<category>"
  }
}
```

## Components

What Codex reads from `.codex-plugin/plugin.json` depends on the root `plugin.json`:

- **Root declares the canonical `$schema`** (`https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`,
  the normal universal-plugin layout). Codex reads root `plugin.json` as an Agent Plugins manifest,
  takes skills from `./skills` and MCP servers from `./mcp.json`, and uses `.codex-plugin/plugin.json`
  only as an overlay for `apps`, `hooks`, and `interface`. Any other key there is ignored, and
  commands are not read at all.
- **Root has no `$schema`**. `.codex-plugin/plugin.json` is the manifest. Codex reads `skills`,
  `commands`, `hooks`, `mcpServers`, and `apps` from it, and migrates each command into a skill on
  install, falling back to `./commands/` when `commands` is absent.

Codex has no `agents`, `rules`, `lspServers`, `outputStyles`, `themes`, `channels`, or `monitors` in
either case. `plugin build` leaves any of those out of `.codex-plugin/plugin.json` and warns
(`codex has no "agents" component — the path is left out of .codex-plugin/plugin.json`); the other
vendors still get the path. Set the path under `harnesses.codex` only if you mean Codex to see it
anyway — a harness override is never filtered.

The Codex runtime ignores keys it does not read. The plugin-creator validator Codex ships
(`validate_plugin.py`) is stricter: it rejects any field outside its allowlist, including `commands`
and `hooks`. That matters only if you submit the plugin through OpenAI's ingestion flow.

## Skills

Codex reaches a plugin's skills natively. A user invokes one with `$name` or `/skills`, so the
build derives nothing per skill for Codex. Codex custom prompts (`~/.codex/prompts/`) are deprecated
and load only from the user's home directory, and the build never writes there. See
[`codex-skill-invocation`](https://github.com/cyberuni/universal-plugin/blob/main/.research/codex-skill-invocation/conclusion.md).

## Hooks

Codex hook events are **PascalCase**, like Claude Code's, so the canonical file reaches Codex as
authored. Codex runs `command` handlers only — an `http`, `prompt`, or `agent` handler is dropped
from `.codex-plugin/hooks.json` with a warning. See [`claude-code.md`](./claude-code.md).

## Dependencies

Codex reads no plugin dependency. A declaration is left out of `.codex-plugin/plugin.json` with a
build warning — deliberately, because the validator Codex ships for its plugin ingestion contract
rejects any field outside its allowlist, and one unaccepted key fails the whole manifest. See
[`claude-code.md`](./claude-code.md).
