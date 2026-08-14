---
'universal-plugin': minor
---

The `plugin` skill now detects existing plugins on invocation. When a project has a vendor-specific
manifest (`.claude-plugin/`, `.cursor-plugin/`, …) or already ships public skills but has no
canonical root `plugin.json`, the gateway offers to adopt the open Agent Plugins Specification. The
lossless conversion procedure lives in the new `references/adopt.md`. Repo-private agent config
(`.claude/skills/`, `.agents/skills/`) is excluded from detection.
