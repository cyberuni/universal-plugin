---
'universal-plugin': minor
---

Shorten the bundled skill names by dropping the redundant `universal-plugin` half — the plugin
namespace already supplies it. `universal-plugin` → `plugin`, `publish-universal-plugin` →
`publish-plugin`, `upgrade-universal-plugin` → `upgrade-plugin`, `migrate-universal-plugin` →
`migrate-plugin`. Invocation becomes `/universal-plugin:plugin` instead of
`/universal-plugin:universal-plugin`. `adopt-upx` is unchanged.

**Breaking for name-pinned installs.** Installing the whole plugin is unaffected — the marketplace
entry resolves the package directory and discovers skills from `skills/`, so nothing there refers to
a skill by name. But a per-skill install pinned the old name, and that path is gone:

```bash
# before
npx skills add cyberuni/universal-plugin --skill upgrade-universal-plugin
# after
npx skills add cyberuni/universal-plugin --skill upgrade-plugin
```

Update the `skills` key and `source` path in your `skills-lock.json`, or re-run `skills add` with the
new name. No aliases are shipped for the old names.
