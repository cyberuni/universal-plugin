# Inspect a universal plugin

Show what a plugin declares and whether its derived manifests are current.

1. Read root `plugin.json`: `name`, `version`, and the vendor list at
   `extensions["org.cyberuni.universal-plugin"].vendors` (or, when absent, the `harnesses` keys).
2. Ask the build what it would write, without writing it:

```bash
npx universal-plugin plugin build --dry-run
```

```
vendors[4]{vendor,path,status}:
  claude-code,.claude-plugin/plugin.json,built
  cursor,.cursor-plugin/plugin.json,built
  codex,.codex-plugin/plugin.json,built
  copilot-cli,plugin.json,canonical
summary: "built 3, skipped 0, failed 0, served by plugin.json 1"
```

3. Compare that against what is on disk (`ls` each path). A declared vendor with no file is
   unbuilt; a file whose mtime predates `plugin.json` is stale — rebuild rather than guessing which
   fields drifted.

Read the statuses literally:

| Status | Means |
| --- | --- |
| `built` | the build writes this vendor's manifest |
| `canonical` | the vendor reads root `plugin.json`; **no file is written, and that is correct** |
| `skipped` | an unknown vendor id — a typo in `vendors`, reported as a warning |
| `failed` | the write itself failed; the warning names why |

Add `--verbose` to see which field came from where. Report status per vendor, plus any warning the
build printed — an undeliverable `harnesses["copilot-cli"]` override is only visible there.
