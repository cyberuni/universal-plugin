---
title: remove-plugin
description: Remove build artifacts, one vendor, or the plugin itself.
---

Fronts `plugin build --clean`. It removes artifacts. Cleaning build output, dropping one vendor, and
removing the plugin are three different asks, and only the last is irreversible.

Root `plugin.json` is never deleted as cleanup. It is the canonical source of truth, and it is also
the manifest GitHub Copilot CLI reads.

## See also

- [`init-universal-plugin`](../init-universal-plugin/) — the skill that writes the canonical manifest this one never deletes
