# 0012 — `plugin install`: the local-development install, and where the destination lives

**Status:** accepted
**Date:** 2026-08-18
**Builds on:** [0007](./0007-adopt-agent-plugins-spec-canonical.md) — the canonical manifest owns the
vendor target set, which this command reads rather than re-declares.

## Context

Until now the only way to get a plugin under development into a runtime was a hand-written symlink,
one per vendor, copy-pasted into each plugin repository's readme:

```bash
ln -sf "$(pwd)" ~/.claude/plugins/local/<name>   # Claude Code
ln -sf "$(pwd)" ~/.cursor/plugins/local/<name>   # Cursor → Developer: Reload Window
```

Re-verifying that block against the shipped runtimes found both halves wrong
(`.research/local-marketplaces/`). `~/.claude/plugins/local/` does not exist in Claude Code and the
string appears nowhere in its executable; the directory that works is the **skills** directory,
`~/.claude/skills/<dir>`, which Claude Code adopts as a plugin and loads as `<name>@skills-dir`.
Cursor's `~/.cursor/plugins/local/` is real, but its scan resolves each symlink and refuses a target
outside that directory, so the symlink form loads nothing there. Codex and Copilot CLI scan no local
directory at all — for them local development runs through a repository-local marketplace.

An author following those two lines got silence from both runtimes and no way to tell why. That is
the failure mode a hardcoded vendor path always has: it is wrong somewhere, in a document nobody
re-verifies, and the plugin simply does not load.

## Decision

### 1. `plugin install` installs the working copy; it does not install from a registry

`universal-plugin plugin install` puts **this** plugin — the one in the current root — into the
runtimes its own manifest declares. It resolves nothing by name, reads no catalog, and downloads
nothing. `plugin uninstall` reverses it.

That is a narrower verb than the `plugin install` that moved to `cyberplace`, and the two do not
overlap: a marketplace or registry install stays the runtime's own job (`/plugin marketplace add`,
`codex plugin add`, `copilot plugin install`). The name sits in the `plugin` group because the group
is the canonical manifest's engine, and the manifest is exactly what decides where this plugin goes.

### 2. The destination is a vendor fact, and lives in the vendor registry

Three facts per vendor move into `src/vendor-registry/data/vendors.json`:

| Field | Meaning |
| --- | --- |
| `localPluginDir` | The directory the runtime scans for locally developed plugins, or `null` when it has none |
| `localPluginLink` | Whether that scan follows a symlink whose target sits outside the directory |
| `localReload` | What the author has to do for the runtime to see the change |

The registry already holds every other vendor path this tool knows, and it already merges a user
override from `~/.agents/universal-plugin-vendors.json`. So a vendor moving its directory is one
line here rather than a stale command in every downstream readme, and an author whose configuration
directory is not in the default place fixes it locally without waiting for a release.

### 3. The install mode resolves per vendor, and is never silently downgraded

`--link` and `--copy` name the two forms. The default is **neither**: it links where the vendor
follows an out-of-tree symlink and copies where it does not, and the result row reports the mode each
vendor actually got.

A single default cannot serve both runtimes — Claude Code follows the symlink and Cursor rejects it —
and the two forms are not interchangeable. A link is live: the next edit is already installed. A copy
is a snapshot, which is what an author wants when testing what a consumer receives, and the only form
Cursor accepts. Choosing per vendor is therefore the only default that works everywhere.

Explicit `--link` against a vendor that rejects one is **blocked**, not quietly copied. An author who
asked for a live link and got a snapshot would edit files for an hour before noticing.

### 4. A destination is replaced only when this plugin owns it

An install owns a destination when it is a symlink resolving to this plugin root, or a directory
whose `plugin.json` carries this plugin's name. Re-running over what we own replaces it, so installs
never stack; anything else is refused until `--force`, which never silently deletes another author's
work. `uninstall` applies the same test before removing, and reports an absent destination rather
than failing, so it is safe to run twice.

### 5. A missing derived manifest fails the run

`install` requires each targeted vendor's derived manifest to exist and points at `plugin build` when
one does not. Installing a plugin whose manifests were never built hands the runtime a half-built
plugin, and the author meets the problem as a load failure with no message rather than as an error
with one. `install` does not run `build` itself: a command that writes to the repository as a side
effect of installing out of it is harder to reason about than one that refuses.

### 6. This is not a `doctor` check

`doctor` reports on the repository. Whether a plugin is currently installed into a runtime is
machine-local, per-user, and expected to be false on any machine that is not the author's — a check
for it would fail in CI and on every contributor's clone. `install --list` answers the question for
whoever is actually asking it.

## Consequences

- Local installs are user-scoped. A project-scoped install (Claude Code's `.claude/skills/`, which it
  also adopts) is not offered; it can be added as a `--scope` flag without changing anything decided
  here.
- A copy carries the working tree minus `.git` and `node_modules`, and dereferences symlinks so a
  linked-in skill travels as content. It is not an `npm pack`: `package.json` `files` is not
  consulted, so a copy can contain more than a published tarball would.
- Codex and Copilot CLI report as `unsupported` rather than failing. They are declared targets of the
  plugin; they simply have no local directory, and their route is the local marketplace.
- The vendor facts in §2 decay like every other vendor fact in this repository. Their evidence and
  confidence are recorded in `.research/local-marketplaces/evidence.md`, and the Cursor rows are the
  weakest of the set — read from the shipped bundle rather than run.

## References

- `.research/local-marketplaces/` — the verification behind §2's table, including what the previously
  published symlink recipe actually did (E-CC-M6, E-CC-M7, E-CUR-M3, E-CUR-M4, E-CODEX-M12).
- ADR-0007 — the canonical manifest and its `vendors ?? harnesses`-keys target selection, which
  `install` reuses unchanged rather than introducing a second notion of "the vendors of this plugin".
