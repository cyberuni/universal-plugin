---
"universal-plugin": patch
---

`publish-plugin` detects a plugin that ships in its own npm package from the package itself (`config get --key packagePath --infer`, confirmed with `npm view` and `npm pack --dry-run`), lists Claude Code and Codex from npm, and lists Copilot CLI and Cursor, which cannot install npm, from git instead of leaving them out (#261).
