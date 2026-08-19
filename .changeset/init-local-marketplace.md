---
"universal-plugin": minor
---

`plugin init --vendor <id>` now registers the plugin in the repository's local marketplace, writing
each selected vendor's catalog at the repository root — `.claude-plugin/marketplace.json`,
`.cursor-plugin/marketplace.json`, and the rest — so the plugin can be installed and tested before
it is published. `--no-marketplace` opts out.

The marketplace is named after the repository rather than the plugin, `<owner>-<repo>-local`, since
the catalog sits at the repository root and lists every plugin the repository develops. The entry's
`source` is the path from there to the plugin. Owner comes from the canonical manifest's author, the
package that ships it, or the account the repository lives under; without one there is no catalog,
because every runtime requires it.

Re-running `init` folds the entry into the catalogs already on disk: the marketplace name, the
owner, and every other plugin's entry stay as they are. The entry's `version` is derived from the
canonical manifest, never authored, and a version left on an entry whose manifest declares none is
removed (ADR-0010 §3). Codex is skipped with a note until the manifest carries a version, which is
what its install cache is keyed by.
