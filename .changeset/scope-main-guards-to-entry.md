---
'universal-plugin': patch
---

`plugin build` now keeps only the entry's main guard when a script entry imports another script that is itself a CLI. Inlined modules share the compiled file's `import.meta.url`, so before this every inlined CLI ran alongside the entry's.
