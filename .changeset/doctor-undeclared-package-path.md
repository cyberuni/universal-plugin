---
"universal-plugin": patch
---

`doctor-universal-plugin` reports `undeclared-package-path` when the plugin root holds a public `package.json` that publishes `plugin.json` but `.agents/universal-plugin.json` declares no `packagePath`, the gap that made `publish-plugin` list an npm-shipped plugin from git (#261).
