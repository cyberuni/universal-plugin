---
"universal-plugin": minor
---

`plugin init --npm` copies the package `version` into the `plugin.json` it writes, and in a changesets repository wires the root `version` script (`changeset version && universal-plugin publish sync-version --root <plugin-root>`) plus a `universal-plugin` devDependency. A custom `version` script is left alone and init prints the line to add.
