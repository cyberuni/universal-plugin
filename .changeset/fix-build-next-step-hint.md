---
"universal-plugin": patch
---

Fix `plugin build` ending with a next-step hint for `universal-plugin plugin validate`, a command that does not exist yet. A build that refreshed a marketplace catalog now points at `universal-plugin marketplace validate` (with `--root` for that repository), and any other successful build points at `/universal-plugin:doctor`.
