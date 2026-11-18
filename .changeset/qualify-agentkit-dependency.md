---
"universal-plugin": patch
---

universal-plugin now depends on `cyber-agentkit` from the `cyber-uni` marketplace (`{ "name": "cyber-agentkit", "marketplace": "cyber-uni" }`), not by bare name. A bare name resolves only in the marketplace the plugin was installed from, so an install from a marketplace that does not list `cyber-agentkit` could not resolve it.
