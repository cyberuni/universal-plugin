---
spec-type: behavioral
concept: [marketplace, axi]
---

# marketplace remove — drop one listed entry from every catalog

## What

`universal-plugin marketplace remove <name>` is the inverse of [`add/`](../add/README.md). It drops
the entry of that name from every selected catalog that lists it, and keeps the rest of each catalog
as it was: the top level, the other entries, and their order.

Before this command, removing a deprecated entry meant hand-editing each runtime's catalog, or
regenerating with `marketplace init --force`, which loses what a curator wrote by hand
([issue #292](https://github.com/cyberuni/universal-plugin/issues/292)).

The command is a **local edit**. It reads the catalogs under `--root` and writes only those
catalogs. Nothing is fetched, uninstalled, or published.

**Non-goals:** deleting a plugin's files; uninstalling a plugin from a runtime; removing an entry
from a marketplace this repository does not hold; keeping `plugin build` or `marketplace init` from
listing a plugin that is still in the repository.

## Use Cases

| Entry point | Trigger | Inputs | Outcome |
|---|---|---|---|
| `marketplace remove <name>` | A listed plugin is deprecated or replaced. | The name the catalogs list it under. | Every catalog listing it loses the entry; nothing else changes. |
| `marketplace remove <name> --force` | The entry goes even though a listed plugin depends on it. | The name, plus `--force`. | The entry is removed, and stderr names each dependency it leaves unresolved. |
| `marketplace remove … --dry-run` | A maintainer reviews the removal first. | Any removal plus `--dry-run`. | The plan is reported and no catalog changes. |
| `marketplace remove … --format json` | A script consumes the result. | `--format json`. | stdout is a machine-readable row list; diagnostics stay on stderr. |

### Request decisions

- The entry is named by the name the catalogs list it under, and must match the catalog name grammar.
- With no target flags, all four catalogs are selected.
- A selected catalog that does not exist, or that does not list the entry, is reported `skipped`
  with the reason. An entry listed in no selected catalog fails, so a mistyped name is not reported
  as success.

### Removal and safety decisions

- Only the named entry goes. The catalog's top level, its other entries, and their order are kept.
- Every planned catalog is validated before anything is written, with the same checks `marketplace
  validate` runs. A removal that leaves a listed plugin with a dependency its catalog no longer
  resolves stops with no write, names the dependency, and points at `--force`. An issue the
  catalogs already had does not stop it.
- `--force` writes the removal anyway and reports each issue it introduced on stderr.
- An entry whose `./` source still holds a `plugin.json` is removed, with a warning: `plugin build`
  refreshes its own entry and `marketplace init` lists what it discovers, so either one lists the
  plugin again until the plugin itself is removed.
- `--dry-run` writes nothing. Each changed catalog is written atomically.
- Every row carries `target`, `status`, `entry`, `source`, and `path`, with an optional `reason`.
  `source` is the source the removed entry stated, `-` where the catalog did not list it. Status is
  one of `removed`, `planned`, or `skipped`.
- Default output is a compact TOON table on stdout; `--format json` returns the same rows. stderr
  carries each skip, each warning, and a reminder that no remote marketplace action occurred.

## Control Flow

```mermaid
flowchart TD
  A[Parse command options] --> B{Output format and name valid?}
  B -- no --> E1[Fail loud: no writes]
  B -- yes --> C[For each selected target]
  C --> D{Catalog exists and lists the entry?}
  D -- no --> S[Record skipped with the reason]
  D -- yes --> F[Plan the catalog without the entry]
  S --> G{Any target lists the entry?}
  F --> G
  G -- no --> E1
  G -- yes --> H{Validation finds an issue the catalogs did not already have?}
  H -- yes, no --force --> E1
  H -- yes, --force --> W[Warn with each introduced issue]
  H -- no --> L
  W --> L{Dry run?}
  L -- yes --> M[Report planned; write nothing]
  L -- no --> N[Atomically write each changed catalog]
  M --> O[Render TOON or JSON; skips, warnings, and local-only notice on stderr]
  N --> O
```

## Scenario map

| Edge | Path (Given) | Scenario |
|---|---|---|
| every catalog | the entry is listed in all four catalogs with curated fields elsewhere | `an entry is removed from every catalog and the rest stays` |
| not listed | a catalog without the entry, a target with no catalog | `a catalog that does not list the entry is skipped` |
| unknown entry | no selected catalog lists it | `an entry no catalog lists fails` |
| dependent | a listed plugin depends on the entry | `an entry another listed plugin depends on is kept` |
| forced | a dependent, plus `--force` | `force removes a depended-on entry and names what broke` |
| still present | the entry's `./` path holds a `plugin.json` | `removing a plugin still in the repository warns it will return` |
| dry run | `--dry-run` | `dry run reports the plan without writing it` |
| JSON rendering | `--format json` | `JSON output exposes the result rows` |
