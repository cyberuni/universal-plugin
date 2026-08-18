# The canonical baseline

What every universal plugin has, before any vendor-specific work.

## The one authored file

Root `plugin.json`, on the Agent Plugins Specification v1.0.0 schema. Everything else a vendor reads
is derived from it.

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "One sentence saying what the plugin does.",
  "author": { "name": "<author>" },
  "extensions": {
    "org.cyberuni.universal-plugin": {
      "vendors": ["claude-code", "cursor", "codex", "copilot-cli"],
      "skills": "./skills/",
      "harnesses": {
        "claude-code": {},
        "cursor": {},
        "codex": {},
        "copilot-cli": {}
      }
    }
  }
}
```

The spec's top level holds the shared metadata. Everything universal-plugin needs to run a build
lives under one namespaced key, `extensions["org.cyberuni.universal-plugin"]`:

| Key | Holds |
| --- | --- |
| `vendors` | the build targets. When absent, the `harnesses` keys are the targets |
| `harnesses` | per-vendor overrides, keyed by vendor id. `{}` opts in with no overrides |
| `packagePath` | the npm package whose `package.json` carries the same version |
| component paths (`skills`, `commands`, `agents`, `hooks`, …) | where each component lives |

`vendors` and `harnesses` are separate on purpose: `vendors` says what to build, `harnesses` says
what each build gets. A vendor listed in `vendors` with no `harnesses` entry still builds; a
`harnesses` entry with no `vendors` list builds only while `vendors` is absent.

## Directory layout

```
<plugin-root>/
├── plugin.json              ← canonical definition (source of truth)
├── skills/<name>/SKILL.md
├── commands/<name>.md
├── agents/<name>.md
├── rules/<name>.mdc         (Cursor-only guidance)
├── hooks/hooks.json
├── .mcp.json
└── README.md
```

`plugin init --scaffold` creates the standard `skills/`, `agents/`, `governances/`, and `commands/`
directories. Create the rest only when the plugin has content for them.

## Components

| Component | Field | Directory | Reaches |
|-----------|-------|-----------|---------|
| Skills | `skills` | `skills/<name>/SKILL.md` | every vendor |
| MCP servers | `mcpServers` | `.mcp.json` | every vendor |
| Commands | `commands` | `commands/<name>.md` | Claude Code, Cursor, Copilot CLI |
| Agents | `agents` | `agents/<name>.md` | Claude Code, Cursor, Copilot CLI |
| Hooks | `hooks` | `hooks/hooks.json` | partial — event names differ by case, and the build does not translate them |
| LSP servers | `lspServers` | `.lsp.json` | Claude Code, Cursor |
| Rules | `rules` | `rules/<name>.mdc` | Cursor only |
| Output styles | `outputStyles` | `output-styles/` | Claude Code only |

The universal minimum — reaching every runtime with no vendor manifest at all — is
`skills/<name>/SKILL.md` plus `.mcp.json`. Reach for a narrower component only when the plugin needs
what only that component does; `governance show plugin-design` is the authority on that choice.

## Constraints

- **Never hand-edit a derived manifest.** `plugin build` owns `.claude-plugin/plugin.json` and its
  siblings; an edit there survives until the next build and no longer.
- **Never hand-edit a `version` field.** See `version.md`.
- **The canonical schema is closed.** A vendor-only field cannot be added at the top level; it goes
  under that vendor's `harnesses` entry or nowhere.
- Root `plugin.json` is not a build artifact. It is both the source of truth and the file Copilot CLI
  reads, so deleting it takes out both.

## Next

Read only the `vendors/<vendor>.md` files for the runtimes being enabled. `SKILL.md` has the table.
