---
title: bundle
description: Deprecated. Use plugin version.
---

:::caution[Deprecated]
`plugin bundle` is a deprecated alias of [`plugin version`](../overview/#plugin-version-stamps-every-place).
It prints a warning and is removed in the next minor release.
:::

`plugin version` now does what `bundle` did, and more. One call writes the version into `plugin.json`,
the package's `package.json`, every `npx`/`upx <pkg>@<version>` pin in the skills (the plugin's own
package, and other pnpm-workspace CLIs at their workspace versions), `.plugin/pins.json`, and each
`mcpServers` entry marked `pinToPluginVersion`, then re-derives through `plugin build`. Pin-exempt
skills (`metadata.pin-exempt: true`) are still skipped, and external packages are still left alone.

| You ran | Run instead |
|---|---|
| `plugin bundle` | `plugin version --from-package` |
| `plugin bundle --dry-run` | `plugin version --from-package --dry-run` |
| `publish sync-version` | `plugin version --from-package` |

"Bundle" no longer refers to pinning. The word is reserved for compiling skill scripts into one
self-contained file. The runner word each reference carries is not rewritten, so
`plugin bundle --runner` has no replacement; use the [`adopt-upx`](../../skills/adopt-upx/) skill to
move a plugin's references to `upx`.

See [ADR-0010](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/design/decisions/0010-version-policy.md) for the derive and stamp seam.
