---
'universal-plugin': patch
---

`plugin build` now writes invisible characters in a compiled script's string, template and regular-expression literals as `\uXXXX` escapes, so a script that inlines a dependency such as `yaml` passes invisible-Unicode skill checks. It warns, naming the file, line and code point, about any it cannot escape.
