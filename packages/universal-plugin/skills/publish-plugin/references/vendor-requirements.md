# Vendor Requirements

## Claude Code

**Manifest path:** `.claude-plugin/plugin.json`
**Required fields:** `name`
**Hook casing:** PascalCase (`SessionStart`, `PreToolUse`, `PostToolUse`, `Stop`) — canonical form
**Schema:** https://json.schemastore.org/claude-code-plugin-manifest.json

## Cursor

**Manifest path:** `.cursor-plugin/plugin.json`
**Required fields:** `name`
**Hook casing:** camelCase (`sessionStart`, `preToolUse`, `postToolUse`) — derived by `plugin build`
**Schema:** https://raw.githubusercontent.com/cursor/plugins/main/schemas/plugin.schema.json

## Codex

**Manifest path:** `.codex-plugin/plugin.json`
**Required fields:** `name`, `version`, `description`
**Hook casing:** PascalCase (follows Claude Code convention)

## GitHub Copilot CLI

**Manifest path:** `plugin.json` (root of plugin directory)
**Required fields:** `name`
**Hook casing:** either — PascalCase selects its Claude-compatible payload format, so the canonical file serves it
**Notes:** Also searches `.plugin/plugin.json` as a fallback path

## Hook event name reference

Author the canonical name; `plugin build` derives Cursor's. Claude Code, Codex, and Copilot CLI read
the canonical name as authored.

| Canonical (Claude Code, Codex, Copilot CLI) | Cursor |
|---|---|
| `SessionStart` | `sessionStart` |
| `SessionEnd` | `sessionEnd` |
| `PreToolUse` | `preToolUse` |
| `PostToolUse` | `postToolUse` |
| `Stop` | `stop` |
