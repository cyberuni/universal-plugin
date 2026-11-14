---
"universal-plugin": patch
---

`marketplace add` and `marketplace update` keep a catalog's own indentation, line ending, and untouched values when they write it, instead of rewriting a tab-indented catalog with two spaces. A new catalog takes `.editorconfig`'s indentation (#261).
