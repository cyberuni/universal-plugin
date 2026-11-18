---
"universal-plugin": minor
---

`plugin build` writes a plugin-local launcher, `bin/<name>`, for each entry in the extension's `launchers` map. It is an extensionless, mode 755 `sh` shim that runs an entry inside the package, so a skill can call a bare command instead of `npx` fetching the package at call time. `--check` fails when a launcher is missing, stale or not executable.
