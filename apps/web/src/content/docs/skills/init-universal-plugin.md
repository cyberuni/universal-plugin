---
title: init-universal-plugin
description: Create a plugin, adopt an existing one onto the open standard, or change what it declares.
---

Creates a plugin, adopts an existing one onto the open standard, or changes what an existing one
declares. It is the only skill of the four that writes the canonical `plugin.json`.

It runs five phases: survey, classify, confirm, apply, verify.

## The confirm phase

Adoption turns hand-written vendor manifests into build output, so the skill states the plan and
waits for approval before it rewrites anything you authored. Creating a file that does not exist yet
needs no approval.

## Adoption is lossless by contract

After the build, `git diff` over the vendor manifest paths should show formatting churn and nothing
else. A field that disappeared is a regression.

## Releasing a non-npm plugin with changesets

A plugin installed from git or a marketplace catalog often has no `package.json`, and changesets
cannot release anything without one. When the repository carries `.changeset/` and the plugin root
has no `package.json`, `plugin init` writes a minimal private one:

```json
{ "name": "my-plugin", "private": true, "version": "1.0.0" }
```

The version comes from the `plugin.json` being replaced, else `0.0.0`. Init also adds two scripts
to the repository root `package.json`:

- `"version": "changeset version && universal-plugin plugin version --from-package --root <plugin-root>"`
  carries each release number into `plugin.json`, the vendor manifests, and the catalogs.
- `"release": "changeset publish"` tags the release. `changesets/action` turns that tag into a
  GitHub release when its step sets `publish-script`.

Set `"privatePackages": { "version": true, "tag": true }` in `.changeset/config.json`, or
`changeset publish` makes no tag. The skill offers this setup in its confirm phase. If you decline,
it passes `--no-changesets`.

When the repository has no release tool yet, the skill asks how you will release the plugin. If you
choose changesets, it sets up `.changeset/` first, so init then writes the `package.json`. Other
release tools don't need one.

## Releasing with semantic-release

When the repository uses semantic-release, or you choose it, the skill edits its config. It shows
the `plugins` list before and after, and it writes nothing until you approve. `plugin init` itself
never touches release config.

- `@semantic-release/exec` runs
  `prepareCmd: "universal-plugin plugin version ${nextRelease.version}"`, which stamps the release
  number into `plugin.json`, the vendor manifests, the catalogs, and the skill pins.
- `@semantic-release/git` commits those files back. Copilot CLI and GitHub-hosted marketplaces read
  `plugin.json` from the repository, so they only see a release that was committed.
- For a plugin that ships to no npm package, `@semantic-release/npm` is dropped. Setting
  `npmPublish: false` is not enough, because that plugin still edits `package.json`.

A plugin with no `package.json` ends up with a config like this:

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ["@semantic-release/exec", {
      "prepareCmd": "npx universal-plugin@<version> plugin version ${nextRelease.version}"
    }],
    ["@semantic-release/git", {
      "assets": [
        "plugin.json", ".claude-plugin/**", ".cursor-plugin/**", ".codex-plugin/**",
        ".agents/plugins/marketplace.json", ".github/plugin/**", "com.github.copilot/**",
        "skills/**", ".plugin/pins.json"
      ]
    }],
    "@semantic-release/github"
  ]
}
```

Install `@semantic-release/exec` and `@semantic-release/git` wherever the release job runs.

For release-it and release-please, the skill names the stamp the tool must call and leaves the
wiring to the [`version`](../version/) skill.

## See also

- [`doctor-universal-plugin`](../doctor-universal-plugin/) — diagnoses a plugin without writing anything
- [`plugin build`](../../cli/build/) — the CLI command that runs under the hood, for scripting and CI
