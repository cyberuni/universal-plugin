---
'universal-plugin': minor
---

`publish-plugin` no longer hardcodes `cyberuni/cyberplace`. It now picks the target marketplace in this order: the one the user names, then the `marketplaces` array in the plugin's `.agents/universal-plugin.json` (read with `config get --key marketplaces`, one PR per entry), then the fallback `cyber-uni/marketplace`. It also tells the user which rule picked the target before it opens a PR.
