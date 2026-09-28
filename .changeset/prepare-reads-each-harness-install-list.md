---
"universal-plugin": patch
---

`prepare` now reads installed plugins the way each harness records them. It reads Claude Code's version 2 `installed_plugins.json` by plugin name and scope, and it reads Copilot CLI's `installed-plugins` folders and the Codex plugin cache. Plugin paths come from `@cyberuni/agent-harness`, which honors `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, and `COPILOT_HOME`.
