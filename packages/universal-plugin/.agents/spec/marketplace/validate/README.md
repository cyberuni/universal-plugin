---
spec-type: behavioral
concept: [marketplace, axi]
---

# marketplace validate — check the local catalogs against the schema each runtime loads

## What

`universal-plugin marketplace validate` reads the marketplace catalogs a repository carries and
reports, per target, whether that target's runtime would load the file. It writes nothing.

A catalog is discovered, read, and refused at **install** time, in a user's terminal, far from the
command that generated it. Validation moves that refusal to the repository, where the author can act
on it. The rules are the official Claude Code marketplace schema
(<https://json.schemastore.org/claude-code-marketplace.json>) reduced to the keys this project writes
or merges; Cursor documents the same shape and Copilot CLI reads the Claude catalog, so those three
targets share one rule set. Codex reads a document of its own and has its own.

Two invalid shapes reach a repository unnoticed, because both are what `package.json` carries: `owner`
as a `"Name <email>"` string where every runtime requires an object, and a plugin `repository` as a
`{ type, url }` object where the catalog requires the URL string. Claude Code refuses the catalog for
either one.

**Non-goals:** repairing a catalog; generating one (that is `marketplace init`); proving a plugin
installs in every runtime; reaching the network, whether to fetch a schema or to reach a marketplace
service.

## Use Cases

| Entry point | Trigger | Inputs | Outcome |
|---|---|---|---|
| `marketplace validate` | An author checks what the repository carries. | `--root`. | Every target is reported `valid`, `invalid`, or `missing`. |
| `marketplace validate --claude --codex --copilot --cursor` | An author checks a selected target set. | One or more target flags. | Exactly the selected targets are reported. |
| `marketplace validate --required` | A target the author committed to must carry a catalog. | `--required`. | A selected target with no catalog is `invalid` rather than `missing`. |
| `marketplace validate --format json` | A script or CI job consumes the result. | `--format json`. | stdout is the same rows as JSON; issues stay on stderr. |

### Validation decisions

- Target flags compose as a union; with none, the target set is every vendor.
- A catalog absent from disk is `missing`, which is not a failure. Under `--required` it is `invalid`
  with one issue.
- JSON that does not parse is one issue on that catalog rather than a thrown error, so every selected
  target is still reported.
- Claude, Cursor, and Copilot are checked against the Claude Code schema's rules: a required `name`
  string, a required `owner` object carrying `name`, and a `plugins` array whose entries each carry a
  required `name` string and a `source` that is either a `./`-prefixed repository-relative string or
  one of the tagged remote objects the schema names (`npm`, `url`, `github`, `git-subdir`).
  `version`, `description`, `homepage`, `repository`, `license`, and `category` are strings; `author`
  is an object carrying `name`; `keywords` and `tags` are arrays of strings.
- Codex is checked against its own document: a required `name`, an optional `interface` object, and
  entries carrying a required `name` and a `source` — the `local` object form included, which the
  Claude rules reject. No entry `version` is required
  (`.research/local-marketplaces`, E-CODEX-M16).
- A `./` source is checked for existence under `--root`. A source that resolves nowhere satisfies
  every schema and still installs nothing.
- In the Claude catalog — Claude Code is the only runtime that reads plugin dependencies — each listed
  plugin's dependencies are checked against the catalog, as far as they are readable offline: the
  entry's own `dependencies`, and, for a `./` source, the plugin's built `.claude-plugin/plugin.json`
  or, before a build, its canonical declaration (the `claude-code` harness override first). Claude
  Code resolves a plain dependency — a bare name, or an object with no `marketplace` — against the
  declaring plugin's own marketplace, so a plain dependency this catalog does not list is an issue.
  A dependency that names its marketplace is not held to this catalog's listing, even when it names
  this catalog. One that names another marketplace is an issue unless that marketplace is in
  `allowCrossMarketplaceDependenciesOn`. Either way the plugin does not install from this catalog,
  so both are issues like a dangling source, not warnings. The messages are `plugin build`'s ([ADR-0018](../../design/decisions/0018-build-checks-dependencies-against-catalogs.md)),
  which warns by default because it refreshes a catalog it does not own; `validate` is the gate.
  Whether the other marketplace lists the dependency, and a plugin fetched from npm or git, stay
  unchecked: that needs the network.
- An issue names the key by dotted path (`owner`, `plugins[0].repository`) and, for the two shapes
  `package.json` invites, the value to write instead.
- Nothing is repaired and nothing is written: a catalog someone hand-edited is theirs to correct.
- Exit status is 1 when any selected catalog is `invalid`, 0 otherwise. Rows go to stdout as TOON or
  JSON; issues go to stderr.

## Where else these rules run

The same rules are applied wherever a catalog is produced, so an invalid one does not have to wait for
this command:

- `marketplace init` validates every planned artifact and fails before any write, so generation cannot
  emit a catalog its runtime would refuse.
- `plugin init` folds one entry into a catalog the repository already carries and reports the issues
  as notes, because the top-level metadata at fault is not the entry it derived.
- `plugin build` refreshes one entry and reports the issues as warnings, for the same reason.

## Scenario map

| Edge | Path (Given) | Scenario |
|---|---|---|
| all valid | generated catalogs on disk | `generated catalogs are valid in every runtime` |
| string owner | a catalog whose owner is a string | `an owner written as a string is reported with the object to write instead` |
| npm repository | an entry whose repository is an object | `a repository written as an npm object is reported with the string to write instead` |
| missing catalog | no catalog at the selected path | `an absent catalog is missing rather than invalid` |
| required target | no catalog and `--required` | `a required target with no catalog fails` |
| dangling source | a source pointing at a removed directory | `a source that resolves nowhere is reported` |
| missing dependency | an entry's plain dependency the catalog does not list | `a plain dependency the catalog does not list is reported` |
| self-qualified | a dependency qualified with this catalog's name | `a dependency that names its marketplace is not held to the listing` |
| local manifest dependency | a `./` plugin's manifest declares a dependency the catalog does not list | `a local plugin's declared dependency is checked against the catalog` |
| cross-marketplace | a dependency on another marketplace, not allowlisted | `a cross-marketplace dependency needs the allowlist` |
| Codex rules | the Codex catalog with its local source | `the Codex catalog is judged by Codex rules` |
| not JSON | a catalog that is not JSON | `a catalog that is not JSON is one issue, not a crash` |
| machine output | `--format json` | `json output carries the rows and the issues` |
