---
"universal-plugin": patch
---

The `doctor` and `publish-plugin` skills now ask the CLI for `packagePath` (`config get --key packagePath`) instead of reading `.agents/universal-plugin.json` themselves, so they cannot drift from `plugin version`. When the CLI is too old to answer, doctor reports `package-path-unknown` and skips `version-drift` and `unreleased-content` rather than guessing.
