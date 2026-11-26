---
"universal-plugin": patch
---

The CLI forwarder now warns that the build output is older than `src/` only in a development
checkout, one with a `.git` entry at or above the package and no `node_modules` on the way. In an
installed copy, such as a plugin cache, mtimes follow the order the installer copied files, so the
warning fired on output that matched its source. The warning now also says the CLI ran anyway.
