---
"universal-plugin": patch
---

Move `commander`, `semver`, `cyber-agentkit`, and `@toon-format/toon` to `devDependencies`. The `universal-plugin` bin already inlines them, so installing the package no longer pulls them in.
