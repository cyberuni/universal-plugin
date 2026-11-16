---
"universal-plugin": patch
---

`publish-plugin` now passes the plugin's `description`, `homepage`, `repository`, `license`, and `keywords` from its `plugin.json` to `marketplace add`, so a plugin it lists from a GitHub repository or an npm package no longer lands without them (#264). `marketplace add` itself still fetches nothing.
