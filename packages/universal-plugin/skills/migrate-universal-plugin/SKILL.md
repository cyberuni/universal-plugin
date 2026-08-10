---
name: migrate-universal-plugin
description: "Move a repository-root universal agent plugin into its npm package so the package distributes its manifest, vendor manifests, skills, and agents. Use this skill when packaging an existing plugin for npm, relocating a top-level plugin into a package, or fixing a package that omits plugin assets, even if the user says only 'ship this plugin through npm' or 'move the plugin into the package.'"
---

# Migrate Universal Plugin to npm

## Scope

Move one existing universal plugin from a repository root into its owning npm
package. The package becomes the plugin root and must contain every runtime
artifact it needs after installation.

This skill does not create a plugin from scratch, publish a package, or move
project-local agent configuration unrelated to the plugin.

## 1. Inspect and plan

Identify the destination package directory and read its `package.json`.
Before changing manifest fields or component compatibility behavior, consult the
[Agent Plugins Specification](https://github.com/agentplugins/agent-plugins-spec)
and its versioned specification: it is the canonical reference for the current
standard. Keep an existing schema version pinned unless the user explicitly
requests a standards upgrade.
Inventory these root-level plugin assets when they exist:

- `plugin.json`
- vendor manifest directories for Claude Code, Cursor, Codex, and Copilot CLI
- `skills/`, `agents/`, `commands/`, `hooks/`, `rules/`, `output-styles/`
- `.mcp.json`, `.lsp.json`, and plugin-owned `assets/`

Leave project configuration in place unless it is required solely to maintain
the moved plugin. In particular, do not move `.agents/skills/`, plans, or a
marketplace catalog such as `.claude/marketplace.json`.

Before modifying files, report the exact source-to-destination mapping and any
destination collisions. Ask for confirmation if a destination contains a
different file that would be overwritten.

## 2. Move the plugin root

Move each inventoried asset under the package directory, preserving its path.
A package receives these relative paths:

```text
the canonical manifest
vendor manifests
skills
agents
```

The source root must no longer retain duplicate distributable plugin assets.
Do not move a project-local skill merely because it is under `.agents/skills/`.

## 3. Configure npm packaging

Add every moved plugin artifact to the destination package's `package.json`
`files` allowlist. At minimum, include the canonical manifest, each present
vendor manifest directory, and every present component directory. A typical
configuration is:

```json
{
  "files": [
    "bin",
    "dist",
    "plugin.json",
    ".claude-plugin",
    ".cursor-plugin",
    ".codex-plugin",
    "skills",
    "agents"
  ]
}
```

Retain existing package entries such as `bin`, `dist`, and `governances`.
Never replace the allowlist wholesale.

## 4. Preserve release synchronization

If the repository runs `universal-plugin publish sync-version`, move its
plugin-specific configuration beside the new `plugin.json` and change
`packagePath` to `"."`. Update the root release script to run the command from
the destination package, for example:

```sh
pnpm exec universal-plugin publish sync-version --root .
```

Update any checked-in skill lockfile that records an absolute source path for a
moved skill. Do not modify unrelated agent configuration.

## 5. Verify the result

1. Run the package's focused tests and typecheck/lint commands.
2. Run `npm pack --dry-run` from the destination package. Confirm it lists
   `plugin.json`, every required vendor manifest, `skills/`, and `agents/`.
3. If the manifest declares build targets, run `universal-plugin plugin build`
   from the destination package and confirm generated paths stay inside it.
4. Search the repository for stale references to the old top-level asset paths.
5. Review the diff to confirm no project-local `.agents` content or marketplace
   catalog was included in the package.

Report the package path, files added to the npm tarball, checks run, and any
intentionally retained root-local files.
