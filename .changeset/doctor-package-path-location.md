---
"universal-plugin": patch
---

`doctor` now reads `packagePath` only from `.agents/universal-plugin.json`, resolved from the plugin root — the same file and base `plugin version` and `publish sync-version` use. It no longer falls back to `extensions["org.cyberuni.universal-plugin"].packagePath`, which the CLI never honored, so doctor could pass a plugin that `version` still treated as not shipping to npm. A `packagePath` declared in the manifest extension is now reported as `misplaced-package-path`.
