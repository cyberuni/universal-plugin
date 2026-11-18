---
"universal-plugin": minor
---

Remove plugin launchers (ADR 0020, superseded). `plugin build` no longer writes `bin/<name>` from `extensions["org.cyberuni.universal-plugin"].launchers`: only Claude Code puts a plugin's `bin/` on `PATH`, and probes found that Cursor and GitHub Copilot CLI do not. A leftover `launchers` key now warns and is ignored; remove it and any `bin/<name>` it wrote, and have each skill run the CLI through a forwarder (ADR 0022).
