---
"universal-plugin": minor
---

A skill runs its plugin's own CLI through a compiled per-command script (ADR 0021). `doctor-universal-plugin`'s `own-package-runner` now reads `pnpm exec <bin>` as well as `npx` and `upx`, and its repair is the script entry to declare (`skills/<skill>/scripts/<cli>-x-y.mjs` with `"command": "x y"`) and the `node` call that replaces the line, not a launcher. A new `runner-beside-script` finding flags a runner line for a command the same skill already has a compiled script for. `init-universal-plugin` gains an "add a command script" route that sets one up. Launchers (`bin/<name>`) are now documented as a Claude Code–only convenience: Cursor and Copilot CLI do not put a plugin's `bin/` on `PATH`.
