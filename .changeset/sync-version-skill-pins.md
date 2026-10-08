---
"universal-plugin": patch
---

`publish sync-version` now moves the `npx`/`upx` pins in `skills/**` that name the synced package (`npx --yes <pkg>@0.8.0`, `npx -y <pkg>@0.8.0`, `upx <pkg>@0.8.0`) to the new version. Pins of other packages and pin-exempt skills are left alone.
