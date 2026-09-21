---
"universal-plugin": minor
---

A new `build-plugin` skill is the entry point for `plugin build`. It runs the project's own build script when one exists, and otherwise the CLI shipped beside it through `scripts/build.mjs`, so nothing is downloaded. It reads the vendor and catalog rows back, reports each warning about something a vendor cannot represent, hands a `built 0` result to `doctor-universal-plugin`, and uses `--check` to gate CI on committed governance copies.
