# Delete a universal plugin

## Remove generated manifests only (keep source)

Delete each vendor's output file. Generated manifests are build artifacts — safe to delete and
regenerate via [`create.md`](./create.md) Step 7.

```bash
rm -f .claude-plugin/plugin.json
rm -f .cursor-plugin/plugin.json
rm -f .codex-plugin/plugin.json
rm -f plugin.json          # copilot-cli; only if this file is the generated artifact
```

## Remove the whole plugin

Delete the plugin root directory. Confirm with the user before proceeding — this is irreversible.
