---
'universal-plugin': patch
---

Find the repository's catalogs and release config on Windows when the plugin root is spelled differently from git's top level, such as the 8.3 short name `os.tmpdir()` returns. `plugin build`, `plugin init`, `plugin version`, `publish check-version` and the doctor skill now spell the repository root the way the plugin root is spelled.
