---
'universal-plugin': minor
---

`plugin build` no longer derives a manifest for `copilot-cli`. Copilot CLI searches
`.plugin/plugin.json` → `plugin.json` → `.github/plugin/plugin.json` → `.claude-plugin/plugin.json`
and takes the first match, so the canonical root `plugin.json` always shadowed the
`.github/plugin/plugin.json` we were emitting — that file was never read. Copilot CLI has consumed
Open Plugin Spec v1 manifests since v1.0.74, so the canonical manifest serves it directly. The
vendor is now reported with status `canonical`, and a `harnesses["copilot-cli"]` override warns that
it has no delivery path (the canonical schema is closed to vendor-only fields).

Delete any stale `.github/plugin/plugin.json` from a previous build; it was inert.
