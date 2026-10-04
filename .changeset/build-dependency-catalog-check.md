---
"universal-plugin": minor
---

`plugin build` now checks each declared dependency against the marketplace catalogs it refreshes. A bare dependency the catalog does not list, or one qualified with a marketplace the catalog does not allow in `allowCrossMarketplaceDependenciesOn`, warns and names the fix. Pass `--strict-dependencies` to fail the build on it instead. A dependency that declares a `source`, such as `{ "name": "cyber-asana", "source": { "source": "npm", "package": "cyber-asana" } }`, is listed in the catalog for you.
