---
"universal-plugin": minor
---

`plugin build` reads a plugin's dependencies from `extensions["io.github.cyber-uni.plugin-manager"].dependencies`, the key cyber-agentkit reads (ADR 0024). `extensions["org.cyberuni.universal-plugin"].dependencies` is still read when the new key declares none, so existing plugins build as before. When both declare a list, the new key wins and the build warns that the old list is ignored. `plugin validate` and `marketplace validate` read the same key.
