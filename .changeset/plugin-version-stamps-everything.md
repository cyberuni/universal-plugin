---
"universal-plugin": minor
---

`plugin version` is now the single version stamp. One call writes the version into `plugin.json`, the `packagePath` `package.json`, the `npx`/`upx` pins in every skill file (scripts included), `.plugin/pins.json`, and each authored `mcpServers` entry marked `pinToPluginVersion`, then re-derives the vendor manifests. It takes the number from a release type, an explicit version (semantic-release's `prepareCmd`), or the new `--from-package` (changesets and release-please). Where `packagePath` is declared, a release type is refused, because the release picks the number.

`plugin build` no longer decides any version: a marked `mcpServers` entry is copied as authored and only its marker is stripped. `plugin bundle` and `publish sync-version` are deprecated aliases that warn, and are removed in the next minor release; `init --npm` now wires `plugin version --from-package`. `publish check-version` and `doctor` report a place holding `0.0.0-development` as unstamped rather than as drift, and compare the marked `mcpServers` pin too.
