---
"universal-plugin": minor
---

`plugin init` adds `build`, `check` and `check-version` scripts to the repository root `package.json`, so a CI job can run `pnpm run check` and fail on a stale build or version drift. An existing script is never overwritten; init prints the line to add. `--no-scripts` skips them.
