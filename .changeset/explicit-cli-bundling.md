---
"universal-plugin": patch
---

State the CLI's dependency bundling explicitly in the build config.

`dist/cli.mjs` already shipped with its runtime dependencies inlined, and that is what lets the
shipped skill launchers run from an installed plugin directory at all — those directories are copies
of a source checkout, so their `node_modules` is absent or incomplete. The build now declares that
intent through an explicit `deps.alwaysBundle` block rather than relying on it incidentally, so a
dependency added later cannot quietly become external and break the launchers.

`@repobuddy/upx` is deliberately excluded. It is reachable only from the separate `bin/upx.mjs` shim,
which is not a build entry, so the `upx` bin still resolves it at runtime from an installed tree.
