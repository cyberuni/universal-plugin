---
"universal-plugin": minor
---

`doctor` checks that semantic-release commits the stamped files. It reports `semantic-release-no-commit` when an `@semantic-release/exec` `prepareCmd` stamps the version but no `@semantic-release/git` commits it, and `semantic-release-git-before-exec` when `@semantic-release/git` is listed before the stamp, since plugins prepare in list order.
