# universal-plugin

[![release](https://github.com/cyberuni/universal-plugin/actions/workflows/release.yml/badge.svg)](https://github.com/cyberuni/universal-plugin/actions/workflows/release.yml)
[![CodeQL](https://github.com/cyberuni/universal-plugin/actions/workflows/codeql.yml/badge.svg)](https://github.com/cyberuni/universal-plugin/actions/workflows/codeql.yml)
[![npm version](https://img.shields.io/npm/v/universal-plugin.svg)](https://www.npmjs.com/package/universal-plugin)
[![node](https://img.shields.io/node/v/universal-plugin.svg)](https://www.npmjs.com/package/universal-plugin)
![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)

Write one plugin manifest. Generate the vendor manifests that Claude Code, Cursor, Codex, and GitHub Copilot CLI each expect.

```sh
npx universal-plugin plugin build
```

## What ships today

The CLI generates vendor manifests from a canonical `plugin.json`, scaffolds new plugins, moves a
version across every file that carries one, and syncs an installed plugin between runtimes. See the
[package readme](packages/universal-plugin/readme.md) for the full command list.

Cross-vendor *installation* is not solved, and no vendor has agreed on a shared manifest path. The
build generates each vendor's file instead of waiting for a standard. Read `.research/` for why.

## What ships elsewhere

This CLI covers the publishing side: you author a plugin, and it derives the manifests each runtime
reads. The consuming side is a separate tool.

[`buddy-agent-harness`](https://github.com/repobuddy/buddy-agent-harness) sets up a repository's own
agent configuration, so its `AGENTS.md`, skills, and tool settings work across the harnesses your
team uses. Read it to learn how agent harnesses differ and what a universal agent configuration
looks like on the consuming end. The split is recorded in
[ADR-0006](packages/universal-plugin/.agents/spec/design/decisions/0006-narrow-init-setup-to-the-publish-half.md).

## Layout

| Path | Contents |
| --- | --- |
| `packages/universal-plugin` | The published CLI and its skills |
| `.research/` | Vendor findings, each claim recorded with a source URL |
| `.agents/spec/` | The behavior specification the CLI is built against |
| `apps/web` | The documentation site |
| `examples/` | Manifest examples per runtime |

## The problem

Every major AI coding agent runtime reads its plugin manifest from a different path:

| Runtime | Manifest path | Required fields |
| --- | --- | --- |
| Claude Code | `.claude-plugin/plugin.json` | `name` |
| Cursor | `.cursor-plugin/plugin.json` | `name` |
| Codex | `.codex-plugin/plugin.json` | `name`, `version`, `description` |
| GitHub Copilot CLI | `plugin.json` in plugin root | `name` |

No single file serves all four as its primary configuration. Hook event naming is not standardized:
Claude Code and Codex use PascalCase, Cursor and Copilot CLI use camelCase, Windsurf uses
snake_case. Env var names differ per vendor too.

## The real universal minimum

Two things work everywhere, despite the manifest fragmentation:

1. **`skills/<name>/SKILL.md`.** Every Tier 1 runtime reads this path.
2. **MCP servers** (`.mcp.json` / `mcpServers`). Every active runtime supports MCP integration.

So a working strategy generates the four vendor manifests from one source of truth at build time. It
does not rely on a shared path.

## open-plugin-spec

[open-plugin-spec](https://github.com/vercel-labs/open-plugin-spec) v1.0.0 is the closest thing to a
cross-vendor standard. Its metadata fields (`name`, `version`, `description`, `author`, `homepage`,
`repository`, `license`) and core component names (`commands`, `agents`, `hooks`, `mcpServers`)
match what Claude Code and Cursor implement.

Vendor reality contradicts three of its central premises:

- **`.plugin/plugin.json` as a shared path.** Only Copilot CLI confirms searching it. Every other
  runtime uses a vendor-specific path.
- **PascalCase hook events as the standard.** Cursor and Copilot CLI use camelCase. Windsurf uses
  snake_case.
- **`${PLUGIN_ROOT}` and `${PLUGIN_DATA}` env vars.** Only Codex matches these exactly. Claude Code
  uses vendor-prefixed names.

Alignment ranges from roughly 70% for Claude Code down to roughly 5% for Cline. See
[`.research/open-plugin-spec-comparison/conclusion.md`](.research/open-plugin-spec-comparison/conclusion.md)
for the field-by-field analysis.

## Research

Findings are dated June 2026. Each topic holds four files: `conclusion.md` (the current best
answer), `topic.md` (the full investigation), `evidence.md` (claims with source URLs and
confidence), and `changes.md` (update history).

Read `conclusion.md` first.

| Topic | Question it answers |
| --- | --- |
| [`plugin-schema`](.research/plugin-schema/conclusion.md) | What each runtime implements for manifests, and which publish machine-readable schemas |
| [`open-plugin-spec-comparison`](.research/open-plugin-spec-comparison/conclusion.md) | Where open-plugin-spec v1.0.0 diverges from what runtimes actually implement |
| [`hook-event-survey`](.research/hook-event-survey/conclusion.md) | Which hook events each runtime supports, and how it cases their names |
| [`plugin-consumption-leveling`](.research/plugin-consumption-leveling/conclusion.md) | Whether a plugin installed through one vendor can be reached from the others |
| [`prepare-skill-design`](.research/prepare-skill-design/conclusion.md) | How to sync an installed plugin across runtimes without npm in the user project |
| [`skill-description-guidelines`](.research/skill-description-guidelines/conclusion.md) | What a skill description must contain for a runtime to trigger it |

## License

MIT
