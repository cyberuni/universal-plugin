---
"universal-plugin": patch
---

Derive universal-plugin's own vendor manifests instead of hand-maintaining them

The package shipped `.claude-plugin/`, `.cursor-plugin/`, and `.codex-plugin/`
manifests that were written by hand and never regenerated, because the canonical
`plugin.json` declared no `harnesses`. They had drifted to `version` `0.2.0` and
still carried the retired `vendors` and a `assets` path pointing at a directory
that does not exist — so every runtime reading a vendor manifest saw a stale
version. Declaring the four harnesses lets `universal-plugin plugin build`
produce them, and the regenerated files now track the canonical version.
