---
'universal-plugin': patch
---

`plugin build` now leaves a component path out of a vendor's derived manifest when that vendor has no such component, and warns: `codex has no "agents" component — the path is left out of .codex-plugin/plugin.json`. Codex reads `skills`, `commands`, `apps`, `hooks`, and `mcpServers`; Cursor reads `skills`, `commands`, `agents`, `rules`, `hooks`, and `mcpServers`; Claude Code reads every component except `rules` and `apps`. A `harnesses.<vendor>` override is never filtered. `doctor` reports the case as `unsupported-component`.
