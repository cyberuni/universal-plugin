---
"universal-plugin": minor
---

`config get --key packagePath` now reads `packagePath` instead of rejecting it. `--format json` prints the declared path as a JSON string, relative to the plugin root, or `null` when no npm package is declared. `plugin version`, `publish sync-version`, and `config get` share one reader, so they cannot disagree about a declaration. `config add --key packagePath` is still rejected: the key is a string, not a plugin-registered array.
