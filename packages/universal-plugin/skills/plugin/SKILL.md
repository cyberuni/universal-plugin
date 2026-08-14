---
name: plugin
description: Use this skill when creating, inspecting, updating, or deleting a universal agent plugin that targets multiple AI coding agent runtimes — Claude Code, Cursor, Codex, GitHub Copilot CLI. Also use it to convert a vendor-specific plugin, or a project that already ships skills, onto the open Agent Plugins Specification, for asks like "make my Claude Code plugin work in Cursor", "convert this to the open plugin standard", or "turn these skills into a plugin".
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

## Step 0 — Detect what is already here

Run this before routing. What the project already contains often changes which operation is
actually right — a "create a plugin" request in a repo that already ships skills is an *adopt*, not
a create.

```bash
ls -d .claude-plugin .cursor-plugin .codex-plugin .github/plugin .plugin 2>/dev/null
test -f plugin.json && head -20 plugin.json
find . -name SKILL.md -not -path '*/node_modules/*' -not -path './.git/*'
```

Read the signals:

| What you find | What it means | Do this |
|---------------|---------------|---------|
| Root `plugin.json` with `$schema` on `agent-plugins.org` **and** an `extensions` object | Already on the open standard | Nothing to offer — route normally |
| A vendor manifest (`.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/`, `.github/plugin/`) with **no** canonical root `plugin.json` | A vendor-specific plugin | **Offer to adopt** |
| Root `plugin.json` with no `$schema`/`extensions` | Legacy single-vendor manifest | **Offer to adopt** |
| Public skills (see below) and no plugin manifest at all | Skills shipped without a plugin | **Offer to adopt** |
| None of the above | Greenfield | Route normally |

### Which skills count as public

Only offer on skills the project **distributes**. Repo-local agent configuration is not a plugin,
and offering to package it is wrong.

| Location | Public? |
|----------|---------|
| `skills/<name>/SKILL.md` at the repo root | Yes |
| `<package>/skills/<name>/SKILL.md` where `package.json` `files` ships it | Yes |
| `.claude/skills/`, `.agents/skills/`, `.cursor/rules/` | **No** — repo-private tooling |

If the only skills are in private locations, say nothing about adoption.

### Making the offer

State what you found, what adoption would give them, and let them decline:

> This repo has a Claude Code plugin manifest but no canonical `plugin.json`. I can convert it to
> the open Agent Plugins Specification, which would let one manifest drive Cursor, Codex, and
> Copilot CLI too — Claude Code keeps working exactly as it does now. Want me to?

Offer once. If the user declines, or their request is already a specific unrelated operation
(deleting manifests, inspecting status), drop it and do what they asked.

## Route

Read exactly the reference for the operation at hand — do not load all five.

| The user wants to… | Reference |
|--------------------|-----------|
| Scaffold a new plugin, add vendors/components to a fresh one, or build vendor manifests | [`references/create.md`](./references/create.md) |
| Put an existing vendor-specific plugin, or already-shipped skills, onto the open standard | [`references/adopt.md`](./references/adopt.md) |
| See what a plugin declares and which vendor manifests are built or stale | [`references/inspect.md`](./references/inspect.md) |
| Add or remove a vendor, or add or remove a component, on an existing plugin | [`references/update.md`](./references/update.md) |
| Remove generated manifests, or remove the whole plugin | [`references/delete.md`](./references/delete.md) |

If the request spans more than one operation (for example "add Codex and rebuild"), load each
reference in turn as you reach that part of the work.

If the operation is unclear, ask which the user means rather than guessing.

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
