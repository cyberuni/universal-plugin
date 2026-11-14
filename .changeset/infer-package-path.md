---
"universal-plugin": minor
---

`config get --key packagePath --infer` reports `"."` when no `packagePath` is declared but the plugin root's own `package.json` is public and its `files` publish `plugin.json`, so a skill can tell that a plugin ships through npm without the declaration (#261).
