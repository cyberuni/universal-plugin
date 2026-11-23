---
"universal-plugin": minor
---

The `init-universal-plugin` skill adds, changes, and removes the plugins a plugin depends on. It writes them in root
`plugin.json` under `extensions["io.github.cyber-uni.plugin-manager"].dependencies`, moves a list it finds under
`org.cyberuni.universal-plugin` to that key, and hands checking whether they are installed to cyber-agentkit's
`dependency doctor`.
