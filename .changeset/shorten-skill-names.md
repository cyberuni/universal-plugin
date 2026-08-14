---
'universal-plugin': minor
---

Shorten the bundled skill names by dropping the redundant `universal-plugin` half — the plugin
namespace already supplies it. `universal-plugin` → `plugin`, `publish-universal-plugin` →
`publish-plugin`, `upgrade-universal-plugin` → `upgrade-plugin`, `migrate-universal-plugin` →
`migrate-plugin`. Invocation becomes `/universal-plugin:plugin` instead of
`/universal-plugin:universal-plugin`. `adopt-upx` is unchanged.
