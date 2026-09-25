---
"universal-plugin": patch
---

`publish sync-version` no longer requires `packagePath`. With none set in `.agents/universal-plugin.json`, it reads the `package.json` at the plugin root, so a single-package repository where `package.json` sits beside `plugin.json` needs no config file. It fails only when that file is missing too, and the error names both places it looked. An explicit `packagePath` still wins.
