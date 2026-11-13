---
'universal-plugin': minor
---

`publish-plugin` now publishes like `npm publish`: it reads the plugin's version, stops if its release tag or npm version does not exist, and per marketplace adds the plugin when it is not listed, moves an older listing to the new release with `marketplace update`, or reports that this version is already published and changes nothing.
