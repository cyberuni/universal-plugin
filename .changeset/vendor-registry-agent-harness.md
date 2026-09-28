---
"universal-plugin": patch
---

The vendor registry no longer carries `globalManifest` or `globalPluginDir`, and Cursor's local plugin folder now comes from `@cyberuni/agent-harness`. `plugin install` for Cursor therefore honors the harness's config directory. A `localPluginDir` in `~/.agents/universal-plugin-vendors.json` still wins.
