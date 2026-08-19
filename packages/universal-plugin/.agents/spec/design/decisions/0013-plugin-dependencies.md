# 0013 — Plugin dependencies: canonical to us, vendor-extension to the standard

**Status:** accepted
**Date:** 2026-08-18
**Extends:** [0007](./0007-adopt-agent-plugins-spec-canonical.md) — the canonical manifest is the one
authored artifact. **Applies:** [0011](./0011-warn-and-drop-unrepresentable-hook-handlers.md) — what
the build does when one target cannot express what the manifest declares.

## Context

[Issue #44](https://github.com/cyberuni/universal-plugin/issues/44) asks for a way to say that one
plugin builds on another — the example is a domain plugin needing a general Asana utility plugin —
and leaves two questions open: whether `dependencies` should be promoted from a Claude Code vendor
extension to a canonical field, and what `plugin build` does with the declaration.

Both answers turn on the same evidence: what each runtime actually does with a `dependencies` field.
Re-verified August 2026 against the shipped CLIs rather than the June research, which recorded only
that Claude Code had the field.

| Runtime | Reads `dependencies`? | How it was checked |
| --- | --- | --- |
| Claude Code 2.1.235 | **Yes** — resolves, installs, enables, and version-checks | `claude plugin validate` on each form; manifest schema and resolver read out of the shipped bundle |
| Codex 0.147.0 | No — not a field of its plugin manifest | Manifest struct in the shipped binary; a local marketplace install of a manifest carrying the field |
| Cursor 2026.07.01 | No — not a field of its plugin manifest | Manifest schema in the shipped bundle |
| GitHub Copilot CLI | No — undocumented | [CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference) |
| Agent Plugins Spec v1.0.0 | No — and the manifest is `additionalProperties: false` | [Published schema](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json) |

Three facts inside that table decide everything below.

**The open standard has no `dependencies` and does not admit one.** The v1.0.0 manifest closes its
field set at ten properties and reserves `extensions` as the only sanctioned channel for anything
else. A top-level canonical `dependencies` is not a promotion; it is a spec violation, and the
standing principle in this repository is that the open standard is the base layer and vendor
specifics layer on top rather than replace it.

**One of four runtimes reads the field, and it reads a shape the issue got wrong.** The issue proposes
an npm-style object map, `{"cyber-asana": "^0.9.0"}`; `claude plugin validate` rejects it with
*"expected array, received object"*. Claude Code takes an array whose entries are a plugin name —
optionally `@marketplace`-qualified — or an object `{name, marketplace?, version?, sha?}`. A range may
also be written as an `@^…` tail on the string form, and there the runtime accepts it and then strips
it before resolving: constraints are read only off the object form. A non-caret range in the string
form (`dep@>=1.0.0`) fails the name pattern and takes the whole manifest down with it.

**Claude Code's support is not a marker field.** It installs missing dependencies, enables a
dependency when its dependent is enabled, checks a declared range against the installed version with
semver, sweeps orphans (`claude plugin prune`), and refuses a cross-marketplace dependency unless the
root marketplace lists that marketplace in `allowCrossMarketplaceDependenciesOn`. A declaration is
worth writing on its own, before this project resolves anything.

## Decision

### 1. `dependencies` is canonical to universal-plugin, not to the standard

It is authored once, in `extensions["org.cyberuni.universal-plugin"].dependencies`, beside every other
universal-plugin field. It is not added to the root of the canonical manifest.

This is the promotion the issue asked about, granted at the only altitude the standard leaves open.
The author writes the declaration once rather than reaching into `harnesses["claude-code"]`, which is
what the field being *a Claude Code vendor extension* had meant; the build owns which runtimes receive
it, and the day a second runtime reads a dependency it receives one without the author re-authoring
anything. What is *not* claimed is that four runtimes honor it. They do not, and the governance table
still records `dependencies` as read by `claude-code` alone.

Authoring under `harnesses["claude-code"]` keeps working. It is the escape hatch for a Claude-shaped
declaration this project should not be modeling.

### 2. The canonical form is Claude Code's form

An array; each entry a plugin name, optionally `@marketplace`-qualified, or an object
`{name, marketplace?, version?, sha?}`. Version ranges are semver, checked by
[`semver.validRange`](https://github.com/npm/node-semver) at build time.

Copying the only consumer's shape is deliberate. Inventing a friendlier canonical shape — the npm map
the issue proposed, say — would mean translating it into Claude's on the way out, and translating a
declaration nobody else reads buys nothing but a second shape to keep correct.

### 3. A declaration a vendor cannot read is dropped, and the build warns

Exactly [0011](./0011-warn-and-drop-unrepresentable-hook-handlers.md)'s policy, for the same reasons.
The build stays green: exit 0, status `built`.

One warning per vendor, naming every dependency that did not reach it. Cursor and Codex get the
declaration dropped from their derived manifests. Copilot CLI reads the canonical root manifest
directly and so has no derived manifest to drop anything from — its declaration sits under
`extensions`, which it ignores, so the warning reports it as ignored at runtime.

Emitting the field anyway was rejected on evidence, not principle. Codex ships a validator for the
plugin ingestion contract whose allowlist is thirteen keys wide; `dependencies` is not among them, and
the validator reports an unaccepted field as an error on the whole manifest. Cursor's parser strips
unknown keys today and publishes no promise to keep doing so. Trading a visible local loss for a
possible total one is the wrong trade.

### 4. `build` validates the declaration's shape, and warns about what the runtime discards

Shape is checked whichever vendors are targeted, because a malformed declaration is malformed
everywhere: not an array, an entry that is neither name nor named object, a name the runtime's pattern
rejects, a `version` that is not a semver range. These are errors and they fail the build — the same
treatment `name is required` gets, because they are author mistakes with no derivation to salvage.

A range written into the string form is not an error; it validates and then vanishes. The build warns
once, naming the object form that would be enforced. A loss the author cannot see is the one thing
this build refuses to ship — the same reason an undelivered `harnesses.copilot-cli` field warns.

### 5. Resolution is out of scope, and the declaration is worth having without it

The issue floats validating that declared dependencies exist. The build cannot: existence is a
question about a marketplace, and answering it means resolving, fetching, and eventually installing —
a much larger feature, with its own questions about which marketplaces are consulted and what a lock
file would mean.

It is not needed for this to pay. Claude Code already resolves, installs, and version-checks what it
reads, so the declaration reaches a real resolver the moment it is written; and `plugin install`
([0012](./0012-local-install.md)) already puts a working copy into a runtime, where that resolver runs.
This decision therefore stands on its own rather than waiting on an installer.

## Consequences

- **The governance table stays honest.** `dependencies` remains listed as read by `claude-code` only.
  Canonical authoring and universal support are different claims, and this ADR grants the first.
- **An author targeting Cursor or Codex sees a warning on every build.** That is the intended signal:
  the plugin will load there without its dependency, and no one is told at load time. The remedy is to
  document the requirement in the README, which the warning cannot do for them.
- **The vendor support table now lives in the build** (`src/dependencies/`), like the hook capability
  table before it, and will decay the same way. It carries its evidence and its date;
  `.research/plugin-schema/` names the recheck triggers.
- **A second runtime adding the field is a one-line change.** Flip its entry in the support table and
  the derived manifest carries the declaration.
- **`--strict` stays unadded**, as in [0011](./0011-warn-and-drop-unrepresentable-hook-handlers.md).
  Promoting these warnings to failures is the same separate decision, unchanged by this one.
