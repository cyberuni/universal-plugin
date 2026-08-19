---
"universal-plugin": minor
---

`plugin build` now keeps the repository's local marketplace catalogs true. Each build re-derives this
plugin's entry in every catalog the repository already carries, for the vendors it is building, so a
catalog entry's version follows the canonical manifest instead of drifting from it (ADR-0010 §3,
ADR-0014). A version move reaches the catalogs in both release models with no extra command, since
`plugin version` and `changeset version → publish sync-version` both end in `plugin build`.

The refresh creates nothing: a catalog the repository does not carry is not written, and inside one
it carries, only this plugin's entry changes — the catalog's own fields, its formatting, its
indentation, and every other plugin's entry stay as they are. `--dry-run` reports the refresh as
planned. The build output and its JSON gain a `catalogs` list.

Neither generator requires a version on a Codex entry any more. `marketplace init --codex` used to
fail and `plugin init --vendor codex` used to skip the catalog, both on the belief that Codex keys
its install cache by the entry's version. It does not: the version comes from the plugin's own
manifest, and an entry that declares none installs normally (verified against codex-cli 0.147.0,
`.research/local-marketplaces`, E-CODEX-M15, E-CODEX-M16). The entry still carries the canonical
manifest's version when there is one, because that is this project's policy.
