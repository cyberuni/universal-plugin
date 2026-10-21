---
'universal-plugin': patch
---

`plugin build` no longer takes minutes on a script that inlines a module with a very long run of identifier characters, such as a base64 source map. The main-guard scan now runs in linear time and skips modules that never use `import.meta`.
