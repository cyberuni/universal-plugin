---
'universal-plugin': minor
---

`plugin build --check` writes nothing and exits 1 when a compiled script is `missing`, `stale` or `version`, naming each one, so CI can fail on a committed script that is behind its source without parsing `--dry-run --format json`. `--dry-run` alone still exits 0.
