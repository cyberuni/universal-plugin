---
name: doctor-universal-plugin
description: Use this skill to diagnose a universal agent plugin — when `plugin build` reports "built 0" or "nothing to build", when it warns "No vendors declared in harnesses", when a repository still carries `.plugin/plugin.json` or a top-level `vendorExtensions` block after upgrading universal-plugin across a major, when a released version never reached the vendor manifests, when a runtime loads none of the plugin's skills, when a vendor manifest is missing or looks out of date after a pull, or when checking whether what the canonical plugin.json declares still matches what is on disk for Claude Code, Cursor, Codex, and GitHub Copilot CLI. Trigger on "is my plugin set up right", "why isn't my plugin loading", "the build says built 0", "why did nothing get built", "check the plugin", "are the vendor manifests current", or "what does this plugin declare".
---

# Plugin Doctor

Root `plugin.json` is the canonical manifest. Every other manifest a runtime reads is derived from
it, and a derived manifest that is missing, stale, or hand-edited fails silently: the runtime loads
what it finds, or loads nothing, and says nothing either way.

This skill is **read-only**. It never repairs. Every finding names the skill that owns its repair —
hand it over rather than fixing it here, because a repair can rewrite a manifest the user maintains
and that judgment belongs to the skill that owns the write.

## Diagnose

```bash
node scripts/doctor.mjs
```

Resolve that path against this skill's own directory. It runs the CLI that shipped beside it against
the current working directory, so nothing is downloaded; add `--root <path>` to diagnose elsewhere.
Add `--marketplace-root <path>` (repeatable) to also check a **separately-cloned** shared marketplace
repository (e.g. a local clone of `cyberuni/marketplace`) — see
[Catalogs are checked at the repository root](#catalogs-are-checked-at-the-repository-root).
It never prompts and never writes, so it is safe to run unattended.

Stdout is one JSON object — that is the contract to read, not the CLI's own terminal output:

```json
{
  "root": "…",
  "manifest": { "name": "my-plugin", "version": "1.0.0" },
  "vendors": [{ "vendor": "claude-code", "path": ".claude-plugin/plugin.json", "status": "built", "exists": true, "stale": false }],
  "findings": [{ "code": "unbuilt", "severity": "high", "detail": "…", "repair": "…" }],
  "ok": false
}
```

`findings` is empty and `ok` is `true` when everything resolves — say so outright rather than
reporting an empty list. Exit status is `0` whether or not findings exist; a finding is a result, not
a failure. Add `--verbose` for a human-readable summary on stderr.

Read `vendors[].status` literally:

| Status | Means |
| --- | --- |
| `built` | the build writes this vendor's output. For `copilot-cli` that output is the `com.github.copilot/` component tree, not a manifest |
| `canonical` | the vendor reads root `plugin.json`; **no file is written, and that is correct** |
| `skipped` | an unknown vendor id — a typo in `vendors` |
| `failed` | the write itself failed; the finding names why |

`copilot-cli` reporting `canonical` is a healthy plugin, not a missing build — root `plugin.json`
serves it, and a plugin declaring no agents, commands, rules, hooks, or LSP servers has nothing else
to derive. Never report it as a fault.

A plugin that **does** declare those reports `copilot-cli` as `built` at `com.github.copilot/`
instead. Declaring the canonical `$schema` moves them there: Copilot CLI stops reading them from the
plugin root entirely, so a root-only layout loads none of them and says nothing
([ADR-0015](../../.agents/spec/design/decisions/0015-copilot-spec-mode-namespace.md)). That is what
`copilot-root-components` reports.

If `node` is unavailable, read `scripts/doctor.mjs` and apply the same checks by hand: it composes
`universal-plugin plugin build --dry-run --format json` with filesystem facts that build cannot see.

## Findings and their repairs

Each `code` below is what the script emits.

| Finding | What it means | Repair |
| --- | --- | --- |
| `no-manifest` | no root `plugin.json` — this is not a plugin yet | `/universal-plugin:init-universal-plugin` |
| `legacy-manifest` | root `plugin.json` with neither `$schema` nor `extensions` — a single-vendor manifest on the canonical path | `/universal-plugin:init-universal-plugin`, adopt route |
| `vendor-only` | a vendor manifest with no canonical manifest above it | `/universal-plugin:init-universal-plugin`, adopt route |
| `unbuilt` | a declared vendor whose output path holds no file — that runtime sees no plugin | `/universal-plugin:build-plugin` |
| `stale` | a derived manifest older than `plugin.json`; for a derived directory (`com.github.copilot/`), its newest file is what is compared | `/universal-plugin:build-plugin` |
| `hand-edited` | a derived manifest that `build` would rewrite — the edit is already lost, it just has not been overwritten yet | move the field to the canonical manifest or to `harnesses.<vendor>`, then rebuild |
| `unknown-vendor` | a `vendors` entry no build target matches; reported as `skipped` plus a warning | fix the id in `plugin.json` |
| `unsupported-component` | a component path on the shared extension names a component one targeted vendor has none of (`agents` for Codex, `rules` for Claude Code, …); the build leaves it out of that vendor's manifest | declare the path under `harnesses.<vendor>` for the vendors that read it, or leave it — nothing is lost |
| `undeliverable-override` | `harnesses["copilot-cli"]` sets fields that reach nothing | `/universal-plugin:init-universal-plugin`, update route — move them to a vendor that has a derived manifest, or drop them |
| `codex-fields-missing` | Codex is targeted without `version` or `description`; the build fails and writes **nothing at all**, including for the other vendors | add both to the canonical top level |
| `version-drift` | one file carries a different version from the release's number — the canonical manifest, a derived vendor manifest, a catalog entry, or a skill pin; one finding per file, named by path | `/universal-plugin:version`; then [offer the CI check](#offer-the-check-to-ci) |
| `unreleased-content` | shipped content was committed after the commit that set the current version — a consumer keyed on that version never re-extracts it | `/universal-plugin:version` |
| `copilot-root-components` | agents, commands, rules, hooks, or LSP servers sit at the plugin root with no copy under `com.github.copilot/` — Copilot CLI reads them only from there in spec mode, so it loads none of them, silently | `/universal-plugin:build-plugin` |
| `stale-github-plugin` | a leftover `.github/plugin/plugin.json` from an older build — shadowed by root and no longer generated | `/universal-plugin:remove-plugin` |
| `shadowing-manifest` | a `.plugin/plugin.json` exists — it outranks root in Copilot CLI's search order and silently shadows the canonical manifest | `/universal-plugin:remove-plugin` |
| `no-vendors` | no vendor is declared, so the build writes nothing and no runtime reads the plugin. On a repository still on the pre-0.6 layout the build stops rather than reporting an empty result, and the detail says so — read it beside `legacy-manifest` and `shadowing-manifest`, which name the signals | `/universal-plugin:init-universal-plugin`, adopt route on the pre-0.6 layout, else update route |
| `package-path-missing` | `packagePath` names a directory with no readable `package.json` | fix `packagePath`, or create the package |
| `package-path-unknown` | the CLI could not report `packagePath` (a version too old to read it), so `version-drift` and `unreleased-content` were skipped rather than guessed | upgrade universal-plugin |
| `misplaced-package-path` | `plugin.json` declares `packagePath` under `extensions["org.cyberuni.universal-plugin"]`, where the CLI never reads it — the plugin is silently treated as not shipping to npm | move it to `.agents/universal-plugin.json`, relative to the plugin root |
| `unparsable-manifest` | root `plugin.json` is not valid JSON | fix the syntax error |
| `invalid-catalog` | a marketplace catalog — at the repository root, or at a `--marketplace-root` clone — is not a shape its runtime loads — it is found, read, and refused at install time, in the user's terminal | `/universal-plugin:marketplace` |
| `marketplace-root-missing` | a `--marketplace-root` path does not exist, so it could not be checked at all | clone the marketplace repository, or fix the path |

## Catalogs are checked at the repository root

The marketplace catalogs sit above the plugin in a monorepo, so the catalog check runs against the
repository root rather than `--root`. It reports only a catalog that would be **refused**: a missing
one is not a fault, and nothing here has an opinion on which catalogs a repository ought to carry.

The detail names the key at fault, so hand it to `/universal-plugin:marketplace` as it stands. An
entry's fields are derived from the plugin's `plugin.json`, and the catalog's own `name` and `owner`
are authored in the catalog — which half is at fault decides where the repair goes.

A **shared** marketplace repository (e.g. `cyberuni/marketplace`) is a repository of its own — a bad
entry that reached it by another path (a hand-edited entry, a PR from a different tool, a curator
edit) is invisible to a `doctor` run inside any plugin's own repo, because that run never sees the
shared repository at all. Clone it separately and name the clone explicitly:

```bash
node scripts/doctor.mjs --marketplace-root ../marketplace
```

Pass `--marketplace-root` once per clone to check more than one. Each invalid entry it finds is still
reported as `invalid-catalog`, with the clone's path in the detail so it reads apart from the plugin
repo's own catalogs; a path that does not exist is `marketplace-root-missing` rather than a silent
skip.

## Checking staleness properly

The `stale` finding is an mtime comparison, which catches the common case and nothing more. It cannot
see a hand-edit made after the last build. The definitive check is to rebuild on a clean tree and read
the diff:

```bash
git status --short          # must be clean first, or the diff proves nothing
npx universal-plugin plugin build
git diff -- .claude-plugin .cursor-plugin .codex-plugin com.github.copilot
```

An empty diff means the derived manifests match what the canonical manifest says. Any hunk is drift —
either a stale build or a hand-edit that the rebuild has now discarded.

That rebuild is a **write**, so it is not part of the diagnosis. Report the check as a repair the
user can run, or ask before running it yourself.

## Version drift

A version lives in five places. Two are authored: the canonical `plugin.json`, and the `package.json`
at the `packagePath` the CLI reports (`config get --key packagePath`), resolved from the plugin root.
Three are derived from them: the vendor manifests, this plugin's entry in each repository catalog,
and the `npx`/`upx <package>@<version>` pins in the skills.

The script asks `universal-plugin publish check-version` for the comparison and emits one
`version-drift` per file that disagrees. The reference is the release's number: the `package.json`
when `packagePath` is declared, else `plugin.json`. Pins are compared only when there is a package to
pin, and a pin-exempt skill or a pin that is not a version (`<version>`, `latest`) is skipped.

Files diverge when someone ran `npm version`, or when a release tool (changesets, release-please,
semantic-release) moved `package.json` and nothing carried the number on. All of it is
`/universal-plugin:version`'s to fix — never patch one file by hand to match another.

### Offer the check to CI

`doctor` is advisory and always exits 0. `publish check-version` is the same comparison, read-only,
and exits 1 on drift, so a repository can fail the release PR instead of publishing a plugin that
claims the old version. Once the version findings are reported, check whether the repository
already runs it: search its `package.json` scripts and `.github/workflows/` for `check-version`. If
it does not, offer to add it — ask first, because both are the user's files:

- a `verify` (or `check`) script step: `universal-plugin publish check-version --root <plugin-root>`;
- or a CI step after install on pull requests, for the release PR a changesets, release-please, or
  semantic-release bot opens.

Use the locked `universal-plugin` from the repository's devDependencies when it has one; otherwise
`npx universal-plugin@<version>`, pinned. This check matters most where the release tool picks the
number, because nothing else runs between that bump and publish.

## Unreleased content

A runtime keys its plugin cache on the version, not on content: Claude Code resolves the version,
finds it unchanged, and reports *"already at the latest version"* without re-extracting. So content
pushed without a bump reaches nobody who already installed the plugin, and neither side is told
([ADR-0010](../../.agents/spec/design/decisions/0010-version-policy.md) §6).

The script compares the shipped paths — the canonical manifest, the skills directory, `agents/`,
`governances/`, `references/`, `mcp.json` — against the commit that set the version the manifest carries now, and
emits `unreleased-content` for anything committed since. Uncommitted work is not reported; it has not
shipped.

Two cases are deliberately silent. A plugin that declares `packagePath` is skipped, because there the
release picks the number (ADR-0010 §2) and content waiting ahead of the last released version is the
normal state of a branch. A tree with no git history is skipped rather than guessed at.

The repair is the bump, and it belongs to `/universal-plugin:version`. Judge first whether the change
is meant to ship — content that is still being worked on is not a finding to act on.

## Rules

- **Never repair.** Report the finding and name the skill that owns it.
- **Never hand-edit a derived manifest to make a finding go away.** The next build overwrites it and
  the finding comes back.
- Do not report `copilot-cli` writing no **manifest** as a fault. It reads the canonical manifest
  directly. Its **components** are a separate question — a `copilot-root-components` finding is a real
  fault, and `canonical` is only healthy for a plugin that declares none of the moved kinds.
- Do not treat repo-private agent configuration (`.claude/skills/`, `.agents/skills/`) as part of the
  plugin. Diagnosing a repository's own skill wiring is `buddy-agent-harness:doctor`.

## Related skills

| Task | Skill |
|------|-------|
| Create, adopt, or change what the plugin declares | `init-universal-plugin` |
| Rebuild the derived manifests (`unbuilt`, `stale`, `copilot-root-components`) | `build-plugin` |
| Move the plugin's version | `version` |
| Remove derived manifests, or the plugin itself | `remove-plugin` |
| Generate the repository's own marketplace catalogs | `marketplace` |
| Publish it to the shared marketplace repository | `publish-plugin` |
