# Inspect a universal plugin

Show the current state of a plugin.

1. Read root `plugin.json` — show `name`, `version`, declared vendors
   (`extensions["org.cyberuni.universal-plugin"].vendors`).
2. For each vendor, check whether the generated manifest exists at its output path.
3. Report status: which vendors are built, which are missing or stale.

Example output:

```
Plugin: my-plugin  v1.0.0
Vendors declared: claude-code, cursor, codex, copilot-cli
  claude-code   .claude-plugin/plugin.json   ✓ present
  cursor        .cursor-plugin/plugin.json   ✓ present
  codex         .codex-plugin/plugin.json    ✗ missing — run build
  copilot-cli   plugin.json                  ✗ missing — run build
```

Vendor output paths are listed in [`create.md`](./create.md) Step 2.
