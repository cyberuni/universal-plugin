---
"universal-plugin": minor
---

A plugin that ships to no npm package can now be released with release-please. `plugin version --from-manifest` restamps every place at the version `plugin.json` already holds, for a CI step on the release PR after `extra-files` bumps `plugin.json`; it is refused where `packagePath` is declared. `doctor` reports `release-please-no-restamp` when a release-please config bumps `plugin.json` and no workflow runs `plugin version`. The `version` skill gives the config and the workflow.
