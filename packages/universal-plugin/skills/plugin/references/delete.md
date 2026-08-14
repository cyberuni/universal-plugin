# Delete a universal plugin

## Remove generated manifests only (keep source)

Delete each vendor's output file. Generated manifests are build artifacts — safe to delete and
regenerate via [`create.md`](./create.md) Step 7.

```bash
rm -f .claude-plugin/plugin.json
rm -f .cursor-plugin/plugin.json
rm -f .codex-plugin/plugin.json
```

> **Never delete root `plugin.json`.** It is the canonical source of truth, not a build artifact —
> and it is also what Copilot CLI reads, so removing it takes out both the source and the Copilot
> target. `copilot-cli` has no generated manifest to clean.

If the project has a stale `.github/plugin/plugin.json` from an older build, it is safe to delete —
that path is shadowed by root and is no longer generated.

## Remove the whole plugin

Delete the plugin root directory. Confirm with the user before proceeding — this is irreversible.
