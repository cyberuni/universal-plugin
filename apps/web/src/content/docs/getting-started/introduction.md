---
title: Introduction
description: What universal-plugin is and why it exists.
---

**universal-plugin** is a build tool for universal AI agent plugins. You write one canonical definition in root `plugin.json`, and `universal-plugin plugin build` generates a spec-conformant vendor manifest for each runtime you target.

## The problem

Every major AI coding agent runtime — Claude Code, Cursor, Codex, GitHub Copilot CLI — uses its own `plugin.json` format at a vendor-specific path. Targeting multiple runtimes means maintaining multiple manifest files that share ~60% of their content, hand-writing vendor-specific transformations (hook event casing, env var names, component fields), and re-syncing on every change.

## The solution

A single source of truth in root `plugin.json`, following the closed [Agent Plugins Specification v1.0.0](https://agent-plugins.org) field set (`$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `extensions`). All `universal-plugin` build config — component paths, the vendor target list, and per-harness overrides — nests under `extensions["org.cyberuni.universal-plugin"]`. Running `universal-plugin plugin build` produces each vendor's manifest as a build artifact.

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "my-plugin",
  "extensions": {
    "org.cyberuni.universal-plugin": {
      "vendors": ["claude-code", "cursor", "codex", "copilot-cli"],
      "skills": "./skills/",
      "mcpServers": "./mcp.json",
      "hooks": "./hooks/hooks.json",
      "harnesses": {
        "claude-code": { "monitors": "./monitors/monitors.json" },
        "cursor": { "publisher": "my-org", "logo": "./assets/logo.png" },
        "codex": { "version": "1.0.0", "description": "My plugin." },
        "copilot-cli": {}
      }
    }
  }
}
```

Running `universal-plugin plugin build` from the plugin root generates:

| Vendor | Output |
|---|---|
| `claude-code` | `.claude-plugin/plugin.json` |
| `cursor` | `.cursor-plugin/plugin.json` |
| `codex` | `.codex-plugin/plugin.json` |
| `copilot-cli` | `plugin.json` |

## What gets transformed

Build merges and strips. Apart from the hooks file, it does not rewrite the contents of the files a component path names.

- **Shared metadata and component paths** are copied from the canonical top level into each vendor manifest.
- **Vendor-specific fields** in `extensions["org.cyberuni.universal-plugin"].harnesses.<vendor>` are merged over that metadata, and the harness value wins on conflict.
- **Orchestration keys** never reach a vendor: `$schema`, `extensions`, `vendors`, and `harnesses` are stripped.
- **Required fields** are enforced per target. Codex requires `version` and `description`, and the build fails before writing anything for any vendor when either is missing.
- **Hooks** are derived per vendor from one canonical hooks file with PascalCase event names. Claude Code, Codex, and Copilot CLI read PascalCase; Cursor gets camelCase event names and its own flat file shape. A handler type a vendor cannot run is dropped from that vendor's file, and the build warns for each one. A vendor whose form differs from the canonical file gets its own `hooks.json` beside its manifest, and Copilot CLI reads its copy from `com.github.copilot/hooks/hooks.json`.
- **Skill invocation policy** is projected. A skill declaring `invocation-policy` gets the matching Claude Code frontmatter flag written into its `SKILL.md`. Codex invokes skills natively, so it needs nothing extra, and the build writes nothing outside the plugin tree.

- **Plugin dependencies** declared under `extensions["org.cyberuni.universal-plugin"].dependencies` reach Claude Code, the only runtime that reads one. Every other vendor's manifest is built without them, and the build says which ones it dropped. See [build](../../cli/build/#plugin-dependencies).

A `harnesses` entry for `copilot-cli` is the one merge that goes nowhere. That vendor reads the canonical manifest directly, and the canonical schema is closed, so the build warns instead of delivering the field.

### Not translated today

Environment variable references inside hook commands and MCP configs pass through unchanged. The build renames hook events, but it does not rewrite the commands a handler runs.

## Driving it from an agent

You can run every command yourself. The package also ships skills that front them, so an agent can scaffold, diagnose, version, and remove a plugin without you naming the flags. See [Skills](../../skills/overview/).

## Generated files are build artifacts

The generated vendor manifests should be treated like compiled output — either gitignored (build on install) or committed (pre-built for distribution). The choice is yours; `universal-plugin` enforces neither.

## Configuring a repository, not publishing a plugin

`universal-plugin` builds a plugin you publish. It does not set up the agent configuration of the repository you work in.

For that, use [`buddy-agent-harness`](https://github.com/repobuddy/buddy-agent-harness). It initializes a repository's canonical `AGENTS.md` and `.agents/` tree, then links it to each harness that needs its own path. Read its documentation to learn how the harnesses differ and what a universal agent configuration looks like.
