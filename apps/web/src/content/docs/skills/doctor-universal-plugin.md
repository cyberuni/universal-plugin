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
installed the plugin. The skill reports that as `unreleased-content`. It stays quiet where the release
moves the number: a plugin that declares `packagePath`, or one that changesets, release-please,
semantic-release, or release-it versions. It also stays quiet on a tree with no history.

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

A push made with the default `GITHUB_TOKEN` starts no workflow run, so a restamp pushed with it
leaves the release PR's head commit with no checks, and a required check blocks the merge. The skill
reports `release-please-restamp-no-ci` when a workflow runs `--from-manifest` and `git push` with no
other credential in sight: no `actions/create-github-app-token` step, no deploy key, and no `token:`
input other than the default token. It reads the workflow as text, so any of those clears the file.
A `workflow_dispatch` re-run does not clear it, because checks from that event do not count toward a
required check.

## release-it config

release-it commits and tags whatever the tree holds once its hooks have run. A release-it config
(`.release-it.json` and its siblings, or the `release-it` key of `package.json`) with no hook running
`plugin version` tags a release whose `plugin.json` and vendor manifests still carry the previous
version. The skill reports it as `release-it-no-stamp`. The fix is an `after:bump` hook:
`"hooks": { "after:bump": "universal-plugin plugin version ${version}" }`.

## semantic-release config

semantic-release decides the version inside its own run, so only an `@semantic-release/exec`
`prepareCmd` running `plugin version` carries it into `plugin.json` and the derived files before
`@semantic-release/git` commits them. The skill reads the config semantic-release would load (the
`release` key of `package.json`, then the first `.releaserc*`, `.config/releaserc*` or
`release.config.*` file) and reports:

- `semantic-release-no-stamp` when no `prepareCmd` runs `plugin version`. A stamp in `publishCmd`
  runs after the commit, so it does not count.
- `semantic-release-npm-unshipped` when the plugin ships to no npm package and the config lists
  `@semantic-release/npm`, or names no `plugins` and so gets the default list, which includes it.
  With no `package.json` the release fails with `ENOPKG`.
- `semantic-release-no-commit` when a `prepareCmd` stamps but the config runs no
  `@semantic-release/git`. semantic-release tags the commit the `prepare` step leaves, so without a
  commit the tag holds the files from before the stamp. A `prepareCmd` that runs `git commit` itself
  counts. The finding is `medium` for a plugin that ships to npm, whose package still carries the
  number, and `high` otherwise.
- `semantic-release-git-before-exec` when `@semantic-release/git` comes before the
  `@semantic-release/exec` that stamps. Plugins run `prepare` in `plugins` list order, so git commits
  the files before exec stamps them. The order is checked only in a JSON or YAML config with no
  top-level `prepare` key, where the text order is the list order.

The [`init-universal-plugin`](../init-universal-plugin/) skill writes the wiring. A config that
`extends` a shareable config is not checked, because the wiring may live in the shared one.

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
