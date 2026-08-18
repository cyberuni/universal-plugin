---
name: doctor
description: Use this skill to diagnose a universal agent plugin — when a runtime loads none of the plugin's skills, when a vendor manifest is missing or looks out of date after a pull, when a build prints warnings nobody has read, or when checking whether what the canonical plugin.json declares still matches what is on disk for Claude Code, Cursor, Codex, and GitHub Copilot CLI. Trigger on "is my plugin set up right", "why isn't my plugin loading", "check the plugin", "are the vendor manifests current", or "what does this plugin declare".
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
| `built` | the build writes this vendor's manifest |
| `canonical` | the vendor reads root `plugin.json`; **no file is written, and that is correct** |
| `skipped` | an unknown vendor id — a typo in `vendors` |
| `failed` | the write itself failed; the finding names why |

`copilot-cli` reporting `canonical` with `exists: false` is a healthy plugin, not a missing build.
Never report it as a fault.

If `node` is unavailable, read `scripts/doctor.mjs` and apply the same checks by hand: it composes
`universal-plugin plugin build --dry-run --format json` with filesystem facts that build cannot see.

## Findings and their repairs

Each `code` below is what the script emits.

| Finding | What it means | Repair |
| --- | --- | --- |
| `no-manifest` | no root `plugin.json` — this is not a plugin yet | `/universal-plugin:init` |
| `legacy-manifest` | root `plugin.json` with neither `$schema` nor `extensions` — a single-vendor manifest on the canonical path | `/universal-plugin:init`, adopt route |
| `vendor-only` | a vendor manifest with no canonical manifest above it | `/universal-plugin:init`, adopt route |
| `unbuilt` | a declared vendor whose output path holds no file — that runtime sees no plugin | `universal-plugin plugin build` |
| `stale` | a derived manifest older than `plugin.json` | `universal-plugin plugin build` |
| `hand-edited` | a derived manifest that `build` would rewrite — the edit is already lost, it just has not been overwritten yet | move the field to the canonical manifest or to `harnesses.<vendor>`, then rebuild |
| `unknown-vendor` | a `vendors` entry no build target matches; reported as `skipped` plus a warning | fix the id in `plugin.json` |
| `undeliverable-override` | `harnesses["copilot-cli"]` sets fields that reach nothing | `/universal-plugin:init`, update route — move them to a vendor that has a derived manifest, or drop them |
| `codex-fields-missing` | Codex is targeted without `version` or `description`; the build fails and writes **nothing at all**, including for the other vendors | add both to the canonical top level |
| `version-drift` | the `packagePath` `package.json` and the canonical manifest carry different versions | `/universal-plugin:version` |
| `stale-github-plugin` | a leftover `.github/plugin/plugin.json` from an older build — shadowed by root and no longer generated | `/universal-plugin:remove-plugin` |
| `shadowing-manifest` | a `.plugin/plugin.json` exists — it outranks root in Copilot CLI's search order and silently shadows the canonical manifest | `/universal-plugin:remove-plugin` |
| `no-vendors` | no vendor is declared, so the build writes nothing and no runtime reads the plugin | `/universal-plugin:init`, update route |
| `package-path-missing` | `packagePath` names a directory with no readable `package.json` | fix `packagePath`, or create the package |
| `unparsable-manifest` | root `plugin.json` is not valid JSON | fix the syntax error |

## Checking staleness properly

The `stale` finding is an mtime comparison, which catches the common case and nothing more. It cannot
see a hand-edit made after the last build. The definitive check is to rebuild on a clean tree and read
the diff:

```bash
git status --short          # must be clean first, or the diff proves nothing
npx universal-plugin plugin build
git diff -- .claude-plugin .cursor-plugin .codex-plugin
```

An empty diff means the derived manifests match what the canonical manifest says. Any hunk is drift —
either a stale build or a hand-edit that the rebuild has now discarded.

That rebuild is a **write**, so it is not part of the diagnosis. Report the check as a repair the
user can run, or ask before running it yourself.

## Version drift

Two files carry an authored version: the canonical `plugin.json`, and the `package.json` at
`extensions["org.cyberuni.universal-plugin"].packagePath` when one is declared. The script compares
them and emits `version-drift`.

They diverge when someone ran `npm version`, or when changesets released a number that never flowed
back. Both are `/universal-plugin:version`'s to fix — never patch one file by hand to match the
other.

## Rules

- **Never repair.** Report the finding and name the skill that owns it.
- **Never hand-edit a derived manifest to make a finding go away.** The next build overwrites it and
  the finding comes back.
- Do not report `copilot-cli` writing no file as a fault. It reads the canonical manifest directly.
- Do not treat repo-private agent configuration (`.claude/skills/`, `.agents/skills/`) as part of the
  plugin. Diagnosing a repository's own skill wiring is `buddy-agent-harness:doctor`.

## Related skills

| Task | Skill |
|------|-------|
| Create, adopt, or change what the plugin declares | `init` |
| Move the plugin's version | `version` |
| Remove derived manifests, or the plugin itself | `remove-plugin` |
| Generate the repository's own marketplace catalogs | `marketplace` |
| Publish it to the shared marketplace repository | `publish-plugin` |
