# 0019 — `plugin build` compiles skill script entries into committed, self-contained `.mjs`

**Status:** accepted
**Date:** 2026-10-11
**Builds on:** [0010](./0010-version-policy.md) — the canonical `plugin.json` carries the version a
derived file copies. [0017](./0017-retire-governance-for-reference.md) — a committed file inside a
skill is ordinary skill content.
**Upstream:** [issue #177](https://github.com/cyberuni/universal-plugin/issues/177), and
[#179](https://github.com/cyberuni/universal-plugin/issues/179) for the version seam.

## Context

pnpm 12.11 links the agent skills of a project's direct dependencies into the agent's skill
directory, as `.claude/skills/pnpm-<pkg>-<skill>` ([docs](https://pnpm.io/agent-skills)). It links
each skill folder on its own, and falls back to a junction or a copy. A plugin cache likewise keeps
only what the plugin ships.

A skill script that climbs four levels from `import.meta.url` to reach its package's CLI works
through a symlink, because Node resolves the main module to its real path. In a copy, the climb lands
in `.claude/`, and the script finds nothing. A TypeScript entry is no answer either: Node refuses to
strip types under `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`).

So a script a skill runs has to be one file that reaches back into nothing.

## Decision

1. **Entries are declared in the extension.** `extensions["org.cyberuni.universal-plugin"].scripts`
   maps an output path to a source, both relative to the plugin root:
   `"skills/doctor/scripts/doctor.mjs": "src/skills/doctor.ts"`, or `{ "source", "command" }` when the
   entry runs a CLI command. The source, its tests and its stories stay in the package; the skill gets
   only the built file. The declaration never reaches a derived manifest.
2. **Every entry compiles to one `.mjs` with rolldown.** Node built-ins stay imports; every other
   import is inlined. An entry that inlines only its own files keeps readable output, which is in
   effect a type strip. One that inlines a dependency is minified. An import that cannot be inlined
   fails that entry and exits 1: a script that still imports a package is the failure this exists to
   prevent. The word is "compile", because "bundle" names version pinning (#179).
3. **The output is committed,** like the derived vendor manifests, so a git-sourced install carries
   it. This reverses the aside in [0016](./0016-build-copies-governances-into-skills.md) §4 that kept
   script bundles out of git. `plugin build --dry-run` reports each committed file as `unchanged`,
   `missing`, `stale` (its source, its imports, or the command map moved on) or `version` (only the
   embedded version differs). `doctor` reports `missing` and `stale` as `stale-script`.
4. **A size budget of 150 KB.** Above it the build warns: the skill should call the installed CLI
   instead, through `pnpm exec <bin>` (pnpm links only direct dependencies, so the CLI is there) with a
   pinned `npx` fallback. The measurements in #177 put a full CLI at 280 KB to 1.3 MB minified, and a
   single command at 12 to 100 KB.
5. **A link that leaves the skill folder is a warning.** A relative Markdown link in a skill that
   climbs out of it resolves to nothing in a linked or copied skill. Copy the file into the skill, or
   link it by URL.
6. **Each compiled file embeds its script data.** A header names the source and assigns
   `globalThis.__SKILL_SCRIPT__ = { package, bin, version, entry, commands }`: the npm package and bin
   that ship the plugin (from the `packagePath` `package.json`), the plugin version, the file's own
   path, and a map from every declared command path to its entry. A library the entry inlines, such
   as clibuilder's `run()` ([clibuilder#688](https://github.com/clibuilder/clibuilder/issues/688)),
   renders a reference to another command from it: a sibling script as `node <real path>`, else
   `pnpm exec <bin>`, else `npx <package>@<version>`. The build is the only step that knows every
   entry. universal-plugin depends on no such library.
7. **The version comes from `plugin.json`, never `package.json`.** The build never decides a version
   (#179). `plugin version` is the stamp: it writes the new version into each compiled script's
   header, and nothing else in the file, in the same run that stamps `plugin.json`. The pin stamp
   skips compiled scripts, because a pin their inlined code carries came from the source; rewriting it
   would leave the script behind its source.
8. **Drift and staleness never name the same file.** `publish check-version` reads the embedded
   version of a compiled script as a `compiled-script` surface, and skips the `npx` pins its inlined
   code may carry. The build's `stale` excludes a difference in the version alone. A script behind on
   its version is `version-drift`; a script behind its source is `stale-script`.
9. **universal-plugin's own skill scripts are compiled entries too** ([#182](https://github.com/cyberuni/universal-plugin/issues/182)).
   Their sources live in `src/skill-scripts/`. The scripts that stand alone (`doctor`, `rewrite-upx`,
   `install-docs`) compile in full. The six that run a CLI command (`plugin build`, `plugin init`,
   `plugin version`, `marketplace add`, `marketplace init`, `marketplace validate`) share one entry,
   `run-cli`, declared once per command: the full CLI is over the budget, so the compiled file looks up
   its command in the embedded map and calls the installed CLI (`pnpm exec <bin>`), else the `npx`
   fallback pinned to the embedded version. Neither looks beside itself for the package.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Keep the four-levels-up launcher | It fails in a copied skill, which pnpm's fallback and some plugin caches make |
| Ship `.mts` and let Node strip types | Node refuses to strip types under `node_modules` |
| Build the scripts at publish time only | A git-sourced install never runs the publish step and would get no script |
| Name the step `bundle` | `plugin bundle` already means version pinning |
| Read the version from `package.json` | Under semantic-release it holds `0.0.0-development` until publish; the build would decide a version |
