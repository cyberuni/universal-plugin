---
"universal-plugin": minor
---

`doctor-universal-plugin` reports `own-package-runner`, a low-severity warning, for each skill or agent file that runs `npx` or `upx` on the plugin's own package. It names `file:line` and says to call the launcher `bin/<name>` bare, or to declare one. It claims only the verified case: Claude Code's Bash tool from an npm-sourced install.
