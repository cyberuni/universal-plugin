---
title: build-plugin
description: Derive every vendor's form of a plugin from its canonical plugin.json.
---

Writes everything a runtime reads beside the canonical `plugin.json`: the Claude Code, Cursor, and
Codex manifests, and Copilot CLI's `com.github.copilot/` tree. It also refreshes this plugin's entry
in the repository's marketplace catalogs and the governance copies inside its skills. A change to a
plugin is not done until it is built, because a runtime reads the derived files, not the canonical
one.

The skill runs your project's own build script when one exists, and otherwise the CLI shipped beside
it, so nothing is downloaded. It reads the result back rather than calling it done. Each warning
names something a vendor cannot represent and will not deliver, and a `built 0` result goes to
[`doctor-universal-plugin`](../doctor-universal-plugin/) instead of being reported as success.

In CI, `--check` writes nothing and fails when a committed governance copy has drifted from its
source.

## See also

- [`version`](../version/) moves the number and builds in the same step
- [`remove-plugin`](../remove-plugin/) deletes what this skill writes
