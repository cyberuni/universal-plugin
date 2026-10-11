---
"universal-plugin": patch
---

universal-plugin's own skill scripts are compiled entries, so they work when pnpm copies a skill instead of linking it. The six launchers that run a CLI command (`plugin build`, `plugin init`, `plugin version`, `marketplace add`, `marketplace init`, `marketplace validate`) call the installed CLI (`pnpm exec universal-plugin`), else `npx universal-plugin@<version>` pinned to the version they embed. `doctor`, `rewrite-upx` and `install-docs` compile from `src/skill-scripts/`.
