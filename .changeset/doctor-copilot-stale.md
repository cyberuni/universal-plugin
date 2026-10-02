---
"universal-plugin": patch
---

`doctor` no longer reports `com.github.copilot/` as stale after a rebuild. It compares the newest file in the directory against `plugin.json`, because a directory's own mtime does not move when its files are rewritten in place.
