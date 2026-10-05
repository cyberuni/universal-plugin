---
"universal-plugin": minor
---

The `publish-plugin` skill now reads the plugin's dependencies. A plain dependency the target marketplace does not list is listed in the same PR, or the skill stops and asks for it to be published first. A dependency on another marketplace gets an offer to add it to the catalog's `allowCrossMarketplaceDependenciesOn`.
