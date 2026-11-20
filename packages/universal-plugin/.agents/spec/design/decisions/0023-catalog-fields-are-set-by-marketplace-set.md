# 0023 — A catalog's own fields are edited by `marketplace set`

**Status:** accepted
**Date:** 2026-11-19
**Builds on:** [0018](./0018-build-checks-dependencies-against-catalogs.md) — the dependency check
whose repair asks for a marketplace in `allowCrossMarketplaceDependenciesOn`.

## Context

[Issue #292](https://github.com/cyberuni/universal-plugin/issues/292). A catalog states some fields
about itself rather than about one entry: `allowCrossMarketplaceDependenciesOn`, the owner, and the
description. No command edited them. The only CLI route was `marketplace init --force`, which
regenerates the catalog and drops what a curator wrote by hand. Doctor's repair for a
cross-marketplace dependency named the allowlist and no command that writes it.

The issue offered two shapes and asked the design to pick one: a catalog mode on `update`
(`marketplace update --catalog --allow-dependencies-on <marketplace>`), or a new `marketplace set`.

## Decision

### 1. A new command, `marketplace set`, edits the catalog's top level

`update <name>` edits one entry, named by a required argument. A catalog mode would make that
argument optional, and several of its flags would change meaning with the mode: `--description` is
the entry's description in one and the catalog's in the other. `set` takes no entry name, and every
flag it takes names a catalog field.

### 2. Each runtime gets only the fields its catalog carries

The allowlist goes to the Claude catalog only: Claude Code is the one runtime that resolves plugin
dependencies ([0013](./0013-plugin-dependencies.md)). The owner and the description go to every
Claude-shaped catalog (Claude, Copilot CLI, Cursor). Codex's catalog states neither, so it is skipped.

### 3. The allowlist is edited by name, not replaced

`--allow-dependencies-on` appends a name once and `--disallow-dependencies-on` removes one, so adding
a marketplace does not require restating the ones already allowed. An emptied list is removed.

### 4. The dependency check's repair names the command

The issue the check reports for a disallowed marketplace now ends with
`universal-plugin marketplace set --allow-dependencies-on <marketplace>`.

### 5. `init --force` names what it drops, and does not merge

`init --force` still regenerates. It now warns about each field and entry the existing catalog has
and the new one does not. Merging hand-set fields into a regeneration would change what `--force`
means, and `set` and `update` now restore any field it drops.

## Consequences

- An entry is removed by its own command, `marketplace remove`, the inverse of `add`, so the
  `marketplace` group edits entries with `add`, `update`, and `remove`, and the catalog with `set`.
- Offering the allowlist automatically when `plugin build` or `marketplace add` sees a qualified
  dependency (the issue's optional item 3) is not done here. The check's repair names the command
  instead.
