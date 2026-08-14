---
name: plugin
description: Use this skill when creating, inspecting, updating, or deleting a universal agent plugin that targets multiple AI coding agent runtimes.
---

# Universal Plugin

Gateway skill. Identify which operation the user wants, load that operation's reference, and follow
it.

## When to use

When the user wants to create, inspect, update, or delete a plugin targeting Claude Code, Cursor,
Codex, and/or GitHub Copilot CLI from a single source of truth.

## Prerequisites

Load governance before starting any operation:

```bash
npx universal-plugin governance show plugin-design
```

Until the CLI is available, read `governances/plugin-design.md` from this plugin's installation
directory. It is the authoritative source for component selection rules and anti-patterns.

## Route

Read exactly the reference for the operation at hand — do not load all four.

| The user wants to… | Reference |
|--------------------|-----------|
| Scaffold a new plugin, add vendors/components to a fresh one, or build vendor manifests | [`references/create.md`](./references/create.md) |
| See what a plugin declares and which vendor manifests are built or stale | [`references/inspect.md`](./references/inspect.md) |
| Add or remove a vendor, or add or remove a component, on an existing plugin | [`references/update.md`](./references/update.md) |
| Remove generated manifests, or remove the whole plugin | [`references/delete.md`](./references/delete.md) |

If the request spans more than one operation (for example "add Codex and rebuild"), load each
reference in turn as you reach that part of the work.

If the operation is unclear, ask which of the four the user means rather than guessing.

## Related skills

| Task | Skill |
|------|-------|
| Move a repo-root plugin into its npm package | `migrate-plugin` |
| Publish a packaged plugin to the marketplace | `publish-plugin` |
| Bump pinned `universal-plugin` versions across a project | `upgrade-plugin` |
| Rewrite `npx` pins to the `upx` runner | `adopt-upx` |

## References

- Governance: `npx cyberplace governance show plugin-design`
- Spec: https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/spec.md
- Schema: https://raw.githubusercontent.com/cyberuni/universal-plugin/refs/heads/main/schema/v1.json
- Examples: https://github.com/cyberuni/universal-plugin/tree/main/examples
