---
"universal-plugin": minor
---

Emit TOON as the default output format

Every command's `--format` help named `toon` as its default, and the AXI output
contract (ADR-0003) requires it, but the implementation printed aligned ASCII
tables and padded field lists. Commands now encode their result with
`@toon-format/toon`, so `plugin build`, `plugin init`, `plugin version`,
`plugin bundle`, `config add`, `config get`, `governance list`,
`marketplace init`, and `publish sync-version` emit parseable TOON on stdout.

`--format json` is unchanged. `governance show` still prints the document body,
which is text rather than a record. Each default payload keeps its minimal row
schema and its pre-computed aggregate summary, so the counts a script matched
before are still there.
