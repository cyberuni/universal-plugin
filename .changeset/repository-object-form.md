---
"universal-plugin": patch
---

`plugin build` now writes an object-form `repository` as its `url` string into the Claude Code, Cursor, and Codex manifests, which accept only a string, and says so under `--verbose`. It leaves an `author` without a `name` out of the Claude Code and Cursor manifests, which reject it, and warns. When Codex reads the canonical `plugin.json` (an Agent Plugins `$schema`), an object `repository` there stops it loading the plugin, so the build warns and `doctor-universal-plugin` reports `unaccepted-metadata`.
