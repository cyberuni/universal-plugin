---
"universal-plugin": patch
---

`doctor` now reports a marketplace catalog its runtime would refuse.

The catalogs sit at the repository root, above the plugin in a monorepo, and each is read at install
time — so a broken one is silent in diagnosis and loud in a user's terminal. The new `invalid-catalog`
finding names the key at fault and hands the repair to `/universal-plugin:marketplace`. A missing
catalog is still not a fault.
