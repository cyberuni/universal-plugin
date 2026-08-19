---
"universal-plugin": patch
---

Catalog entries now carry manifest metadata in the shape the catalog schema states.

A `plugin.json` written from a `package.json` carries `repository` as `{ type, url }`, and every
generated entry copied that object through. Claude Code refuses such a catalog —
`plugins[0].repository: expected string` — so a repository could generate a catalog nobody could
install from. An npm-shaped `repository` now becomes its URL, with any `git+` prefix removed, and a
manifest field that cannot be reduced to the type the schema states is omitted rather than written.
