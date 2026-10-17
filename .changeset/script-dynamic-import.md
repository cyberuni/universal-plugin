---
'universal-plugin': patch
---

`plugin build` no longer fails a script entry whose inlined code dynamically imports a module it already inlines, or calls `import(variable)`.
