# Glossary — universal-plugin

Terms used across this spec. A flat reference doc (not a scanned node).

- **canonical manifest** — the single source-of-truth plugin descriptor at the project root,
  `plugin.json`, in Agent Plugins Specification v1.0.0 form (ADR-0007). Its field set is **closed**
  (`additionalProperties: false`): `$schema`, shared metadata (`name`, `version`, `description`, …),
  and a single `extensions` object. All tool-specific data lives under `extensions`, keyed by a
  reverse-domain namespace; `universal-plugin`'s own config lives at
  `extensions["org.cyberuni.universal-plugin"]`. Everything the CLI derives comes from this file.
- **extensions namespace** — `extensions["org.cyberuni.universal-plugin"]`, the one reverse-domain
  block `universal-plugin` owns in the canonical manifest. Holds this CLI's build inputs: the optional
  `vendors` target list, `packagePath`, component paths (e.g. `skills`), and the `harnesses` overrides.
- **vendor** (a.k.a. **harness**) — a target AI-agent runtime: `claude-code`, `cursor`, `codex`,
  `copilot-cli`. Each expects its manifest at a different path and shape.
- **vendor manifest** — the per-vendor output file the build derives from the canonical manifest
  (e.g. `.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json`). `copilot-cli` has none — it
  reads the canonical root `plugin.json` directly, which shadows every lower-precedence path it
  searches. The canonical wrapper (`$schema`, `extensions`) and `universal-plugin`'s own
  orchestration keys (`vendors`, `packagePath`, `harnesses`) are stripped; that vendor's own
  `harnesses.<vendor>` fields are merged over the shared metadata and component paths.
- **harnesses** — the `harnesses` object under the extensions namespace, mapping a vendor id to the
  per-harness override fields only that runtime needs (was the top-level `vendorExtensions`). Merged at
  build time (harness wins on conflict), stripped from output.
- **vendors** — the optional target list under the extensions namespace. When present, `plugin build`
  derives exactly those vendors; when absent, it falls back to every key in `harnesses`.
- **governance** — a named, version-pinned contract document (a `<name>.md`) that agents resolve by
  name rather than by path. `governance show` / `list` resolve these.
- **scope** — a location a governance document may live, resolved in a fixed precedence. For a plain
  name: `managed` → `project` → `local` → `user` → `package`. A namespaced `plugin/asset` lookup adds
  the `store` scope (the local asset-store) after the override scopes. Highest-precedence match wins.
  - **managed** — an OS-level, write-protected system dir (`/etc/universal-plugin/governances`, or the
    platform equivalent).
  - **project** — `<root>/governances/`.
  - **local** — `<root>/.agents/governances/`.
  - **user** — `~/.agents/governances/`.
  - **package** — the `governances/` dir shipped inside the `universal-plugin` package.
  - **store** — the local asset-store, reached only for a namespaced `plugin/asset` lookup.
