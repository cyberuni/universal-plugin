# 0014 — `plugin build` refreshes the repository-local catalogs it finds

**Status:** accepted
**Date:** 2026-08-18
**Builds on:** [0010](./0010-version-policy.md) — its §1 table of derived artifacts, which named the
command that *writes* each catalog but not the command that keeps one true.

## Context

[0010](./0010-version-policy.md) §3 settled that a marketplace entry's version is copied from the
canonical manifest of the plugin its `source` resolves to, and never authored. Both generators obey
it at the moment they write: `marketplace init` derives every entry it emits, and `plugin init
--vendor` folds one derived entry into whatever the repository already carries.

Neither runs again. The version moves through `plugin version` or through
`changeset version → publish sync-version`, and both then call `plugin build` to re-derive the vendor
manifests — a step that never touched the catalogs. So the entry kept the version it was written
with while the plugin moved on, and nothing reported the divergence.

What that costs depends on the runtime, and Codex is the case that prompted this. Codex installs a
local plugin by **copying** it to `plugins/cache/<marketplace>/<plugin>/<version>`, reading that
version from the plugin's own manifest and ignoring the catalog entry's
(`.research/local-marketplaces`, E-CODEX-M13, E-CODEX-M15). A stale entry therefore installs happily
and states a version the installed plugin does not have — the catalog is wrong in the one place a
reader would trust it.

## Decision

`plugin build` re-derives this plugin's entry in every repository-local marketplace catalog the
repository **already carries**, for the vendors that build is building.

Three boundaries make that safe to run on every build:

1. **Refresh, never create.** A catalog the repository does not carry is not written. Deciding to
   carry one is an authoring choice, and it stays with `plugin init --vendor` and `marketplace init`.
   A build makes no new files at the repository root.
2. **One entry.** The catalog's own name, owner, description, and every other plugin's entry are left
   exactly as they are, including hand-written fields on this plugin's entry that the derivation does
   not name. This is the same fold `plugin init` performs, through the same
   `mergeCatalogEntry` derivation point.
3. **The vendors being built.** `--vendor codex` refreshes the Codex catalog and leaves the others
   untouched, so the flag means the same thing for catalogs as it does for manifests. `--dry-run`
   reports the refresh as planned and writes nothing.

§1 of [0010](./0010-version-policy.md) gains no new row: `marketplace init` and `plugin init` still
own writing a catalog. What is added is who keeps one current, and the answer is the command that is
already re-deriving everything else the manifest feeds.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Leave it to `marketplace init --force` | It exists and it works, but it is a second command an author has to remember after every version move, and forgetting it is silent. The failure this decision removes is the one nobody notices. |
| Have `plugin version` call the catalog writer directly | It would fix the author-picks release model and miss the changesets one, where `publish sync-version` moves the number and `plugin build` is the only step that follows. Putting the refresh in `build` covers both, because both end there. |
| Let `build` create the catalogs too | A build would then write files at the repository root that the author never asked for, in a repository that may deliberately carry no catalog. Creation is a choice; keeping a chosen file true is not. |
| Add a `--no-catalog` opt-out | Nothing to opt out of: the refresh only touches a file the repository already carries, and only re-derives what ADR-0010 §3 already says is derived. `--dry-run` covers looking before writing. |
| Detect the drift in `doctor` instead of repairing it | `doctor` is the right home for drift nobody can repair automatically. This one is a pure re-derivation with a known correct answer, so reporting it would be asking the author to run a command the build could have run. |

## Consequences

- A version move reaches the catalogs in both release models with no extra step, because both end in
  `plugin build`.
- A repository that carries no catalog sees no change in behavior at all.
- `BuildResult` grows a `catalogs` list (`path`, `status`), reported in the build output beside the
  vendor rows, so a refresh is visible rather than a silent write outside the project root.
- A build now reads the repository root. Outside a repository — a plugin in a bare directory — there
  is nothing to refresh and the step is skipped.
