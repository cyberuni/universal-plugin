---
"universal-plugin": patch
---

`doctor` now accepts a repeatable `--marketplace-root <path>` flag to also validate a separately-cloned shared marketplace repository (e.g. a local clone of `cyberuni/marketplace`) — previously only the plugin's own repository root was checked, so a bad entry that reached the shared catalog another way went unnoticed. A named `--marketplace-root` that does not exist is reported as `marketplace-root-missing` instead of being silently skipped.
