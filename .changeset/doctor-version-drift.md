---
"universal-plugin": minor
---

Add `publish check-version`, a read-only check that fails when the `packagePath` `package.json`, `plugin.json`, the derived vendor manifests, the repository catalogs, or the skill `npx`/`upx` pins carry different versions, naming each file left behind. `doctor` now reports one `version-drift` finding per such file, and offers to add the check to the repository's verify script or CI.
