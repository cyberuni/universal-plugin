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

Codex reads these component paths from `.codex-plugin/plugin.json`: `skills`, `commands`, `hooks`,
`mcpServers`, and `apps`. It reads `commands` by migrating each command into a skill on install, and
falls back to `./commands/` when the field is absent.

Codex has no `agents`, `rules`, `lspServers`, `outputStyles`, `themes`, `channels`, or `monitors`.
`plugin build` leaves any of those out of `.codex-plugin/plugin.json` and warns
(`codex has no "agents" component — the path is left out of .codex-plugin/plugin.json`); the other
vendors still get the path. Set the path under `harnesses.codex` only if you mean Codex to see it
anyway — a harness override is never filtered.

The plugin-creator validator Codex ships (`validate_plugin.py`) is narrower than the runtime: it
also rejects `commands` and `hooks`. That only matters if you submit the plugin through OpenAI's
ingestion flow.

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
