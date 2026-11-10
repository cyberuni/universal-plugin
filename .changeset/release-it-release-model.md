---
"universal-plugin": minor
---

release-it is now a documented release model. With `"npm": false` release-it reads the version from the latest git tag and needs no `package.json`; an `after:bump` hook running `universal-plugin plugin version ${version}` stamps it before the release commit and tag. `doctor` reports `release-it-no-stamp` for a release-it config with no hook running `plugin version`.
