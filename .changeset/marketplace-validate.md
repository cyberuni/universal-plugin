---
"universal-plugin": minor
---

New `universal-plugin marketplace validate` — check the catalogs a repository carries against the
schema each runtime loads.

A catalog is read at install time, in someone else's terminal, so a broken one is silent here and
loud there. `validate` moves the refusal to the repository: per target it reports `valid`, `invalid`,
or `missing` (`--required` makes missing a failure), exits 1 when any selected catalog is invalid, and
names the key at fault plus the value to write instead — `owner must be an object with a name, not
string`. The rules are the official Claude Code marketplace schema for Claude Code, Cursor, and
Copilot CLI, and Codex's own document shape for Codex; a `./` source is also checked for existing on
disk. Nothing is repaired or written.

The same rules now run wherever a catalog is produced: `marketplace init` validates every planned
artifact and fails before any write, while `plugin init` and `plugin build` — which fold one entry
into a file they did not author — report the issues as notes and warnings.

The `marketplace` skill gained the validation step and now refuses to hand-author a catalog.
