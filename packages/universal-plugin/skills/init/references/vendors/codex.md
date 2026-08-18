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

## Skills

For every skill that is not `invocation-policy: model`, the build also writes
`~/.codex/prompts/<name>.md` — the skill body, as a Codex prompt.

Two things follow. It writes **outside the repository**, into the current machine's home directory,
so it is not part of the plugin's tracked output and does not travel with a clone. And it is
**best-effort**: a failure there becomes a build warning, not a failed build. Read the warnings.

## Hooks

Codex hook events are **PascalCase**, like Claude Code's. The build does not translate event names —
see [`claude-code.md`](./claude-code.md).
