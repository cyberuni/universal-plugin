---
'universal-plugin': patch
---

`plugin init --npm` now always wires the open-standard base — the canonical root `plugin.json` and
`skills/` — into `package.json` `files`, whatever `--vendor` targets are named. Previously the base
was tied to vendor selection, so a default `--npm` run wired `.claude-plugin/plugin.json` and
`skills/` but never the canonical manifest, and the published package shipped a Claude Code plugin
rather than a standard one. Vendor-derived manifests are added on top of the base, never in place
of it.
