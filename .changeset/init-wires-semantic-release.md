---
"universal-plugin": minor
---

The `init-universal-plugin` skill now wires semantic-release when the survey finds it or the user picks it. Once the user approves, it adds `@semantic-release/exec` running `plugin version ${nextRelease.version}` in `prepare`, and `@semantic-release/git` to commit the stamped files back. For a plugin that ships to no npm package it drops `@semantic-release/npm`. For release-it and release-please, the skill names the stamp each tool must call. The wiring stays in the skill, and `plugin init` gets no new flag.
