---
"universal-plugin": patch
---

`publish check-version` (and `doctor`'s version-drift check) now compares the plugin root's `package.json` when it is public and publishes `plugin.json`, even with no `packagePath` declared. Before, an npm-shipped plugin that left out the key had its package hidden from the check (#261).
