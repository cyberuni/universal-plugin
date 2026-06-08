---
"universal-plugin": minor
---

Add `publish sync-version` command to sync the `version` field in `.plugin/plugin.json` from the npm package declared by a new `packagePath` field. Run `universal-plugin publish sync-version` after `changeset version` to keep the plugin manifest version in sync with the npm package. Also fixes the `build` command to strip `packagePath` from generated vendor manifests.
