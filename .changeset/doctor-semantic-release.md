---
"universal-plugin": minor
---

`doctor` checks semantic-release wiring. It reports `semantic-release-no-stamp` when the semantic-release config has no `@semantic-release/exec` `prepareCmd` running `plugin version`, and `semantic-release-npm-unshipped` when a plugin that ships to no npm package still runs `@semantic-release/npm`, listed or through the default plugins list.
