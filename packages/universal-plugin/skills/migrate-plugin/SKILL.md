---
name: migrate-plugin
description: "Move a repository-root or sibling-workspace universal agent plugin into its npm package so the package distributes its manifest, vendor manifests, skills, and agents, and bundle the package's CLI with tsdown so it runs from an installed plugin directory with no node_modules. Use this skill when packaging an existing plugin for npm, relocating a top-level or plugins/<name> plugin into a package, fixing a package that omits plugin assets, or making a plugin's bundled CLI self-contained, even if the user says only 'ship this plugin through npm', 'move the plugin into the package', or 'the CLI can't find its dependencies when installed as a plugin.'"
---

# Migrate Universal Plugin to npm

## Scope

Move one existing universal plugin into its owning npm package. The plugin may
sit at the repository root or in its own workspace member such as
`plugins/<name>/`. The package becomes the plugin root and must contain every
runtime artifact it needs after installation — including a CLI that runs
without `node_modules`.

This skill does not create a plugin from scratch, publish a package, or move
project-local agent configuration unrelated to the plugin.

## 1. Inspect and plan

Identify the destination package directory and read its `package.json`.
Before changing manifest fields or component compatibility behavior, consult the
[Agent Plugins Specification](https://github.com/agentplugins/agent-plugins-spec)
and its versioned specification: it is the canonical reference for the current
standard. Keep an existing schema version pinned unless the user explicitly
requests a standards upgrade.
Inventory these plugin assets in the source root when they exist:

- `plugin.json`
- vendor manifest directories for Claude Code, Cursor, Codex, and Copilot CLI
- `.plugin/` (for example a `pins.json` that skills read at runtime)
- `skills/`, `agents/`, `commands/`, `hooks/`, `rules/`, `output-styles/`
- `.mcp.json`, `.lsp.json`, and plugin-owned `assets/`

Also inventory what exists only to host the plugin in its old place: a
workspace-member `package.json` (for example a private `@scope/<name>-plugin`),
and the `pnpm-workspace.yaml` or `workspaces` glob that includes it.

Leave project configuration in place unless it is required solely to maintain
the moved plugin. In particular, do not move `.agents/skills/`, plans, or a
marketplace catalog such as `.claude-plugin/marketplace.json`.

Before modifying files, report the exact source-to-destination mapping and any
destination collisions. A `readme.md` on both sides is the usual one: merge the
plugin readme into the package readme as its own section rather than
overwriting either. Ask for confirmation if a destination contains a different
file that would be overwritten.

## 2. Move the plugin root

Move each inventoried asset under the package directory with `git mv`,
preserving its relative path, so history follows the files:

```text
the canonical manifest
vendor manifests
.plugin/
skills
agents
```

The source root must no longer retain duplicate distributable plugin assets.
When the source was its own workspace member, delete its `package.json`, drop
the now-empty workspace glob, and reinstall so the lockfile loses the member.
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
    ".plugin",
    "skills",
    "agents"
  ]
}
```

Retain existing package entries such as `bin`, `dist`, and `governances`.
Never replace the allowlist wholesale.

## 4. Bundle the CLI with tsdown

An installed agent plugin is a copy of a source checkout, not an npm install,
so its directory has no reliable `node_modules`. A CLI whose build leaves
dependencies external fails there. When the package ships a CLI, build it so
every runtime dependency is inlined into the CLI entry, while any library entry
keeps its dependencies external.

Split `tsdown.config.ts` into two configs that share an `outDir`:

```ts
import { defineConfig } from 'tsdown'

// Two configs, because the entries want opposite dependency treatment. They share an
// `outDir`, which is safe: tsdown hoists `clean` and runs it once across every config
// before any build writes, so neither wipes the other.
const shared = {
	outDir: 'dist',
	format: 'esm',
	platform: 'node',
	clean: true,
} as const

export default defineConfig([
	{
		// Library entry. Dependencies stay EXTERNAL: their types surface in the public
		// `.d.ts`, and a consumer that also uses them must share one copy.
		...shared,
		entry: { index: 'src/index.ts' },
		dts: true,
	},
	{
		// CLI entry. Every runtime dependency is inlined so it runs with no node_modules.
		...shared,
		entry: { cli: 'src/cli.ts' },
		dts: false,
		deps: {
			alwaysBundle: [/^commander(\/|$)/, /^some-dep(\/|$)/],
			onlyBundle: false,
		},
	},
])
```

Rules for the CLI config:

- **`alwaysBundle` lists exactly the package's own `dependencies`.** Those are
  the only ones tsdown externalizes by default; their transitive dependencies
  are inlined automatically. Use `^name(\/|$)` regexes so subpath imports
  (`some-dep/worktree`) are caught too.
- **Omit a dependency consumed only through `import type`.** TypeScript strips
  it before bundling, and a package whose entry is raw `.ts` cannot be bundled.
- **`onlyBundle: false`** silences the "bundled a dependency" warnings that are
  the point of this config.
- **Keep the existing output extensions.** If `bin` and `exports` already name
  `.mjs`, leave tsdown's default; if they name `.js`, add
  `outExtensions: () => ({ js: '.js' })` to `shared`. Never move published
  paths as a side effect.
- **Keep the entry's invocation contract.** When `bin` points straight at the
  CLI output, `src/cli.ts` must keep its `#!/usr/bin/env node` shebang (tsdown
  preserves it and sets the execute bit). When `bin` is a wrapper that imports
  the output and calls an exported function, leave the wrapper as is.
- **Resolve runtime files relative to the output.** A CLI that reads
  `../package.json` through `import.meta.url` still works only if `src/` and
  `dist/` sit at the same depth and `package.json` ships — confirm both.

Verify the bundle, not just the build:

1. `grep -En "from ['\"](dep-a|dep-b)" dist/cli.*` prints nothing, while the
   library output still imports them.
2. Pack into a scratch directory, extract, confirm the extracted `package/` has
   no `node_modules`, then run the CLI through its `bin` path: `--version` and
   one read-only command. Do not run it from the workspace, where hoisted
   `node_modules` hides a missing inline.

Skills that invoke the CLI through `npx <cli>@<version>` can then prefer the
shipped CLI. That changes skill behavior and often a frozen spec, so offer it
as a follow-up instead of doing it inside this migration.

## 5. Preserve release synchronization

Point every version and build step at the new plugin root:

- Set the manifest extension's `packagePath` to `"."`.
- `universal-plugin publish sync-version --root <pkg>` reads `packagePath` from
  `<pkg>/.agents/universal-plugin.json`, not from the manifest extension. With
  no `packagePath` it reads `<pkg>/package.json`, so a package that holds its
  own plugin needs no config file for it. If the repository instead runs its
  own sync script, repoint that script's manifest path and leave it.
- Change every `universal-plugin plugin build --root <old>` in `package.json`
  scripts to the package directory, then run it and confirm it reports the
  vendor manifests as built and the catalog as unchanged or refolded.
- Repoint a local-directory `source` in the repository's marketplace catalog to
  the package directory.

Update any checked-in skill lockfile that records an absolute source path for a
moved skill. Do not modify unrelated agent configuration.

## 6. Repoint tooling and prose

Search the repository for the old plugin path and update live references:

- lint and format excludes for generated vendor manifests (for example
  `biome.json` `files.includes` negations), knip workspaces, turbo filters
- `AGENTS.md`, `CONTRIBUTING.md`, readmes, docs pages, and spec frontmatter
  such as `project-path`
- guards scoped to the package directory, such as a vocabulary or lint check —
  confirm moved skills did not enter a scope that rejects their wording

Leave historical records as written: changelogs, ADRs, research notes, and
decision or gate ledgers describe the layout at the time.

## 7. Verify the result

1. Run the repository's full verification (lint, build, typecheck, test).
2. Run `npm pack --dry-run` from the destination package. Confirm it lists
   `plugin.json`, every required vendor manifest, `.plugin/` when present,
   `skills/`, `agents/`, and the bundled CLI.
3. Confirm step 4's no-`node_modules` run passed.
4. Search the repository again for stale references to the old asset paths.
5. Review the diff to confirm no project-local `.agents` content or marketplace
   catalog was moved into the package.
6. Add a changeset for the package when the repository uses changesets.

Commit the move and the CLI bundling as separate commits: each is revertable on
its own.

Report the package path, files added to the npm tarball, checks run, and any
intentionally retained root-local files.
