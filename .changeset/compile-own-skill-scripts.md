---
"universal-plugin": patch
---

Fix universal-plugin's own skill scripts when pnpm copies a skill instead of linking it. The six that run a CLI command (`plugin build`, `plugin init`, `plugin version`, `marketplace add`, `marketplace init`, `marketplace validate`) call the installed CLI (`pnpm exec universal-plugin`), else `npx universal-plugin@<version>` pinned to the plugin's version. `doctor`, `rewrite-upx` and `install-docs` are self-contained. `doctor` now accepts a `$schema` only when it is hosted on `agent-plugins.org`, not a URL that merely mentions the name.
