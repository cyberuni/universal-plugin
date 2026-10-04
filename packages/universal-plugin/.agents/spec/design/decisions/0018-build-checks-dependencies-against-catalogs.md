# 0018 — `plugin build` checks dependencies against the catalogs it refreshes

**Status:** accepted
**Date:** 2026-10-04
**Builds on:** [0013](./0013-plugin-dependencies.md) — the canonical `dependencies` declaration, and
its §5 ruling that resolution is out of scope. [0014](./0014-build-refreshes-catalogs.md) — the build
refreshes the repository-local catalogs it finds.

## Context

[Issue #147](https://github.com/cyberuni/universal-plugin/issues/147). `uip-pods` declares
`dependencies: ["cyber-asana"]` and ships from a repository-local catalog, `uip-pods-local`, that
lists only `uip-pods`. Claude Code resolves a bare dependency name against the marketplace its
dependent was installed from (`.research/plugin-schema`), so installing `uip-pods@uip-pods-local`
fails while resolving `cyber-asana` — and `plugin build` reported `built 2, failed 0` with no
warning.

[0013](./0013-plugin-dependencies.md) §5 ruled out checking that a dependency *exists*: that means
reading other marketplaces, which is resolution. This failure needs none of that. Whether a bare name
resolves through a catalog is a question about the catalog, and the build is already holding that
catalog open to refresh its own entry ([0014](./0014-build-refreshes-catalogs.md)).

## Decision

### 1. Each catalog a dependency resolves through is checked, offline

While refreshing a catalog for a vendor that reads `dependencies` — Claude Code alone today, per
0013's support table — the build checks the declaration that vendor receives (a
`harnesses.<vendor>.dependencies` override included) against that catalog:

- **A bare name** — or one qualified with the catalog's own name — must be listed in the catalog.
- **A name qualified with another marketplace** must have that marketplace in the catalog's
  `allowCrossMarketplaceDependenciesOn`, or Claude Code refuses the dependency at install. Whether the
  other marketplace really lists it stays unchecked: that is resolution, and 0013 §5 stands.

Only files already on disk are read. A vendor whose runtime reads no dependency has nothing resolved
through its catalog and is not checked.

### 2. An unresolvable dependency warns, and `--strict-dependencies` fails

The warning names the dependency, the catalog, and both fixes: list it in that catalog
(`marketplace add`, for example with an npm source), or qualify it with the marketplace that lists it
and allow that marketplace in `allowCrossMarketplaceDependenciesOn`.

Warning by default matches the rest of the build ([0011](./0011-warn-and-drop-unrepresentable-hook-handlers.md),
0013 §3). The catalog is a file the author keeps, and a dependency resolved some other way (an
enterprise-managed marketplace, say) would make a hard failure wrong for that author.
`--strict-dependencies` turns these issues, and only these, into exit 1 for CI. It is named for what
it gates, not as a general `--strict`: 0011 and 0013 left promoting their warnings to failures as a
separate decision, and this ADR does not make it for them. `BuildResult.dependencyIssues` carries the
issues apart from the other warnings so the CLI can tell them apart.

### 3. A dependency that names its source is listed in the catalog

An object entry may carry `source`, a catalog source in the tagged shape
(`{ "source": "npm", "package": "cyber-asana" }`). When it resolves through a catalog the build is
refreshing (bare, or qualified with the catalog's own name), the build lists it there: a new entry is
`{ name, source }` and nothing else, and an entry already present takes the declared source and keeps
every other field. The declaration is the authored record of where the dependency comes from, so it
wins over the catalog, the same way 0014's refresh re-derives this plugin's own entry. The entry
carries no other metadata — that would come from the dependency's manifest, which is not here.

Without `source` the build never writes an entry: it cannot know where the dependency is distributed
from, and an invented one would install the wrong thing or nothing. It falls back to the warning.

A source kind the catalog does not document (`TARGET_SOURCE_KINDS`) is not listed; the build warns
that it cannot carry it, and the check then reports the dependency as unresolved.

`source` is ours, not the runtime's. Claude Code's dependency object is `{name, marketplace?,
version?, sha?}`, so the build strips `source` from every derived manifest, and `validateDependencies`
rejects a `source` that is not a tagged object.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Leave it to Claude Code's install-time error | That is the failure the issue reports: it surfaces in a user's install, after release, with the build green. |
| Fail by default | A catalog can be right for reasons the build cannot see. A warning tells every author; the flag lets the ones who want a gate have one. |
| A general `--strict` | It would quietly decide 0011's and 0013's deferred question too. One flag per concern keeps each promotion its own decision. |
| Infer a source for a dependency without one (an npm package of the same name) | A name collision installs an unrelated package. The build lists only what the author declared. |
| Check `doctor` instead | The build already holds the catalog and the declaration; reporting there costs nothing and reaches every release. |

## Consequences

- A repository like `uip-pods` gets a warning on every build until the catalog lists the dependency,
  or the manifest names its source and the build lists it.
- Declaring `source` makes the build write a second entry into a catalog it refreshes. 0014's
  boundary moves from "one entry" to "this plugin's entry and the dependencies it declares a source
  for"; still never a catalog the repository does not carry.
- A second runtime that reads dependencies gets the check by flipping its entry in the support table
  in `src/dependencies/`, the same one-line change 0013 promised.
