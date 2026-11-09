---
"universal-plugin": minor
---

A plugin that ships to no npm package can now be released with changesets. In a changesets repository with no `package.json` at the plugin root, `plugin init` writes a minimal private one (`name`, `"private": true`, `version`), wires the root `version` script, and adds `"release": "changeset publish"`; `--no-changesets` opts out. `plugin version --from-package` with no package in a changesets repository names that `package.json` and the `privatePackages` setting. `doctor` reports `changesets-no-package`, `changesets-private-untagged`, and `changesets-no-publish-script`.
