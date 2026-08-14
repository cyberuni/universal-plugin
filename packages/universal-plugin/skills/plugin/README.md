# plugin skill

A skill for creating, inspecting, updating, and deleting universal AI coding agent plugins that target multiple runtimes from a single source of truth.

## Supported runtimes

| Vendor      | Manifest path                |
| ----------- | ---------------------------- |
| Claude Code | `.claude-plugin/plugin.json` |
| Cursor      | `.cursor-plugin/plugin.json` |
| Codex       | `.codex-plugin/plugin.json`  |
| Copilot CLI | `plugin.json` at plugin root |

Universal minimum (no vendor manifest needed): `skills/<name>/SKILL.md` or `.mcp.json`. The canonical source of truth is root `plugin.json`.

## Operations

`SKILL.md` is a gateway: it detects what the project already contains, then routes to one operation
reference and only that one gets read.

| Operation | Reference | What it covers |
| --------- | --------- | -------------- |
| Create | [`references/create.md`](./references/create.md) | scaffold a new plugin with chosen vendors and components |
| Adopt | [`references/adopt.md`](./references/adopt.md) | put an existing vendor-specific plugin, or already-shipped skills, onto the open standard |
| Inspect | [`references/inspect.md`](./references/inspect.md) | show build status for each declared vendor |
| Update | [`references/update.md`](./references/update.md) | add/remove vendors or components |
| Delete | [`references/delete.md`](./references/delete.md) | remove generated manifests or the whole plugin |

On invocation the gateway checks for existing vendor manifests and publicly-shipped skills, and
offers adoption when it finds either without a canonical `plugin.json`. Repo-private agent config
(`.claude/skills/`, `.agents/skills/`) is deliberately excluded — it is not something to package.

## References

- [Spec](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/spec.md)
- [Schema](https://raw.githubusercontent.com/cyberuni/universal-plugin/refs/heads/main/schema/v1.json)
- [Examples](https://github.com/cyberuni/universal-plugin/tree/main/examples)
