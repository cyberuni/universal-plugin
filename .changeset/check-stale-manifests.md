---
"universal-plugin": minor
---

`plugin build --check` now also exits 1 when a vendor manifest (`.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json`, `.codex-plugin/plugin.json`, the `com.github.copilot/` tree, a derived hooks or mcp file) is stale or missing, or when a repository catalog the build refreshes would change. Before, it checked only compiled scripts, so a stale manifest passed CI. The error names each file with its status. A repository whose committed manifests are stale will start failing `--check`. To fix it, run `universal-plugin plugin build` and commit the result.
