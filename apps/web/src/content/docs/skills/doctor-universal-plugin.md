---
title: doctor-universal-plugin
description: Diagnose a plugin and repair nothing.
---

Diagnoses a plugin and repairs nothing: it reports what is declared, unbuilt, stale, drifting, or
shadowing, then names the skill that owns each repair.

## Output

The checks run as a script rather than a prose checklist, because they are deterministic. It emits
one JSON object:

```json
{
  "manifest": { "name": "my-plugin", "version": "1.0.0" },
  "vendors": [{ "vendor": "claude-code", "path": ".claude-plugin/plugin.json", "status": "built", "exists": true, "stale": false }],
  "findings": [{ "code": "unbuilt", "severity": "high", "detail": "…", "repair": "…" }],
  "ok": false
}
```

Exit status is `0` whether or not findings exist. A finding is a result, not a failure, so the
script is safe to run from a session-start hook.

## What it can't check inline

One check stays out of the script. Comparing a derived manifest against what the build would write
today requires rebuilding on a clean tree, and that writes. The skill reports it as a repair for you
to run.

One check reads git rather than the filesystem. A runtime keys its plugin cache on the version, so
content committed after the commit that set the current version never reaches anyone who already
installed the plugin. The skill reports that as `unreleased-content`. It stays quiet for a plugin
that declares `packagePath`, where the release moves the number, and on a tree with no history.

## Changesets release config

A plugin installed from git or a marketplace catalog, rather than npm, can still be released with
changesets. It needs three things, and the skill reports each one that is missing:

- `changesets-no-package`: a `package.json` at the plugin root. Changesets releases only a package.
  [`init-universal-plugin`](../init-universal-plugin/) writes a minimal private one.
- `changesets-private-untagged`: `"privatePackages": { "version": true, "tag": true }` in
  `.changeset/config.json`. Without `tag`, `changeset publish` creates no tag for a private package.
- `changesets-no-publish-script`: a `publish-script` on the `changesets/action` step. Without it, the
  action does nothing after the Version Packages PR merges, so no tag or GitHub release is made.

A plugin whose root `package.json` is published to npm is not checked here.

## release-please release config

release-please can release a plugin with no `package.json` by bumping `plugin.json` through
`extra-files`. It runs no command before its release commit, so the rest of the places that carry
the version stay behind unless a workflow restamps the release PR. The skill reports
`release-please-no-restamp` when `release-please-config.json` lists the plugin's `plugin.json` in
`extra-files` and no workflow under `.github/workflows` runs `plugin version`. The
[`version`](../version/) skill has the workflow step. A plugin that declares `packagePath` is not
checked here.

## Version drift in CI

The skill reports each file whose version disagrees with the release's number as `version-drift`:
the canonical manifest, a vendor manifest, a catalog entry, or a skill pin. The same comparison is a
CLI command that exits 1 on drift, so a repository can fail the release PR instead of publishing the
old number:

```bash
universal-plugin publish check-version --root <plugin-root>
```

When the skill finds drift and the repository does not run this yet, it offers to add it to the
`verify` script or the CI workflow.

## See also

- [`init-universal-plugin`](../init-universal-plugin/) — owns the repairs this skill names
- [`plugin build`](../../cli/build/) — the CLI command behind `--dry-run`, for scripting and CI
