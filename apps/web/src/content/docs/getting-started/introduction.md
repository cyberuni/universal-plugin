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

Build merges and strips. It does not rewrite the contents of the files a component path names.

- **Shared metadata and component paths** are copied from the canonical top level into each vendor manifest.
- **Vendor-specific fields** in `extensions["org.cyberuni.universal-plugin"].harnesses.<vendor>` are merged over that metadata, and the harness value wins on conflict.
- **Orchestration keys** never reach a vendor: `$schema`, `extensions`, `vendors`, `packagePath`, and `harnesses` are stripped.
- **Required fields** are enforced per target. Codex requires `version` and `description`, and the build fails before writing anything for any vendor when either is missing.
- **Skill invocation policy** is projected. A skill declaring `invocation-policy` gets the matching Claude Code frontmatter flag written into its `SKILL.md`, and Codex prompts are written for skills a user can invoke.

A `harnesses` entry for `copilot-cli` is the one merge that goes nowhere. That vendor reads the canonical manifest directly, and the canonical schema is closed, so the build warns instead of delivering the field.

### Not translated today

Hook event names diverge by case: PascalCase for Claude Code and Codex, camelCase for Cursor and Copilot CLI. The build copies the `hooks` path through as declared and does not rename events, so one hooks file cannot satisfy both casings. Environment variable references inside hook commands and MCP configs pass through unchanged for the same reason.

Translation is planned, and the design question is what to do with a handler type a target cannot run. See [issue #41](https://github.com/cyberuni/universal-plugin/issues/41).

## Driving it from an agent

You can run every command yourself. The package also ships skills that front them, so an agent can scaffold, diagnose, version, and remove a plugin without you naming the flags. See [Skills](../../skills/overview/).

## Generated files are build artifacts

The generated vendor manifests should be treated like compiled output — either gitignored (build on install) or committed (pre-built for distribution). The choice is yours; `universal-plugin` enforces neither.

## Configuring a repository, not publishing a plugin

`universal-plugin` builds a plugin you publish. It does not set up the agent configuration of the repository you work in.

For that, use [`buddy-agent-harness`](https://github.com/repobuddy/buddy-agent-harness). It initializes a repository's canonical `AGENTS.md` and `.agents/` tree, then links it to each harness that needs its own path. Read its documentation to learn how the harnesses differ and what a universal agent configuration looks like.
