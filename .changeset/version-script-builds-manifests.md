---
"universal-plugin": patch
---

Regenerate the vendor manifests during `changeset version`

The release chain synced the canonical `plugin.json` and stopped there —
`publish sync-version` writes exactly one row, so `.claude-plugin/`,
`.cursor-plugin/`, and `.codex-plugin/` kept whatever version they were last
committed with. The repo's own manifests had drifted a full minor behind as a
result. The root `version` script now runs `plugin:build` after the sync, so
every release derives the vendor manifests from the freshly synced version.
