---
'universal-plugin': patch
---

The skill references no longer contradict each other on how the plugin is built and shipped: Copilot CLI reads the canonical `plugin.json` directly, a local install goes through `plugin install` rather than a hand-written symlink, `anthropics/claude-plugins-official` takes no pull requests, the build writes no Cursor command or Codex prompt, `packagePath` lives in `.agents/universal-plugin.json`, and `plugin build` has a `--check` flag.
