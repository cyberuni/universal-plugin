---
"universal-plugin": patch
---

`migrate-plugin` now bundles the package's CLI with tsdown as part of the migration, so the CLI runs from an installed plugin directory that has no `node_modules`. It splits `tsdown.config.ts` into a library config that keeps dependencies external and a CLI config that inlines them through `deps.alwaysBundle`. It then proves the result by running the CLI from an extracted tarball.

The skill also covers plugins that live in a sibling workspace member such as `plugins/<name>/`, merges a colliding readme instead of overwriting it, and notes that `publish sync-version` reads `packagePath` from `.agents/universal-plugin.json`, not from the manifest. It also repoints lint excludes, marketplace sources, and spec paths.
