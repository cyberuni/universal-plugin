---
"universal-plugin": patch
---

`doctor` no longer reports `unreleased-content` for a non-npm plugin that a release tool versions. A plugin released with changesets (through a private `package.json`), release-please (its config bumps `plugin.json`), semantic-release, or release-it is skipped like a plugin that declares `packagePath`, because the tool picks the next number at release time.
