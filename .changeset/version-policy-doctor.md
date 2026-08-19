---
'universal-plugin': minor
---

Record the version policy as ADR-0010, and give `doctor` the check it obliges.

The canonical `plugin.json` owns a plugin's version; every other version-carrying artifact — the per-vendor manifests, the repository-local marketplace catalogs, the `npx`/`upx` pins in `skills/**` — derives from it and is never authored by hand. Who picks the next value splits on `packagePath`: without one the author picks, through `plugin version <bump>`; with one the release picks, and `publish sync-version` carries the number from `package.json` into the manifest.

A marketplace entry's version is copied from the canonical manifest of the plugin its `source` resolves to. Where a runtime lets both the entry and the manifest carry one, the manifest wins — Claude Code documents that it overrides the entry silently — so a generated entry is never the number that decides anything, and never a number a human edits.

`doctor` gains `unreleased-content`. A runtime keys its plugin cache on the version, so content committed after the commit that set the current one never reaches a consumer who already installed the plugin, and neither side is told: the author sees a successful push, the consumer sees "already at the latest version". The check compares the shipped paths against that commit. It stays quiet on uncommitted work, in a repository with a `.changeset/` directory — there the release moves the number — and on a tree with no git history.
