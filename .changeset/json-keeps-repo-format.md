---
"universal-plugin": patch
---

`plugin build`, `plugin version` and `publish sync-version` now write JSON in the format the file already has: its indentation, line ending, trailing newline, and the original text of every value they leave unchanged, so an array a formatter collapsed onto one line stays there. A new file, or one with no indentation to read, takes the indentation `.editorconfig` sets for it.
