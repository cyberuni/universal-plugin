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

## See also

- [`doctor-universal-plugin`](../doctor-universal-plugin/) — diagnoses a plugin without writing anything
- [`plugin build`](../../cli/build/) — the CLI command that runs under the hood, for scripting and CI
