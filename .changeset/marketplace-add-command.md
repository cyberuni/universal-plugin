---
"universal-plugin": minor
---

`marketplace add` lists a plugin the repository does not hold, so a repository can curate a marketplace instead of only publishing its own plugins. One positional says where the plugin lives and is read by shape: a `./` path, an `owner/repo` slug, a git URL, an npm package (`npm:pkg` or `@scope/pkg`), or `<plugin>@<marketplace>` — with `--path`, `--npm`, `--github`, `--url`, and `--from-marketplace` to force the reading where `owner/repo` and a relative path collide. Nothing is fetched: metadata comes from a path's own `plugin.json`, an installed `node_modules` copy, the entry being copied, or the `--description`/`--version`/`--homepage`/`--repository`/`--license`/`--keywords` flags. A `<plugin>@<marketplace>` entry is resolved and copied from a marketplace the runtime has already added, or from `--from <dir>`. An entry only reaches a catalog whose runtime resolves that source — npm goes to Claude Code and Codex, and Copilot CLI and Cursor are reported `skipped` with the reason rather than written a source they refuse.

A regeneration no longer discards the entries it did not derive. `marketplace init`, `plugin build`, and `plugin init` keep an entry whose source is not a local path, and keep a non-local source on a plugin they *do* discover while refreshing its derived metadata — so a plugin distributed through npm is not rewritten to a repository path holding gitignored build output, and `add` and `init` compose on one repository. A local-path entry discovery no longer finds is still dropped.

The `marketplace` skill is now a gateway over three routes (`init`, `add`, `validate`), each with its own reference, and ships a `scripts/add.mjs` wrapper.
