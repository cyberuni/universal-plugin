---
"universal-plugin": patch
---

`doctor-universal-plugin` decides `stale` by content, not by modification time. It used to report every derived manifest as stale after a checkout, because a checkout writes `plugin.json` after derived files it did not change. `plugin build --dry-run` now gives each built vendor a `content` of `unchanged`, `stale` or `missing`, found by comparing the bytes it would write with the bytes on disk. The doctor reads that status, so it agrees with the build and also catches a hand-edit to a derived file.
