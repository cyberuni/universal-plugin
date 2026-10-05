---
"universal-plugin": minor
---

`marketplace validate` now checks, in the Claude catalog, that each listed plugin's dependencies can resolve from it. A plain dependency (a bare name, or an object with no `marketplace`) the catalog does not list is an issue, and so is a dependency on another marketplace that the catalog does not allow in `allowCrossMarketplaceDependenciesOn`. It reads what is on disk: an entry's own `dependencies`, and the manifest of a plugin at a `./` source. `marketplace init --force` now keeps a catalog's `allowCrossMarketplaceDependenciesOn` when it regenerates the file.
