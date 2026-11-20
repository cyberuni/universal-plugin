# Sort and resolve the plugin's dependencies

Read this when Step 2g finds the plugin declares dependencies.

Each entry is a string (`<plugin>` or `<plugin>@<marketplace>`, optionally with an `@^range` tail) or
an object (`{ "name", "marketplace"?, "version"?, ... }`). Sort each one:

- **Plain** — a bare `<plugin>`, or an object with no `marketplace`. Claude Code resolves it against
  the marketplace the plugin is installed from, which is this one. If the target catalog
  (`.claude-plugin/marketplace.json`) already lists that name, it is resolved. Otherwise it must be
  listed in this same PR: locate the dependency's own repository or package (an object's `source`
  field, when present, says where it is distributed from; otherwise ask the user), run Step 1's
  pre-flight against it, and prepare its entries exactly as 2b–2f do for the main plugin — then
  resolve *its* plain dependencies the same way. If a plain dependency cannot be listed (no
  repository or package to read, pre-flight fails, the user declines), **stop**: tell the user to
  publish that dependency to this marketplace first, and do not open the PR.
- **Names a marketplace** — `<plugin>@<marketplace>`, or an object with `marketplace`. Not held to
  this catalog's listing, even when the marketplace it names is this one; do not add an entry for
  it. When the named marketplace is **not** this catalog's `name`, Claude Code refuses the
  dependency at install unless this catalog's top-level `allowCrossMarketplaceDependenciesOn` lists
  that marketplace. If it does not, tell the user that installs from this marketplace need it, and
  offer to add it in the same PR with
  `universal-plugin marketplace set --allow-dependencies-on <marketplace>`.

Report how each dependency was sorted and what was done about it, and include the dependency entries
in what you show the user to confirm.
