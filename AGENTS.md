# AGENTS.md

This file provides guidance to AI coding assistants when working with code in this repository.

## Skill Augmentations

When reading any `SKILL.md` file, check for augmentation files in the same directory and merge them in order:

1. `SKILL.md` — base skill (lowest precedence)
2. `SKILL.project.md` — project-level overrides (team-shared, checked into the consuming project)
3. `SKILL.local.md` — machine-local overrides (highest precedence, gitignored)

Later layers extend and override earlier ones. Both `SKILL.project.md` and `SKILL.local.md` are ignored during `skills add` installation.

## Project overview

`cyber-universal-agent-plugin` is a research and design project for a universal AI coding agent plugin — a single plugin bundle that works across Claude Code, Cursor, Codex, GitHub Copilot CLI, and other major runtimes.

The project is currently in the **research and design phase**. No plugin code or skills have been written yet. The primary artifact is `.research/` — structured research notes on plugin schema formats and the open-plugin-spec.

## Research structure

Research lives in `.research/<topic-slug>/` with four files per topic:

- `conclusion.md` — read this first; the current best answer
- `topic.md` — full investigation record with findings and source angles
- `evidence.md` — structured claims log with confidence and source URLs
- `changes.md` — dated update history

Current research topics:

| Topic | Slug | Summary |
| --- | --- | --- |
| Plugin schema survey | `plugin-schema` | What each major runtime implements for plugin manifests; which ones publish JSON Schema URLs |
| open-plugin-spec comparison | `open-plugin-spec-comparison` | Field-by-field diff of open-plugin-spec v1.0.0 against Claude Code, Cursor, Codex, Copilot CLI, Windsurf, Zed, Continue.dev, and Cline |

## Key research findings (summary)

- **No universal plugin manifest exists.** Each Tier 1 runtime (Claude Code, Cursor, Codex, Copilot CLI) uses a vendor-specific `plugin.json` path.
- **The real universal minimum is `skills/<name>/SKILL.md` + MCP servers.** Every active runtime supports these.
- **Hook event naming is the most concrete incompatibility:** Claude Code and Codex use PascalCase; Cursor and Copilot CLI use camelCase; Windsurf uses snake_case.
- **Only Claude Code and Cursor publish machine-readable JSON Schemas** at stable authoritative URLs.
- **open-plugin-spec v1.0.0** is the closest thing to a standard but no vendor confirms `.plugin/plugin.json` as a primary search path except Copilot CLI as a fallback.

See `.research/open-plugin-spec-comparison/conclusion.md` and `.research/plugin-schema/conclusion.md` for the full verdicts.
