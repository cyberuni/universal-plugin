---
"universal-plugin": minor
---

Add `marketplace remove <name>` and `marketplace set`.

`marketplace remove` drops an entry from every catalog that lists it and keeps the rest of each
catalog as it was. It refuses when a listed plugin still depends on the entry; `--force` removes it
anyway and names what broke.

`marketplace set` edits a catalog's own fields in place: `--allow-dependencies-on` and
`--disallow-dependencies-on` change `allowCrossMarketplaceDependenciesOn`, and `--description`,
`--owner`, `--owner-email`, and `--owner-url` change the description and owner. Each runtime's
catalog gets only the fields it carries.

A dependency check that finds a cross-marketplace dependency the catalog does not allow now names
the `marketplace set --allow-dependencies-on` command that fixes it. `marketplace init --force`
warns about each hand-set field and entry it drops.
