---
"universal-plugin": patch
---

`publish sync-version` now re-derives the vendor manifests after it moves the version, the same way `plugin version` does, so they no longer keep the old number. Pass `--no-build` to skip that step when your release script runs `plugin build` itself. The `version` and `doctor-universal-plugin` skills now name `build-plugin` as the follow-up step.
